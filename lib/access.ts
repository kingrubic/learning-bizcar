import { cache } from "react";
import { lessonUnlocked, subsetProgress } from "@/convex/codes";
import { api, q } from "./convex";
import { type LessonStatus, type UnlockMode } from "./db";
import type { SessionUser } from "./auth";

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

const loadState = cache(async (userId: number, courseSlug?: string) => {
  const state = await q((convex, secret) => convex.query(api.reads.learnState, courseSlug ? { secret, userId, courseSlug } : { secret, userId }));
  if (!state) {
    if (courseSlug) return null;
    throw new Error("CATALOG_MISSING");
  }
  return state;
});

export async function courseRow() {
  return (await loadState(0))!.course;
}

export async function learningState(userId: number, courseSlug?: string) {
  return loadState(userId, courseSlug);
}

export async function lessonRows() {
  return (await loadState(0))!.lessons;
}

export async function enrollmentFor(userId: number, courseSlug?: string) {
  return (await loadState(userId, courseSlug))?.enrollment ?? undefined;
}

export async function canWriteLessons(user: SessionUser | null) {
  if (!user) return false;
  if (user.role === "user") return true;
  if (user.role !== "admin" && user.role !== "mod") return false;
  const state = await loadState(user.id);
  return Boolean(state?.enrollments.some((row) => row.member_role === "learner"));
}

export function canCoachSee(actor: SessionUser, learnerId: number) {
  if (actor.role === "admin" || actor.role === "mod") return true;
  if (actor.id === learnerId) return true;
  return false;
}

export async function answersFor(userId: number, courseSlug?: string) {
  return ((await loadState(userId, courseSlug))?.answers ?? []) as AnswerRow[];
}

export async function answerFor(userId: number, lessonId: number, courseSlug?: string) {
  return (await answersFor(userId, courseSlug)).find((row) => row.lesson_id === lessonId);
}

const DONE = new Set(["completed", "submitted", "reviewed"]);

export async function isLessonUnlocked(userId: number, lessonNumber: number, courseSlug?: string) {
  const state = await loadState(userId, courseSlug);
  const enrollment = state?.enrollment;
  if (!state || !enrollment) return false;
  const lesson = state.lessons.find((item) => item.number === lessonNumber);
  if (!lesson) return false;
  const unlock = state.unlocks.find((item) => item.lesson_id === lesson.id);
  return lessonUnlocked({
    mode: enrollment.unlock_mode,
    orderedIds: state.lessons.map((item) => item.id),
    lessonId: lesson.id,
    answers: state.answers.map((row) => ({ lessonId: row.lesson_id, status: row.status })),
    unlockAt: unlock?.unlock_at,
    nowMs: Date.now(),
  });
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
  courseSlug?: string;
}) {
  const state = await loadState(input.userId, input.courseSlug);
  const enrollment = state?.enrollment;
  if (!state || !enrollment || enrollment.member_role !== "learner") throw new Error("FORBIDDEN");
  if (!(await isLessonUnlocked(input.userId, input.lessonNumber, input.courseSlug))) throw new Error("LOCKED");
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

export async function completeLesson(userId: number, lessonNumber: number, courseSlug?: string) {
  const state = await loadState(userId, courseSlug);
  if (!state) throw new Error("NOT_FOUND");
  const lesson = state.lessons.find((item) => item.number === lessonNumber);
  if (!lesson) throw new Error("NOT_FOUND");
  const existing = state.answers.find((item) => item.lesson_id === lesson.id);
  if (!existing) throw new Error("EMPTY");
  await q((convex, secret) => convex.mutation(api.writes.completeLesson, { secret, userId, lessonId: lesson.id }));
  return { ...existing, status: existing.status === "submitted" || existing.status === "reviewed" ? existing.status : "completed" };
}

export async function submitLesson(userId: number, lessonNumber: number, courseSlug?: string) {
  const state = await loadState(userId, courseSlug);
  if (!state) throw new Error("NOT_FOUND");
  const enrollment = state.enrollment;
  if (!enrollment?.review_enabled) throw new Error("REVIEW_OFF");
  const lesson = state.lessons.find((item) => item.number === lessonNumber);
  if (!lesson) throw new Error("NOT_FOUND");
  const existing = state.answers.find((item) => item.lesson_id === lesson.id);
  if (!existing) throw new Error("EMPTY");
  return q((convex, secret) => convex.mutation(api.writes.submitLesson, {
    secret,
    userId,
    lessonId: lesson.id,
    cohortId: enrollment.cohort_id,
    schemaVersion: lesson.schema_version,
    contentVersion: lesson.content_version,
    answersJson: existing.answers_json,
    phase: existing.current_phase,
    progressPercent: existing.progress_percent,
  }));
}

export async function courseProgress(userId: number, courseSlug?: string) {
  const state = await loadState(userId, courseSlug);
  if (!state) return { total: 0, completed: 0, percent: 0 };
  return subsetProgress(
    state.lessons.map((lesson) => lesson.id),
    state.answers.map((row) => ({ lessonId: row.lesson_id, status: row.status })),
  );
}

export type { UnlockMode };
