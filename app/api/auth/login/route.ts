import { NextResponse } from "next/server";
import { clearSession, getSession, loginWithPassword, startSession } from "@/lib/auth";
import { api, q } from "@/lib/convex";
import { logActivity } from "@/lib/db";
import { loginDestination } from "@/lib/password-gate";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Nguồn không hợp lệ." }, { status: 403 });
  const body = await request.json().catch(() => null) as { username?: string; password?: string } | null;
  if (!body?.username || !body.password) return NextResponse.json({ error: "Thiếu thông tin đăng nhập." }, { status: 400 });
  const result = await loginWithPassword(body.username.trim(), body.password);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });
  await startSession(result.userId);
  const user = await q((convex, secret) => convex.query(api.reads.userFlags, { secret, id: result.userId }));
  if (!user) return NextResponse.json({ error: "Tài khoản không còn tồn tại." }, { status: 401 });
  const next = loginDestination(user.must_change_password, user.role);
  return NextResponse.json({ ok: true, next });
}

export async function DELETE() {
  const user = await getSession();
  await clearSession();
  if (user) await logActivity(user.id, "logout", "user", user.id);
  return NextResponse.json({ ok: true });
}
