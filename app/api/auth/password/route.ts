import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { api, q } from "@/lib/convex";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const body = await request.json().catch(() => null) as { current?: string; next?: string; confirm?: string } | null;
  if (!body?.current || !body.next || body.next !== body.confirm) {
    return NextResponse.json({ error: "Mật khẩu mới và phần xác nhận chưa khớp." }, { status: 400 });
  }
  const nextPassword = body.next;
  if (nextPassword.length < 8) return NextResponse.json({ error: "Mật khẩu mới cần ít nhất 8 ký tự." }, { status: 400 });
  const row = await q((convex, secret) => convex.query(api.reads.userFlags, { secret, id: user.id }));
  if (!row || !verifyPassword(body.current, row.password_hash)) return NextResponse.json({ error: "Mật khẩu hiện tại chưa đúng." }, { status: 400 });
  await q((convex, secret) => convex.mutation(api.writes.changePassword, { secret, userId: user.id, passwordHash: hashPassword(nextPassword) }));
  return NextResponse.json({ ok: true });
}
