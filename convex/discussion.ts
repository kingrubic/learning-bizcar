import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { channelAccess, DISCUSSION_BODY_MAX, DISCUSSION_FILE_BYTES, DISCUSSION_FILE_MAX, DISCUSSION_HISTORY_MAX, DISCUSSION_NAME_MAX } from "./discussionAccess";
import { gate, nextId, now, userByLegacy } from "./helpers";
import { notifyDiscussionPost } from "./notifications";

const secret = { secret: v.string() };

type Ctx = QueryCtx | MutationCtx;
type Access = { userId: number; staff: boolean; enrolledCohortId: number | null };

function isStaff(role: "admin" | "mod" | "user") {
  // Instructor is admin or mod (Điều phối). memberRole "coach" is unused, same scope as canCoachSee.
  return role === "admin" || role === "mod";
}

async function log(ctx: MutationCtx, actorId: number, action: string, targetId: string, detail?: string) {
  const id = await nextId(ctx, "activityLogs");
  await ctx.db.insert("activityLogs", {
    legacyId: id,
    actorId,
    action,
    targetType: "discussion",
    targetId,
    detail: detail ?? null,
    createdAt: now(),
  });
}

async function learnerSeat(ctx: Ctx, userId: number) {
  const rows = await ctx.db.query("enrollments").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  return rows.find((row) => row.memberRole === "learner") ?? null;
}

async function accessFor(ctx: Ctx, userId: number): Promise<Access | null> {
  const user = await userByLegacy(ctx, userId);
  if (!user || user.active !== 1) return null;
  const staff = isStaff(user.role);
  const seat = await learnerSeat(ctx, user.legacyId);
  return { userId: user.legacyId, staff, enrolledCohortId: seat?.cohortId ?? null };
}

async function isMember(ctx: Ctx, channelId: number, userId: number) {
  const row = await ctx.db.query("discussionMembers").withIndex("by_channel_user", (q) => q.eq("channelId", channelId).eq("userId", userId)).unique();
  return Boolean(row);
}

async function channelByLegacy(ctx: Ctx, id: number) {
  return ctx.db.query("discussionChannels").withIndex("by_legacy", (q) => q.eq("legacyId", id)).unique();
}

async function learnerIds(ctx: Ctx, cohortId: number) {
  const rows = await ctx.db.query("enrollments").withIndex("by_cohort", (q) => q.eq("cohortId", cohortId)).collect();
  return new Set(rows.filter((row) => row.memberRole === "learner").map((row) => row.userId));
}

export async function openChannel(ctx: Ctx, userId: number, channelId: number) {
  const access = await accessFor(ctx, userId);
  const channel = await channelByLegacy(ctx, channelId);
  if (!access || !channel) return { error: "missing" as const };
  const decision = await decide(ctx, access, channel);
  if (!decision.read) return { error: "forbidden" as const };
  return { error: null, staff: access.staff, userId: access.userId, channel, decision };
}

async function decide(ctx: Ctx, access: Access, channel: { legacyId: number; cohortId: number; kind: "class" | "group"; archived: number }) {
  const member = !access.staff && channel.kind === "group" ? await isMember(ctx, channel.legacyId, access.userId) : false;
  return channelAccess({
    staff: access.staff,
    enrolledCohortId: access.enrolledCohortId,
    channelCohortId: channel.cohortId,
    kind: channel.kind,
    archived: channel.archived === 1,
    member,
  });
}

function oneClassPerCohort<T extends { legacyId: number; cohortId: number; kind: "class" | "group" }>(rows: T[]) {
  const seen = new Set<number>();
  const kept: T[] = [];
  for (const row of [...rows].sort((a, b) => a.legacyId - b.legacyId)) {
    if (row.kind === "class") {
      if (seen.has(row.cohortId)) continue;
      seen.add(row.cohortId);
    }
    kept.push(row);
  }
  return kept;
}

