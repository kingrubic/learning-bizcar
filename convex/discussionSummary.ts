import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { DISCUSSION_SUGGEST_MAX, DISCUSSION_SUMMARY_FIELD_MAX, DISCUSSION_SUMMARY_TITLE_MAX } from "./discussionAccess";
import { openChannel } from "./discussion";
import { gate, nextId, now, userByLegacy } from "./helpers";

const secret = { secret: v.string() };

async function log(ctx: MutationCtx, actorId: number, action: string, targetId: string) {
  const id = await nextId(ctx, "activityLogs");
  await ctx.db.insert("activityLogs", {
    legacyId: id,
    actorId,
    action,
    targetType: "discussion",
    targetId,
    detail: null,
    createdAt: now(),
  });
}

export const view = query({
  args: { ...secret, userId: v.number(), channelId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const opened = await openChannel(ctx, args.userId, args.channelId);
    if (opened.error) return { error: opened.error, canEdit: false, channel: null, summary: null, recent: [] as RecentLine[] };
    const cohort = await ctx.db.query("cohorts").withIndex("by_legacy", (q) => q.eq("legacyId", opened.channel.cohortId)).unique();
    const rows = await ctx.db.query("discussionSummaries").withIndex("by_channel", (q) => q.eq("channelId", opened.channel.legacyId)).collect();
    rows.sort((a, b) => a.legacyId - b.legacyId);
    const row = rows[0] ?? null;
    const editor = row ? await userByLegacy(ctx, row.editorId) : null;
    const messages = await ctx.db.query("discussionMessages").withIndex("by_channel", (q) => q.eq("channelId", opened.channel.legacyId)).collect();
    messages.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.legacyId - b.legacyId));
    const slice = messages.slice(-DISCUSSION_SUGGEST_MAX);
    const authors = new Map<number, string>();
    const recent: RecentLine[] = [];
    for (const message of slice) {
      if (!authors.has(message.authorId)) {
        const author = await userByLegacy(ctx, message.authorId);
        authors.set(message.authorId, author?.displayName ?? "—");
      }
      const files = await ctx.db.query("discussionAttachments").withIndex("by_message", (q) => q.eq("messageId", message.legacyId)).collect();
      recent.push({
        authorName: authors.get(message.authorId) ?? "—",
        body: message.body,
        fileCount: files.length,
      });
    }
    return {
      error: null,
      canEdit: opened.staff,
      channel: {
        id: opened.channel.legacyId,
        cohortName: cohort?.name ?? "",
        kind: opened.channel.kind,
        name: opened.channel.name,
        archived: opened.channel.archived === 1,
      },
      summary: row
        ? {
            title: row.title,
            points: row.points,
            conclusion: row.conclusion,
            notes: row.notes,
            updatedAt: row.updatedAt,
            editorName: editor?.displayName ?? "—",
          }
        : null,
      recent,
    };
  },
});

type RecentLine = { authorName: string; body: string; fileCount: number };

export const save = mutation({
  args: {
    ...secret,
    userId: v.number(),
    channelId: v.number(),
    title: v.string(),
    points: v.string(),
    conclusion: v.string(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    const opened = await openChannel(ctx, args.userId, args.channelId);
    if (opened.error) return { error: opened.error };
    if (!opened.staff) return { error: "forbidden" as const };
    const title = args.title.trim();
    const points = args.points.trim();
    const conclusion = args.conclusion.trim();
    const notes = args.notes.trim();
    if (title.length > DISCUSSION_SUMMARY_TITLE_MAX) return { error: "long" as const };
    if ([points, conclusion, notes].some((value) => value.length > DISCUSSION_SUMMARY_FIELD_MAX)) return { error: "long" as const };
    const rows = await ctx.db.query("discussionSummaries").withIndex("by_channel", (q) => q.eq("channelId", opened.channel.legacyId)).collect();
    rows.sort((a, b) => a.legacyId - b.legacyId);
    const stamp = now();
    const fields = { title, points, conclusion, notes, editorId: opened.userId, updatedAt: stamp };
    const current = rows[0];
    if (current) await ctx.db.patch(current._id, fields);
    else {
      const id = await nextId(ctx, "discussionSummaries");
      await ctx.db.insert("discussionSummaries", { legacyId: id, channelId: opened.channel.legacyId, ...fields });
    }
    for (const extra of rows.slice(1)) await ctx.db.delete(extra._id);
    await log(ctx, opened.userId, "discussion_summary_save", String(opened.channel.legacyId));
    return { ok: true as const };
  },
});
