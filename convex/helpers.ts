import type { MutationCtx, QueryCtx } from "./_generated/server";

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
    mustChangePassword: user.mustChangePassword,
  };
}