export async function ensureClassChannel(ctx: MutationCtx, cohortId: number, actorId: number) {
  const existing = (await ctx.db.query("discussionChannels").withIndex("by_cohort", (q) => q.eq("cohortId", cohortId)).collect())
    .filter((row) => row.kind === "class")
    .sort((a, b) => a.legacyId - b.legacyId)[0];
  if (existing) return existing.legacyId;
  const id = await nextId(ctx, "discussionChannels");
  await ctx.db.insert("discussionChannels", {
    legacyId: id,
    cohortId,
    kind: "class",
    name: "Cả lớp",
    archived: 0,
    createdBy: actorId,
    createdAt: now(),
  });
  await log(ctx, actorId, "discussion_class", String(id), String(cohortId));
  return id;
}

async function replaceMembers(ctx: MutationCtx, channelId: number, memberIds: number[]) {
  const next = new Set(memberIds);
  const current = await ctx.db.query("discussionMembers").withIndex("by_channel", (q) => q.eq("channelId", channelId)).collect();
  const have = new Set<number>();
  for (const row of current) {
    have.add(row.userId);
    if (!next.has(row.userId)) await ctx.db.delete(row._id);
  }
  const stamp = now();
  for (const userId of next) {
    if (!have.has(userId)) await ctx.db.insert("discussionMembers", { channelId, userId, createdAt: stamp });
  }
}

function cleanName(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > DISCUSSION_NAME_MAX) return null;
  return trimmed;
}

export const touch = mutation({
  args: { ...secret, userId: v.number(), cohortId: v.optional(v.number()) },
  handler: async (ctx, args) => {
    gate(args.secret);
    const access = await accessFor(ctx, args.userId);
    if (!access) return { ids: [] as number[] };
    const targets: number[] = [];
    const onlyCohort = args.cohortId;
    if (access.staff) {
      if (onlyCohort) {
        const cohort = await ctx.db.query("cohorts").withIndex("by_legacy", (q) => q.eq("legacyId", onlyCohort)).unique();
        if (cohort) targets.push(cohort.legacyId);
      } else {
        const cohorts = await ctx.db.query("cohorts").collect();
        for (const cohort of cohorts) targets.push(cohort.legacyId);
      }
    } else if (access.enrolledCohortId) {
      targets.push(access.enrolledCohortId);
    }
    const ids: number[] = [];
    for (const cohortId of targets) ids.push(await ensureClassChannel(ctx, cohortId, access.userId));
    return { ids };
  },
});

export const home = query({
  args: { ...secret, userId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const access = await accessFor(ctx, args.userId);
    if (!access) return { staff: false, enrolled: false, channels: [] as ChannelRow[], missingClass: [] as number[] };
    // ponytail: staff lists every channel; switch to per-cohort reads if a deployment grows past a few hundred channels.
    const rows = access.staff
      ? await ctx.db.query("discussionChannels").collect()
      : access.enrolledCohortId
        ? await ctx.db.query("discussionChannels").withIndex("by_cohort", (q) => q.eq("cohortId", access.enrolledCohortId!)).collect()
        : [];
    const cohorts = await ctx.db.query("cohorts").collect();
    const names = new Map(cohorts.map((row) => [row.legacyId, row.name]));
    const kept = oneClassPerCohort(rows);
    const channels: ChannelRow[] = [];
    for (const channel of kept) {
      const decision = await decide(ctx, access, channel);
      if (!decision.read) continue;
      channels.push({
        id: channel.legacyId,
        cohortId: channel.cohortId,
        cohortName: names.get(channel.cohortId) ?? "",
        kind: channel.kind,
        name: channel.name,
        archived: channel.archived === 1,
        canPost: decision.post,
      });
    }
    channels.sort((a, b) => {
      if (a.cohortName !== b.cohortName) return a.cohortName < b.cohortName ? -1 : 1;
      if (a.kind !== b.kind) return a.kind === "class" ? -1 : 1;
      if (a.archived !== b.archived) return a.archived ? 1 : -1;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : a.id - b.id;
    });
    const classIds = new Set(kept.filter((row) => row.kind === "class").map((row) => row.cohortId));
    const scope = access.staff ? cohorts.map((row) => row.legacyId) : access.enrolledCohortId ? [access.enrolledCohortId] : [];
    const missingClass = scope.filter((id) => !classIds.has(id));
    return { staff: access.staff, enrolled: access.enrolledCohortId !== null, channels, missingClass };
  },
});

