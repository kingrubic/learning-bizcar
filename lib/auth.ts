import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { api, q } from "./convex";
import { logActivity, type Role } from "./db";
import { verifyPassword } from "./password";
import type { SessionUser } from "./permissions";

export type { SessionUser };

const COOKIE = "vabix_session";
const WEEK = 60 * 60 * 24 * 14;

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return q((convex, secret) => convex.query(api.reads.sessionUser, { secret, token }));
}

export async function startSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + WEEK * 1000).toISOString();
  await q((convex, secret) => convex.mutation(api.writes.startSession, { secret, token, userId, expiresAt }));
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WEEK,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await q((convex, secret) => convex.mutation(api.writes.deleteSession, { secret, token }));
  jar.delete(COOKIE);
}

export async function loginWithPassword(username: string, password: string) {
  const lookup = await q((convex, secret) => convex.query(api.reads.loginUser, { secret, username }));
  if (lookup.recent >= 8) return { ok: false as const, error: "Quá nhiều lần thử. Vui lòng đợi 15 phút." };
  if (!lookup.user || !verifyPassword(password, lookup.user.passwordHash)) {
    await q((convex, secret) => convex.mutation(api.writes.recordLoginAttempt, { secret, username }));
    return { ok: false as const, error: "Tên đăng nhập hoặc mật khẩu chưa đúng." };
  }
  if (!lookup.user.active) return { ok: false as const, error: "Tài khoản đang tạm khóa. Liên hệ Admin VABIX." };
  await q((convex, secret) => convex.mutation(api.writes.clearLoginAttempts, { secret, username }));
  await logActivity(lookup.user.id, "login", "user", lookup.user.id);
  return { ok: true as const, userId: lookup.user.id };
}

export function requireUser(user: SessionUser | null) {
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export function assertRole(user: SessionUser, roles: Role[]) {
  if (!roles.includes(user.role)) throw new Error("FORBIDDEN");
}
