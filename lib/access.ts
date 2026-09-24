import { cache } from "react";
import { api, q } from "./convex";
import { type LessonStatus, type UnlockMode } from "./db";
import type { SessionUser } from "./auth";
import { LESSONS } from "./course";

export type AnswerRow = {
  id: number;
  user_id: number;
  course_id: number;
  lesson_id: number;
  schema_version: string;
  answers_json: string;
  current_phase: string;
  phases_done_json: string;
  progress_percent: number;
  status: LessonStatus;
  completed_at: string | null;
  updated_at: string;
};

const loadState = cache(async (userId: number) => {
  const state = await q((convex, secret) => convex.query(api.reads.learnState, { secret, userId }));
  if (!state) throw new Error("CATALOG_MISSING");
  return state;
});

export async function courseRow() {
  return (await loadState(0)).course;
}

export async function lessonRows() {
  return (await loadState(0)).lessons;
}

export async function enrollmentFor(userId: number) {
  return (await loadState(userId)).enrollment ?? undefined;
}

export function canCoachSee(actor: SessionUser, learnerId: number) {
  if (actor.role === "admin" || actor.role === "mod") return true;
  if (actor.id === learnerId) return true;
  return false;
}

export async function answersFor(userId: number) {
  return (await loadState(userId)).answers as AnswerRow[];
}

export async function answerFor(userId: number, lessonId: number) {
  return (await answersFor(userId)).find((row) => row.lesson_id === lessonId);
}

const DONE = new Set(["completed", "submitted", "reviewed"]);

export async function isLessonUnlocked(userId: number, lessonNumber: number) {
  const state = await loadState(userId);
  const enrollment = state.enrollment;
  if (!enrollment) return false;
  if (enrollment.unlock_mode === "all_open") return true;
  const lesson = state.lessons.find((item) => item.number === lessonNumber);
  if (!lesson) return false;
  if (enrollment.unlock_mode === "scheduled") {
    const unlock = state.unlocks.find((item) => item.lesson_id === lesson.id);
    if (!unlock?.unlock_at) return false;
    return new Date(unlock.unlock_at).getTime() <= Date.now();
  }
  if (lessonNumber <= 1) return true;
  const previous = state.lessons.find((item) => item.number === lessonNumber - 1);
  if (!previous) return false;
  const prevAnswer = state.answers.find((item) => item.lesson_id === previous.id);
  return Boolean(prevAnswer && DONE.has(prevAnswer.status));
}

export function statusFromProgress(progress: number, explicit?: string): LessonStatus {
  if (explicit === "completed" || explicit === "submitted" || explicit === "reviewed") return explicit;
  if (progress <= 0) return "not_started";
  if (progress >= 100) return "completed";
  return "in_progress";
}

export async function saveAnswers(input: {
  userId: number;
  lessonNumber: number;
  answers: unknown;
  phase: string;
  phasesDone: string[];
  progressPercent: number;
}) {
  const state = await loadState(input.userId);
  const enrollment = state.enrollment;
  if (!enrollment || enrollment.member_role !== "learner") throw new Error("FORBIDDEN");
  if (!(await isLessonUnlocked(input.userId, input.lessonNumber))) throw new Error("LOCKED");
  const lesson = state.lessons.find((item) => item.number === input.lessonNumber);
  if (!lesson) throw new Error("NOT_FOUND");
  const existing = state.answers.find((item) => item.lesson_id === lesson.id) as AnswerRow | undefined;
  const progress = Math.max(0, Math.min(100, Math.round(input.progressPercent)));
  let status: LessonStatus = existing?.status && DONE.has(existing.status) ? existing.status : statusFromProgress(progress);
  if (existing?.status === "submitted" || existing?.status === "reviewed") status = existing.status;
  const completedAt = status === "completed" || status === "submitted" || status === "reviewed"
    ? existing?.completed_at ?? new Date().toISOString()
    : null;
  const saved = await q((convex, secret) => convex.mutation(api.writes.saveAnswers, {
    secret,
    userId: input.userId,
    lessonId: lesson.id,
    courseId: state.course.id,
    schemaVersion: lesson.schema_version,
    answersJson: JSON.stringify(input.answers ?? {}),
    phase: input.phase || "overview",
    phasesDoneJson: JSON.stringify(input.phasesDone ?? []),
    progressPercent: progress,
    status,
    completedAt,
    logComplete: status === "completed" && existing?.status !== "completed" && existing?.status !== "submitted" && existing?.status !== "reviewed",
  }));
  return saved as AnswerRow;
}

export async function completeLesson(userId: number, lessonNumber: number) {
  const state = await loadState(userId);
  const lesson = state.lessons.find((item) => item.number === lessonNumber);
  if (!lesson) throw new Error("NOT_FOUND");
  const existing = state.answers.find((item) => item.lesson_id === lesson.id);
  if (!existing) throw new Error("EMPTY");
  await q((convex, secret) => convex.mutation(api.writes.completeLesson, { secret, userId, lessonId: lesson.id }));
  return { ...existing, status: existing.status === "submitted" || existing.status === "reviewed" ? existing.status : "completed" };
}

export async function submitLesson(userId: number, lessonNumber: number) {
  const state = await loadState(userId);
  const enrollment = state.enrollment;
  if (!enrollment?.review_enabled) throw new Error("REVIEW_OFF");
  const lesson = state.lessons.find((item) => item.number === lessonNumber);
  if (!lesson) throw new Error("NOT_FOUND");
  const meta = LESSONS.find((item) => item.number === lessonNumber);
  if (!meta) throw new Error("NOT_FOUND");
  const existing = state.answers.find((item) => item.lesson_id === lesson.id);
  if (!existing) throw new Error("EMPTY");
  return q((convex, secret) => convex.mutation(api.writes.submitLesson, {
    secret,
    userId,
    lessonId: lesson.id,
    cohortId: enrollment.cohort_id,
    schemaVersion: meta.schemaVersion,
    contentVersion: meta.contentVersion,
    answersJson: existing.answers_json,
    phase: existing.current_phase,
    progressPercent: existing.progress_percent,
  }));
}

export async function courseProgress(userId: number) {
  const state = await loadState(userId);
  const byLesson = new Map(state.answers.map((row) => [row.lesson_id, row]));
  const completed = state.lessons.filter((lesson) => DONE.has(byLesson.get(lesson.id)?.status ?? "")).length;
  return { total: state.lessons.length, completed, percent: state.lessons.length ? Math.round((completed / state.lessons.length) * 100) : 0 };
}

export type { UnlockMode };
