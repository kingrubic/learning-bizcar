import type { MutationCtx, QueryCtx } from "./_generated/server";
import { answerKeyFor, splitAnswerRows } from "./codes";

export function gate(secret: string) {
  const expected = process.env.APP_SECRET;
  if (!expected || secret !== expected) throw new Error("UNAUTHORIZED");
}

export function now() {
  return new Date().toISOString();
}

export async function nextId(ctx: MutationCtx, name: string) {
  const row = await ctx.db.query("counters").withIndex("by_name", (q) => q.eq("name", name)).unique();
  if (!row) {
    await ctx.db.insert("counters", { name, value: 1 });
    return 1;
  }
  const value = row.value + 1;
  await ctx.db.patch(row._id, { value });
  return value;
}

export async function userByLegacy(ctx: QueryCtx | MutationCtx, id: number) {
  return ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", id)).unique();
}

export async function lessonByLegacy(ctx: QueryCtx | MutationCtx, id: number) {
  return ctx.db.query("lessons").withIndex("by_legacy", (q) => q.eq("legacyId", id)).unique();
}

/** Stored flag is the number 1. Boolean true / "1" / missing must not keep the gate shut. */
export function passwordFlag(value: unknown): 0 | 1 {
  return value === 1 ? 1 : 0;
}

export function publicUser(user: {
  legacyId: number;
  username: string;
  displayName: string;
  role: "admin" | "mod" | "user";
  organizationId: number | null;
  departmentId: number | null;
  permissionGroupId: number | null;
  active: number;
  mustChangePassword: number;
}) {
  return {
    id: user.legacyId,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    organizationId: user.organizationId,
    departmentId: user.departmentId,
    permissionGroupId: user.permissionGroupId,
    active: user.active,
    mustChangePassword: passwordFlag(user.mustChangePassword),
  };
}

/** lessonId -> new answer key, for lessons listed in ANSWER_VERSIONS. */
export async function answerKeys(ctx: QueryCtx | MutationCtx) {
  const keys = new Map<number, string>();
  for (const lesson of await ctx.db.query("lessons").collect()) {
    const key = answerKeyFor(lesson.storageKey);
    if (key) keys.set(lesson.legacyId, key);
  }
  return (lessonId: number) => keys.get(lessonId) ?? null;
}

/**
 * Learner work as every reader should see it: new-version rows replace old rows for lessons with a
 * new answer key; old rows of those lessons come back separately (read-only). Omit userId for everyone.
 */
export async function answersView(ctx: QueryCtx | MutationCtx, userId?: number) {
  const keyOf = await answerKeys(ctx);
  const rows = userId === undefined
    ? await ctx.db.query("lessonAnswers").collect()
    : await ctx.db.query("lessonAnswers").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  const versions = userId === undefined
    ? await ctx.db.query("lessonAnswerVersions").collect()
    : await ctx.db.query("lessonAnswerVersions").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  return splitAnswerRows(rows, versions, keyOf);
}

/** The new-version row a write may touch, or null. Never returns an old lessonAnswers row. */
export async function versionRow(ctx: QueryCtx | MutationCtx, userId: number, lessonId: number, answerKey: string) {
  return ctx.db.query("lessonAnswerVersions")
    .withIndex("by_user_lesson_key", (q) => q.eq("userId", userId).eq("lessonId", lessonId).eq("answerKey", answerKey))
    .unique();
}
