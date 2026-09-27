import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { LESSONS } from "./catalog";
import {
  COMPANY_FILE_BYTES,
  EXCERPT_LEN,
  PASTE_MAX,
  PROFILE_TEXT_MAX,
  cleanFileName,
  companyFileKind,
  readList,
  type CompanyAssessment,
  type CompanyProfileView,
  type CompanySource,
} from "./companyProfileAccess";
import { gate, nextId, now, userByLegacy } from "./helpers";

const secret = { secret: v.string() };

function isStaff(role: "admin" | "mod" | "user") {
  return role === "admin" || role === "mod";
}

async function actor(ctx: QueryCtx | MutationCtx, userId: number) {
  const user = await userByLegacy(ctx, userId);
  if (!user || user.active !== 1) return null;
  return user;
}

async function currentProfile(ctx: QueryCtx | MutationCtx, userId: number) {
  const rows = await ctx.db.query("companyProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  return rows.sort((a, b) => b.version - a.version)[0] ?? null;
}

function publicProfile(profile: {
  fileName: string;
  source: CompanySource;
  contentType: string;
  size: number;
  updatedAt: string;
  version: number;
  text: string;
  truncated: number;
}): CompanyProfileView {
  return {
    fileName: profile.fileName,
    source: profile.source,
    contentType: profile.contentType,
    size: profile.size,
    updatedAt: profile.updatedAt,
    version: profile.version,
    excerpt: profile.text.slice(0, EXCERPT_LEN),
    textChars: profile.text.length,
    truncated: profile.truncated === 1,
  };
}

function publicAssessment(row: {
  lessonNumber: number;
  profileVersion: number;
  status: "current" | "stale";
  evaluation: string;
  strengthsJson: string;
  gapsJson: string;
  focusJson: string;
  model: string;
  promptVersion: string;
  updatedAt: string;
}): CompanyAssessment {
  return {
    lessonNumber: row.lessonNumber,
    profileVersion: row.profileVersion,
    status: row.status,
    evaluation: row.evaluation,
    strengths: readList(row.strengthsJson),
    gaps: readList(row.gapsJson),
    focus: readList(row.focusJson),
    model: row.model,
    promptVersion: row.promptVersion,
    updatedAt: row.updatedAt,
  };
}

export const view = query({
  args: { ...secret, userId: v.number(), subjectId: v.optional(v.number()) },
  handler: async (ctx, args) => {
    gate(args.secret);
    const user = await actor(ctx, args.userId);
    if (!user) return { error: "missing" as const };
    const subjectId = args.subjectId ?? user.legacyId;
    if (subjectId !== user.legacyId && !isStaff(user.role)) return { error: "forbidden" as const };
    const subject = subjectId === user.legacyId ? user : await userByLegacy(ctx, subjectId);
    if (!subject || subject.active !== 1) return { error: "missing" as const };
    const profile = await currentProfile(ctx, subject.legacyId);
    const rows = await ctx.db.query("companyLessonAssessments").withIndex("by_user", (q) => q.eq("userId", subject.legacyId)).collect();
    const byLesson = new Map<number, (typeof rows)[number]>();
    for (const row of rows) {
      const prev = byLesson.get(row.lessonNumber);
      if (!prev || row.updatedAt > prev.updatedAt) byLesson.set(row.lessonNumber, row);
    }
    return {
      error: null,
      subjectName: subject.displayName,
      readOnly: subject.legacyId !== user.legacyId,
      profile: profile ? publicProfile(profile) : null,
      assessments: [...byLesson.values()].map(publicAssessment),
    };
  },
});

export const text = query({
  args: { ...secret, userId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const user = await actor(ctx, args.userId);
    if (!user) return { error: "missing" as const };
    const profile = await currentProfile(ctx, user.legacyId);
    if (!profile?.text.trim()) return { error: "empty" as const };
    return { error: null, text: profile.text, version: profile.version };
  },
});

export const prepareUpload = mutation({
  args: { ...secret, userId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const user = await actor(ctx, args.userId);
    if (!user) return { error: "missing" as const };
    return { uploadUrl: await ctx.storage.generateUploadUrl() };
  },
});

export const discardUpload = mutation({
  args: { ...secret, userId: v.number(), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    gate(args.secret);
    const user = await actor(ctx, args.userId);
    if (!user) return { ok: true as const };
    const linked = await ctx.db.query("companyProfileFiles").withIndex("by_storage", (q) => q.eq("storageId", args.storageId)).first();
    if (linked) return { ok: true as const };
    const meta = await ctx.storage.getMetadata(args.storageId);
    if (meta) await ctx.storage.delete(args.storageId);
    return { ok: true as const };
  },
});

export const commit = mutation({
  args: {
    ...secret,
    userId: v.number(),
    storageId: v.union(v.id("_storage"), v.null()),
    fileName: v.string(),
    contentType: v.string(),
    text: v.string(),
    pasteText: v.string(),
    truncated: v.number(),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    const user = await actor(ctx, args.userId);
    if (!user) return { error: "missing" as const };
    const text = args.text.trim();
    const pasteText = args.pasteText.trim();
    if (!text) return { error: "empty" as const };
    if (text.length > PROFILE_TEXT_MAX || pasteText.length > PASTE_MAX) return { error: "long" as const };
    let size = 0;
    let fileName = "paste.txt";
    let contentType = "text/plain";
    if (args.storageId) {
      const meta = await ctx.storage.getMetadata(args.storageId);
      if (!meta || meta.size <= 0) return { error: "upload" as const };
      if (meta.size > COMPANY_FILE_BYTES) {
        await ctx.storage.delete(args.storageId);
        return { error: "size" as const };
      }
      fileName = cleanFileName(args.fileName);
      if (!companyFileKind(fileName)) {
        await ctx.storage.delete(args.storageId);
        return { error: "type" as const };
      }
      size = meta.size;
      contentType = (meta.contentType || args.contentType || "application/octet-stream").slice(0, 160);
    } else if (!pasteText) {
      return { error: "empty" as const };
    } else {
      size = new TextEncoder().encode(pasteText).length;
    }
    const source: CompanySource = args.storageId && pasteText ? "both" : args.storageId ? "file" : "paste";
    const rows = await ctx.db.query("companyProfiles").withIndex("by_user", (q) => q.eq("userId", user.legacyId)).collect();
    const previous = rows.sort((a, b) => b.version - a.version)[0] ?? null;
    for (const row of rows) {
      if (previous && row._id !== previous._id) await ctx.db.delete(row._id);
    }
    const createdAt = now();
    const fileId = await nextId(ctx, "companyProfileFiles");
    // ponytail: every update keeps the previous blob in _storage. Upgrade path: prune versions older than N.
    await ctx.db.insert("companyProfileFiles", {
      legacyId: fileId,
      userId: user.legacyId,
      storageId: args.storageId,
      fileName,
      contentType,
      size,
      pasteText,
      source,
      createdAt,
    });
    const version = (previous?.version ?? 0) + 1;
    const stored = {
      fileId,
      storageId: args.storageId,
      fileName,
      contentType,
      size,
      source,
      text,
      truncated: args.truncated === 1 ? 1 : 0,
      version,
      updatedAt: createdAt,
    };
    if (previous) await ctx.db.patch(previous._id, stored);
    else await ctx.db.insert("companyProfiles", { userId: user.legacyId, ...stored });
    const assessments = await ctx.db.query("companyLessonAssessments").withIndex("by_user", (q) => q.eq("userId", user.legacyId)).collect();
    for (const row of assessments) {
      if (row.status === "current") await ctx.db.patch(row._id, { status: "stale" });
    }
    return {
      ok: true as const,
      profile: publicProfile({ ...stored, text }),
    };
  },
});

export const saveAssessment = mutation({
  args: {
    ...secret,
    userId: v.number(),
    lessonNumber: v.number(),
    profileVersion: v.number(),
    evaluation: v.string(),
    strengthsJson: v.string(),
    gapsJson: v.string(),
    focusJson: v.string(),
    model: v.string(),
    promptVersion: v.string(),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    const user = await actor(ctx, args.userId);
    if (!user) return { error: "missing" as const };
    if (!LESSONS.some((lesson) => lesson.number === args.lessonNumber)) return { error: "missing" as const };
    const profile = await currentProfile(ctx, user.legacyId);
    if (!profile?.text.trim()) return { error: "empty" as const };
    if (profile.version !== args.profileVersion) return { error: "stale" as const };
    const evaluation = args.evaluation.trim().slice(0, 800);
    if (!evaluation || args.strengthsJson.length > 4000 || args.gapsJson.length > 4000 || args.focusJson.length > 4000) {
      return { error: "long" as const };
    }
    const updatedAt = now();
    const fields = {
      profileVersion: profile.version,
      status: "current" as const,
      evaluation,
      strengthsJson: args.strengthsJson,
      gapsJson: args.gapsJson,
      focusJson: args.focusJson,
      model: args.model.slice(0, 80),
      promptVersion: args.promptVersion.slice(0, 40),
      updatedAt,
    };
    const rows = await ctx.db
      .query("companyLessonAssessments")
      .withIndex("by_user_lesson", (q) => q.eq("userId", user.legacyId).eq("lessonNumber", args.lessonNumber))
      .collect();
    const [existing, ...extra] = rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    for (const row of extra) await ctx.db.delete(row._id);
    if (existing) await ctx.db.patch(existing._id, fields);
    else await ctx.db.insert("companyLessonAssessments", { userId: user.legacyId, lessonNumber: args.lessonNumber, ...fields });
    return { ok: true as const, updatedAt };
  },
});
