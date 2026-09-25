import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canWriteLessons, completeLesson } from "@/lib/access";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || !(await canWriteLessons(user))) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const body = await request.json().catch(() => null) as { lessonNumber?: number } | null;
  if (!body?.lessonNumber) return NextResponse.json({ error: "Thiếu bài học." }, { status: 400 });
  try {
    await completeLesson(user.id, body.lessonNumber);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