type ChannelRow = {
  id: number;
  cohortId: number;
  cohortName: string;
  kind: "class" | "group";
  name: string;
  archived: boolean;
  canPost: boolean;
};

export const thread = query({
  args: { ...secret, userId: v.number(), channelId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const access = await accessFor(ctx, args.userId);
    const channel = await channelByLegacy(ctx, args.channelId);
    if (!access || !channel) return { error: "missing" as const };
    const decision = await decide(ctx, access, channel);
    if (!decision.read) return { error: "forbidden" as const };
    const cohort = await ctx.db.query("cohorts").withIndex("by_legacy", (q) => q.eq("legacyId", channel.cohortId)).unique();
    const rows = await ctx.db.query("discussionMessages").withIndex("by_channel", (q) => q.eq("channelId", channel.legacyId)).collect();
    rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.legacyId - b.legacyId));
    const trimmed = rows.length > DISCUSSION_HISTORY_MAX;
    const slice = trimmed ? rows.slice(-DISCUSSION_HISTORY_MAX) : rows;
    const authors = new Map<number, string>();
    const messages = [];
    for (const row of slice) {
      if (!authors.has(row.authorId)) {
        const author = await userByLegacy(ctx, row.authorId);
        authors.set(row.authorId, author?.displayName ?? "—");
      }
      const files = await ctx.db.query("discussionAttachments").withIndex("by_message", (q) => q.eq("messageId", row.legacyId)).collect();
      const attachments = [];
      for (const file of files.sort((a, b) => a.legacyId - b.legacyId)) {
        attachments.push({
          id: file.legacyId,
          fileName: file.fileName,
          size: file.size,
          contentType: file.contentType,
          url: await ctx.storage.getUrl(file.storageId),
        });
      }
      messages.push({
        id: row.legacyId,
        body: row.body,
        createdAt: row.createdAt,
        authorId: row.authorId,
        authorName: authors.get(row.authorId) ?? "—",
        attachments,
      });
    }
    return {
      error: null,
      channel: {
        id: channel.legacyId,
        cohortId: channel.cohortId,
        cohortName: cohort?.name ?? "",
        kind: channel.kind,
        name: channel.name,
        archived: channel.archived === 1,
        canPost: decision.post,
      },
      trimmed,
      messages,
    };
  },
});

export const desk = query({
  args: { ...secret, userId: v.number(), cohortId: v.optional(v.number()) },
  handler: async (ctx, args) => {
    gate(args.secret);
    const access = await accessFor(ctx, args.userId);
    if (!access?.staff) {
      return { error: "forbidden" as const, cohorts: [] as { id: number; name: string }[], cohortId: null as number | null, roster: [] as RosterRow[], channels: [] as DeskChannel[] };
    }
    const cohorts = (await ctx.db.query("cohorts").collect()).sort((a, b) => (a.name < b.name ? -1 : 1));
    const cohort = cohorts.find((row) => row.legacyId === args.cohortId) ?? cohorts[0] ?? null;
    if (!cohort) return { error: null, cohorts: [], cohortId: null, roster: [], channels: [] };
    const enrolled = (await ctx.db.query("enrollments").withIndex("by_cohort", (q) => q.eq("cohortId", cohort.legacyId)).collect())
      .filter((row) => row.memberRole === "learner");
    const roster: RosterRow[] = [];
    for (const row of enrolled) {
      const member = await userByLegacy(ctx, row.userId);
      if (!member) continue;
      roster.push({ id: member.legacyId, displayName: member.displayName, username: member.username, active: member.active === 1 });
    }
    roster.sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));
    const channelRows = oneClassPerCohort(await ctx.db.query("discussionChannels").withIndex("by_cohort", (q) => q.eq("cohortId", cohort.legacyId)).collect());
    const channels: DeskChannel[] = [];
    for (const channel of channelRows) {
      const members = channel.kind === "group"
        ? await ctx.db.query("discussionMembers").withIndex("by_channel", (q) => q.eq("channelId", channel.legacyId)).collect()
        : [];
      channels.push({
        id: channel.legacyId,
        kind: channel.kind,
        name: channel.name,
        archived: channel.archived === 1,
        memberIds: members.map((row) => row.userId),
      });
    }
    channels.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "class" ? -1 : 1;
      if (a.archived !== b.archived) return a.archived ? 1 : -1;
      return a.name.localeCompare(b.name, "vi");
    });
    return {
      error: null,
      cohorts: cohorts.map((row) => ({ id: row.legacyId, name: row.name })),
      cohortId: cohort.legacyId,
      roster,
      channels,
    };
  },
});

