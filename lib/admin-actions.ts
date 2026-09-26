"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "./auth";
import { api, q } from "./convex";
import { hashPassword, temporaryPassword } from "./password";
import { canCoachSee } from "./access";

async function actor(adminOnly = false) {
  const user = await getSession();
  if (!user) throw new Error("UNAUTHENTICATED");
  if (adminOnly && user.role !== "admin") throw new Error("FORBIDDEN");
  if (user.role !== "admin" && user.role !== "mod") throw new Error("FORBIDDEN");
  return user;
}

export type CreateLearnerState = { temporaryPassword?: string; error?: string; username?: string };

function actionError(error: unknown) {
  if (!(error instanceof Error)) return "Không thực hiện được.";
  const lines = error.message.split("\n").map((item) => item.trim()).filter(Boolean);
  const useful = lines.find((line) => !line.startsWith("[CONVEX") && !line.startsWith("at ") && !line.startsWith("Called by"));
  return (useful || lines[0] || "Không thực hiện được.").slice(0, 240);
}

export async function createLearner(_prev: CreateLearnerState, formData: FormData): Promise<CreateLearnerState> {
  try {
    const user = await actor(true);
    const username = String(formData.get("username") || "").trim();
    const displayName = String(formData.get("displayName") || "").trim();
    const cohortId = Number(formData.get("cohortId"));
    if (!username || !displayName || !Number.isInteger(cohortId) || cohortId <= 0) return { error: "Thiếu thông tin học viên." };
    const temp = temporaryPassword();
    const created = await q((convex, secret) => convex.mutation(api.writes.createLearner, {
      secret,
      actorId: user.id,
      username,
      passwordHash: hashPassword(temp),
      displayName,
      cohortId,
    }));
    if (!created) return { error: "Không tạo được học viên." };
    if ("error" in created) return { error: created.error };
    revalidatePath("/admin/learning/learners");
    revalidatePath("/admin/learning");
    revalidatePath("/admin/organization/users");
    return { username, temporaryPassword: temp };
  } catch (error) {
    return { error: actionError(error) };
  }
}

function adminReturnPath(value: string) {
  if (value === "/admin/learning/cohorts") return value;
  return "/admin/learning";
}

function enrollRedirect(next: string, cohortId: number, enroll: string): never {
  const params = new URLSearchParams();
  if (Number.isInteger(cohortId) && cohortId > 0) params.set("cohort", String(cohortId));
  params.set("enroll", enroll);
  redirect(`${next}?${params.toString()}`);
}

export async function enrollSelf(formData: FormData) {
  const user = await actor(true);
  const cohortId = Number(formData.get("cohortId"));
  const next = adminReturnPath(String(formData.get("next") || ""));
  if (!Number.isInteger(cohortId) || cohortId <= 0) enrollRedirect(next, cohortId, "invalid");
  const result = await q((convex, secret) => convex.mutation(api.writes.enrollSelf, {
    secret,
    actorId: user.id,
    cohortId,
  }));
  revalidatePath("/admin/learning");
  revalidatePath("/admin/learning/cohorts");
  revalidatePath("/admin/learning/learners");
  revalidatePath("/learn/dashboard");
  revalidatePath("/learn/profile");
  if ("error" in result) enrollRedirect(next, cohortId, "error");
  enrollRedirect(next, cohortId, result.status);
}

export async function setAccountActive(userId: number, active: boolean) {
  const user = await actor(true);
  await q((convex, secret) => convex.mutation(api.writes.setAccountActive, { secret, actorId: user.id, userId, active }));
  revalidatePath("/admin/learning/learners");
}

export async function deleteLearnerAccount(userId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await actor(true);
    if (!Number.isInteger(userId) || userId <= 0) return { error: "Học viên không hợp lệ." };
    if (user.id === userId) return { error: "Không xóa chính mình." };
    const result = await q((convex, secret) => convex.mutation(api.writes.deleteUserAccount, {
      secret,
      actorId: user.id,
      userId,
    }));
    if ("error" in result && result.error) return { error: result.error };
    revalidatePath("/admin/learning/learners");
    revalidatePath("/admin/learning");
    revalidatePath("/admin/organization/users");
    revalidatePath("/admin/learning/discussion");
    return { ok: true };
  } catch (error) {
    return { error: actionError(error) };
  }
}

