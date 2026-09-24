import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { saveAnswers } from "@/lib/access";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || user.role !== "user") return NextResponse.json({ error: "Không có quyền lưu bài." }, { status: 403 });
  const body = await request.json().catch(() => null) as {
    lessonNumber?: number; answers?: unknown; phase?: string; phasesDone?: string[]; progressPercent?: number;
  } | null;
  if (!body?.lessonNumber) return NextResponse.json({ error: "Thiếu bài học." }, { status: 400 });
  try {
    const saved = await saveAnswers({
      userId: user.id,
      lessonNumber: body.lessonNumber,
      answers: body.answers ?? {},
      phase: body.phase || "overview",
      phasesDone: body.phasesDone ?? [],
      progressPercent: body.progressPercent ?? 0,
    });
    return NextResponse.json({ ok: true, updatedAt: saved.updated_at, status: saved.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    const status = message === "FORBIDDEN" ? 403 : message === "LOCKED" ? 423 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