type RosterRow = { id: number; displayName: string; username: string; active: boolean };
type DeskChannel = { id: number; kind: "class" | "group"; name: string; archived: boolean; memberIds: number[] };

const attachmentArg = v.object({
  storageId: v.id("_storage"),
  fileName: v.string(),
  contentType: v.string(),
});

export const prepareUpload = mutation({
  args: { ...secret, userId: v.number(), channelId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const access = await accessFor(ctx, args.userId);
    const channel = await channelByLegacy(ctx, args.channelId);
    if (!access || !channel) return { error: "missing" as const };
    const decision = await decide(ctx, access, channel);
    if (!decision.post) return { error: "forbidden" as const };
    return { uploadUrl: await ctx.storage.generateUploadUrl() };
  },
});

export const discardUploads = mutation({
  args: { ...secret, userId: v.number(), storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    gate(args.secret);
    const access = await accessFor(ctx, args.userId);
    if (!access) return { ok: true as const };
    for (const storageId of args.storageIds) {
      const linked = await ctx.db.query("discussionAttachments").withIndex("by_storage", (q) => q.eq("storageId", storageId)).first();
      if (linked) continue;
      const meta = await ctx.storage.getMetadata(storageId);
      if (meta) await ctx.storage.delete(storageId);
    }
    return { ok: true as const };
  },
});

export const post = mutation({
  args: { ...secret, userId: v.number(), channelId: v.number(), body: v.string(), attachments: v.array(attachmentArg) },
  handler: async (ctx, args) => {
    gate(args.secret);
    const body = args.body.trim();
    if (!body && args.attachments.length === 0) return { error: "empty" as const };
    if (body.length > DISCUSSION_BODY_MAX) return { error: "long" as const };
    if (args.attachments.length > DISCUSSION_FILE_MAX) return { error: "files" as const };
    const access = await accessFor(ctx, args.userId);
    const channel = await channelByLegacy(ctx, args.channelId);
    if (!access || !channel) return { error: "missing" as const };
    const decision = await decide(ctx, access, channel);
    if (!decision.post) return { error: "forbidden" as const };
    const files: { storageId: typeof args.attachments[number]["storageId"]; fileName: string; size: number; contentType: string }[] = [];
    for (const file of args.attachments) {
      const meta = await ctx.storage.getMetadata(file.storageId);
      if (!meta) return { error: "upload" as const };
      if (meta.size > DISCUSSION_FILE_BYTES) {
        await ctx.storage.delete(file.storageId);
        return { error: "size" as const };
      }
      const fileName = file.fileName.trim().slice(0, 120) || "file";
      files.push({
        storageId: file.storageId,
        fileName,
        size: meta.size,
        contentType: (meta.contentType || file.contentType || "application/octet-stream").slice(0, 160),
      });
    }
    const id = await nextId(ctx, "discussionMessages");
    const createdAt = now();
    await ctx.db.insert("discussionMessages", {
      legacyId: id,
      channelId: channel.legacyId,
      authorId: access.userId,
      body,
      createdAt,
    });
    for (const file of files) {
      const attachmentId = await nextId(ctx, "discussionAttachments");
      await ctx.db.insert("discussionAttachments", {
        legacyId: attachmentId,
        messageId: id,
        storageId: file.storageId,
        fileName: file.fileName,
        size: file.size,
        contentType: file.contentType,
      });
    }
    const author = await userByLegacy(ctx, access.userId);
    await notifyDiscussionPost(ctx, {
      channelId: channel.legacyId,
      cohortId: channel.cohortId,
      channelKind: channel.kind,
      channelName: channel.name,
      messageId: id,
      authorId: access.userId,
      authorName: author?.displayName ?? "—",
      snippet: body.slice(0, 140),
      fileCount: files.length,
    });
    return { ok: true as const };
  },
});