export async function resetPassword(userId: number) {
  const user = await actor(true);
  const temp = temporaryPassword();
  await q((convex, secret) => convex.mutation(api.writes.resetPassword, { secret, actorId: user.id, userId, passwordHash: hashPassword(temp) }));
  revalidatePath("/admin/learning/learners");
  revalidatePath("/admin/organization/users");
  return temp;
}

export async function createCohort(formData: FormData) {
  const user = await actor(true);
  const name = String(formData.get("name") || "").trim();
  const courseId = Number(formData.get("courseId"));
  const mode = String(formData.get("mode") || "sequential");
  if (!name || !courseId) redirect("/admin/learning/cohorts?error=Thiếu tên lớp hoặc khoá.");
  if (mode !== "all_open" && mode !== "sequential" && mode !== "scheduled") redirect("/admin/learning/cohorts?error=Cách mở bài không hợp lệ.");
  const created = await q((convex, secret) => convex.mutation(api.writes.createCohort, { secret, actorId: user.id, name, courseId, mode }));
  if ("error" in created && created.error) redirect(`/admin/learning/cohorts?error=${encodeURIComponent(created.error)}`);
  revalidatePath("/admin/learning/cohorts");
  revalidatePath("/admin/learning");
  revalidatePath("/admin/learning/learners");
  redirect("/admin/learning/cohorts");
}