export const createGroup = mutation({
  args: { ...secret, userId: v.number(), cohortId: v.number(), name: v.string(), memberIds: v.array(v.number()) },
  handler: async (ctx, args) => {
    gate(args.secret);
    const access = await accessFor(ctx, args.userId);
    if (!access?.staff) return { error: "forbidden" as const };
    const cohort = await ctx.db.query("cohorts").withIndex("by_legacy", (q) => q.eq("legacyId", args.cohortId)).unique();
    if (!cohort) return { error: "missing" as const };
    const name = cleanName(args.name);
    if (!name) return { error: "name" as const };
    const allowed = await learnerIds(ctx, cohort.legacyId);
    if (args.memberIds.some((id) => !allowed.has(id))) return { error: "members" as const };
    const id = await nextId(ctx, "discussionChannels");
    await ctx.db.insert("discussionChannels", {
      legacyId: id,
      cohortId: cohort.legacyId,
      kind: "group",
      name,
      archived: 0,
      createdBy: access.userId,
      createdAt: now(),
    });
    await replaceMembers(ctx, id, args.memberIds);
    await log(ctx, access.userId, "discussion_group_create", String(id), name);
    return { ok: true as const, id };
  },
});

export const saveGroup = mutation({
  args: { ...secret, userId: v.number(), channelId: v.number(), name: v.string(), memberIds: v.array(v.number()) },
  handler: async (ctx, args) => {
    gate(args.secret);
    const access = await accessFor(ctx, args.userId);
    const channel = await channelByLegacy(ctx, args.channelId);
    if (!access?.staff || !channel || channel.kind !== "group") return { error: "forbidden" as const };
    const name = cleanName(args.name);
    if (!name) return { error: "name" as const };
    const allowed = await learnerIds(ctx, channel.cohortId);
    if (args.memberIds.some((id) => !allowed.has(id))) return { error: "members" as const };
    await ctx.db.patch(channel._id, { name });
    await replaceMembers(ctx, channel.legacyId, args.memberIds);
    await log(ctx, access.userId, "discussion_group_save", String(channel.legacyId), name);
    return { ok: true as const };
  },
});

export const setArchived = mutation({
  args: { ...secret, userId: v.number(), channelId: v.number(), archived: v.boolean() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const access = await accessFor(ctx, args.userId);
    const channel = await channelByLegacy(ctx, args.channelId);
    if (!access?.staff || !channel || channel.kind !== "group") return { error: "forbidden" as const };
    await ctx.db.patch(channel._id, { archived: args.archived ? 1 : 0 });
    await log(ctx, access.userId, args.archived ? "discussion_group_archive" : "discussion_group_restore", String(channel.legacyId), channel.name);
    return { ok: true as const };
  },
});

export const deleteGroup = mutation({
  args: { ...secret, userId: v.number(), channelId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const access = await accessFor(ctx, args.userId);
    const channel = await channelByLegacy(ctx, args.channelId);
    if (!access?.staff || !channel || channel.kind !== "group") return { error: "forbidden" as const };
    const messages = await ctx.db.query("discussionMessages").withIndex("by_channel", (q) => q.eq("channelId", channel.legacyId)).collect();
    for (const row of messages) {
      const files = await ctx.db.query("discussionAttachments").withIndex("by_message", (q) => q.eq("messageId", row.legacyId)).collect();
      for (const file of files) {
        await ctx.storage.delete(file.storageId);
        await ctx.db.delete(file._id);
      }
      await ctx.db.delete(row._id);
    }
    const members = await ctx.db.query("discussionMembers").withIndex("by_channel", (q) => q.eq("channelId", channel.legacyId)).collect();
    for (const row of members) await ctx.db.delete(row._id);
    const summaries = await ctx.db.query("discussionSummaries").withIndex("by_channel", (q) => q.eq("channelId", channel.legacyId)).collect();
    for (const row of summaries) await ctx.db.delete(row._id);
    await ctx.db.delete(channel._id);
    await log(ctx, access.userId, "discussion_group_delete", String(channel.legacyId), channel.name);
    return { ok: true as const };
  },
});