export async function cloneCourse(formData: FormData) {
  const user = await actor(true);
  const code = String(formData.get("code") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const tagline = String(formData.get("tagline") || "").trim();
  const sourceCourseId = Number(formData.get("sourceCourseId"));
  if (!code || !title || !sourceCourseId) redirect("/admin/learning/courses?error=Thiếu mã, tên hoặc khoá nguồn.");
  const created = await q((convex, secret) => convex.mutation(api.writes.cloneCourse, { secret, actorId: user.id, sourceCourseId, code, title, tagline }));
  if ("error" in created && created.error) redirect(`/admin/learning/courses?error=${encodeURIComponent(created.error)}`);
  revalidatePath("/admin/learning/courses");
  revalidatePath("/admin/learning/cohorts");
  redirect("/admin/learning/courses");
}

export async function setUnlockMode(cohortId: number, mode: string) {
  const user = await actor(true);
  if (mode !== "all_open" && mode !== "sequential" && mode !== "scheduled") throw new Error("Chế độ không hợp lệ.");
  await q((convex, secret) => convex.mutation(api.writes.setUnlockMode, { secret, actorId: user.id, cohortId, mode }));
  revalidatePath("/admin/learning/cohorts");
}

export async function setLessonUnlock(cohortId: number, lessonId: number, unlockAt: string) {
  const user = await actor(true);
  await q((convex, secret) => convex.mutation(api.writes.setLessonUnlock, {
    secret,
    actorId: user.id,
    cohortId,
    lessonId,
    unlockAt: unlockAt || null,
  }));
  revalidatePath("/admin/learning/cohorts");
}

export async function saveDepartment(formData: FormData) {
  const user = await actor(true);
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await q((convex, secret) => convex.mutation(api.writes.saveDepartment, { secret, actorId: user.id, name }));
  revalidatePath("/admin/organization/departments");
}

export async function savePermissionGroup(formData: FormData) {
  const user = await actor(true);
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const id = Number(formData.get("id") || 0);
  const menus = formData.getAll("menus").map(String);
  if (!name) return;
  await q((convex, secret) => convex.mutation(api.writes.savePermissionGroup, { secret, actorId: user.id, id, name, description, menus }));
  revalidatePath("/admin/organization/groups");
}

export type CreateAccountState = { temporaryPassword?: string; error?: string; username?: string };

export async function createAccount(_prev: CreateAccountState, formData: FormData): Promise<CreateAccountState> {
  const user = await actor(true);
  const username = String(formData.get("username") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim();
  const roleRaw = String(formData.get("role") || "");
  if (roleRaw !== "admin" && roleRaw !== "mod" && roleRaw !== "user") return { error: "Vai trò không hợp lệ." };
  if (!username || !displayName) return { error: "Thiếu thông tin tài khoản." };
  const departmentId = roleRaw === "user" ? Number(formData.get("departmentId")) || null : null;
  const groupId = roleRaw === "user" ? Number(formData.get("groupId")) || null : null;
  const temp = temporaryPassword();
  const created = await q((convex, secret) => convex.mutation(api.writes.createAccount, {
    secret,
    actorId: user.id,
    username,
    passwordHash: hashPassword(temp),
    displayName,
    role: roleRaw,
    departmentId,
    groupId,
  }));
  if ("error" in created) return { error: created.error };
  revalidatePath("/admin/organization/users");
  return { username, temporaryPassword: temp };
}

export async function assignUserAccess(formData: FormData) {
  const user = await actor(true);
  const userId = Number(formData.get("userId"));
  const departmentId = Number(formData.get("departmentId")) || null;
  const groupId = Number(formData.get("groupId")) || null;
  await q((convex, secret) => convex.mutation(api.writes.assignUserAccess, { secret, actorId: user.id, userId, departmentId, groupId }));
  revalidatePath("/admin/organization/users");
}

export async function createTask(formData: FormData) {
  const user = await actor(false);
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const assigneeId = Number(formData.get("assigneeId"));
  const dueAt = String(formData.get("dueAt") || "") || null;
  if (!title || !assigneeId) return;
  await q((convex, secret) => convex.mutation(api.writes.createTask, { secret, actorId: user.id, title, body, assigneeId, dueAt }));
  revalidatePath("/admin/tasks");
  revalidatePath("/learn/tasks");
}

export async function saveCmsBlocks(formData: FormData) {
  const user = await actor(true);
  const keys = formData.getAll("key").map(String);
  const locales = formData.getAll("locale").map(String);
  const bodies = formData.getAll("body").map(String);
  const rows = keys.map((key, index) => ({
    key,
    locale: locales[index] === "en" ? "en" as const : "vi" as const,
    body: bodies[index] ?? "",
  }));
  await q((convex, secret) => convex.mutation(api.writes.saveCmsBlocks, { secret, actorId: user.id, rows }));
  revalidatePath("/admin/cms");
  revalidatePath("/learn/dashboard");
  revalidatePath("/learn/login");
  revalidatePath("/learn/course/bmdo-k03");
}

export async function saveAnnouncement(formData: FormData) {
  const user = await actor(true);
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const locale = formData.get("locale") === "en" ? "en" : "vi";
  if (!title) return;
  await q((convex, secret) => convex.mutation(api.writes.saveAnnouncement, { secret, actorId: user.id, title, body, locale }));
  revalidatePath("/admin/cms");
  revalidatePath("/learn/dashboard");
}

export async function setAnnouncementPublished(id: number, published: boolean) {
  const user = await actor(true);
  await q((convex, secret) => convex.mutation(api.writes.setAnnouncementPublished, { secret, actorId: user.id, id, published }));
  revalidatePath("/admin/cms");
  revalidatePath("/learn/dashboard");
}

export async function saveCmsLesson(formData: FormData) {
  const user = await actor(true);
  const number = Number(formData.get("number"));
  const titleVi = String(formData.get("titleVi") || "").trim();
  const titleEn = String(formData.get("titleEn") || "").trim();
  const summaryVi = String(formData.get("summaryVi") || "").trim();
  const summaryEn = String(formData.get("summaryEn") || "").trim();
  const published = formData.get("published") === "on" ? 1 : 0;
  if (!number || !titleVi || !titleEn) return;
  await q((convex, secret) => convex.mutation(api.writes.saveCmsLesson, {
    secret, actorId: user.id, number, titleVi, titleEn, summaryVi, summaryEn, published,
  }));
  revalidatePath("/admin/cms");
  revalidatePath("/learn/dashboard");
  revalidatePath("/learn/course/bmdo-k03");
}

export async function addFeedback(submissionId: number, body: string) {
  const user = await actor(false);
  const saved = await q((convex, secret) => convex.mutation(api.writes.addFeedback, {
    secret, actorId: user.id, submissionId, body,
  }));
  if (!canCoachSee(user, saved.userId)) throw new Error("FORBIDDEN");
  revalidatePath("/admin/learning/submissions");
}
