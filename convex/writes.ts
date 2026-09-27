import { mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { BMDO_SLUG, classManagementCode, courseManagementCode, instructorManagementCode, learnerManagementCode, nextFreeCode, slugFromCode } from "./codes";
import { ensureClassChannel } from "./discussion";
import { gate, nextId, now, passwordFlag } from "./helpers";

const secret = { secret: v.string() };

function cleanCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

async function takenUserCode(ctx: MutationCtx, code: string, exceptUserId?: number) {
  const rows = await ctx.db.query("users").withIndex("by_management_code", (q) => q.eq("managementCode", code)).collect();
  return rows.some((row) => row.legacyId !== exceptUserId);
}

async function takenCourseCode(ctx: MutationCtx, code: string, exceptCourseId?: number) {
  const rows = await ctx.db.query("courses").withIndex("by_management_code", (q) => q.eq("managementCode", code)).collect();
  return rows.some((row) => row.legacyId !== exceptCourseId);
}

async function takenClassCode(ctx: MutationCtx, code: string, exceptCohortId?: number) {
  const rows = await ctx.db.query("cohorts").withIndex("by_code", (q) => q.eq("code", code)).collect();
  return rows.some((row) => row.legacyId !== exceptCohortId);
}

async function freshCourseCode(ctx: MutationCtx, preferred: string) {
  const taken = new Set<string>();
  let code = preferred;
  for (let i = 0; i < 20 && code; i += 1) {
    if (!(await takenCourseCode(ctx, code))) return code;
    taken.add(code);
    code = nextFreeCode(preferred, taken);
  }
  return "";
}

async function freshUserCode(ctx: MutationCtx, preferred: string) {
  const taken = new Set<string>();
  let code = preferred;
  for (let i = 0; i < 20 && code; i += 1) {
    if (!(await takenUserCode(ctx, code))) return code;
    taken.add(code);
    code = nextFreeCode(preferred, taken);
  }
  return preferred;
}

async function ensureUserCode(ctx: MutationCtx, userId: number, generated: string) {
  const user = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", userId)).unique();
  if (!user || user.managementCode) return;
  const code = await freshUserCode(ctx, generated);
  if (!code) return;
  await ctx.db.patch(user._id, { managementCode: code, updatedAt: now() });
}

async function nextClassCode(ctx: MutationCtx, courseCode: string, courseId: number) {
  const existing = (await ctx.db.query("cohorts").collect()).filter((row) => row.courseId === courseId);
  let seq = existing.length + 1;
  for (let i = 0; i < 40; i += 1) {
    const code = classManagementCode(courseCode, seq);
    if (code && !(await takenClassCode(ctx, code))) return code;
    seq += 1;
  }
  return "";
}

async function replaceClassLessons(ctx: MutationCtx, cohortId: number, lessonIds: number[]) {
  const existing = await ctx.db.query("cohortLessons").withIndex("by_cohort", (q) => q.eq("cohortId", cohortId)).collect();
  for (const row of existing) await ctx.db.delete(row._id);
  let order = 0;
  for (const lessonId of lessonIds) {
    order += 1;
    await ctx.db.insert("cohortLessons", { cohortId, lessonId, sortOrder: order });
  }
}

async function log(ctx: Parameters<typeof nextId>[0], actorId: number | null, action: string, targetType?: string, targetId?: string, detail?: string) {
  const id = await nextId(ctx, "activityLogs");
  await ctx.db.insert("activityLogs", {
    legacyId: id,
    actorId,
    action,
    targetType: targetType ?? null,
    targetId: targetId ?? null,
    detail: detail ?? null,
    createdAt: now(),
  });
}

export const recordLoginAttempt = mutation({
  args: { ...secret, username: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    await ctx.db.insert("loginAttempts", { usernameLower: args.username.trim().toLowerCase(), createdAt: now() });
  },
});

export const clearLoginAttempts = mutation({
  args: { ...secret, username: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const rows = await ctx.db.query("loginAttempts").withIndex("by_username", (q) => q.eq("usernameLower", args.username.trim().toLowerCase())).collect();
    for (const row of rows) await ctx.db.delete(row._id);
  },
});

export const logActivity = mutation({
  args: {
    ...secret,
    actorId: v.union(v.number(), v.null()),
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    await log(ctx, args.actorId, args.action, args.targetType, args.targetId, args.detail);
  },
});

export const startSession = mutation({
  args: { ...secret, token: v.string(), userId: v.number(), expiresAt: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    await ctx.db.insert("sessions", { token: args.token, userId: args.userId, createdAt: now(), expiresAt: args.expiresAt });
  },
});

export const deleteSession = mutation({
  args: { ...secret, token: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const row = await ctx.db.query("sessions").withIndex("by_token", (q) => q.eq("token", args.token)).unique();
    if (row) await ctx.db.delete(row._id);
  },
});

export const changePassword = mutation({
  args: { ...secret, userId: v.number(), passwordHash: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const user = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", args.userId)).unique();
    if (!user) throw new Error("NOT_FOUND");
    await ctx.db.patch(user._id, { passwordHash: args.passwordHash, mustChangePassword: 0, updatedAt: now() });
    const saved = await ctx.db.get(user._id);
    if (!saved || passwordFlag(saved.mustChangePassword) !== 0) throw new Error("FLAG_NOT_CLEARED");
    await log(ctx, args.userId, "password_change", "user", String(args.userId));
    return { mustChangePassword: 0 as const, role: saved.role };
  },
});

export const createLearner = mutation({
  args: {
    ...secret,
    actorId: v.number(),
    username: v.string(),
    passwordHash: v.string(),
    displayName: v.string(),
    cohortId: v.number(),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    const username = args.username.trim();
    const displayName = args.displayName.trim();
    const usernameLower = username.toLowerCase();
    if (!username || !displayName || !Number.isInteger(args.cohortId) || args.cohortId <= 0) {
      return { error: "Thiếu thông tin học viên." as const };
    }
    // .unique() throws when duplicates exist and the admin only saw a generic server error.
    const taken = await ctx.db.query("users").withIndex("by_username", (q) => q.eq("usernameLower", usernameLower)).take(1);
    if (taken.length > 0) return { error: "Tên đăng nhập đã tồn tại." as const };
    const cohort = (await ctx.db.query("cohorts").withIndex("by_legacy", (q) => q.eq("legacyId", args.cohortId)).take(1))[0];
    if (!cohort || typeof cohort.courseId !== "number") return { error: "Cohort không tồn tại." as const };
    const stamp = now();
    const userId = await nextId(ctx, "users");
    const group = (await ctx.db.query("permissionGroups").withIndex("by_name", (q) => q.eq("name", "Học viên")).take(1))[0];
    const department = (await ctx.db.query("departments").collect()).find((row) => row.name === "Học viên BMDO");
    await ctx.db.insert("users", {
      legacyId: userId,
      username,
      usernameLower,
      passwordHash: args.passwordHash,
      displayName,
      role: "user",
      departmentId: department?.legacyId ?? null,
      permissionGroupId: group?.legacyId ?? null,
      organizationId: typeof cohort.organizationId === "number" ? cohort.organizationId : null,
      active: 1,
      mustChangePassword: 1,
      createdAt: stamp,
      updatedAt: stamp,
      managementCode: await freshUserCode(ctx, learnerManagementCode(userId)),
    });
    const enrollmentId = await nextId(ctx, "enrollments");
    await ctx.db.insert("enrollments", {
      legacyId: enrollmentId,
      userId,
      cohortId: cohort.legacyId,
      courseId: cohort.courseId,
      memberRole: "learner",
      createdAt: stamp,
    });
    await ensureClassChannel(ctx, cohort.legacyId, args.actorId);
    await log(ctx, args.actorId, "enrollment", "user", String(userId), username);
    return { id: userId };
  },
});

export const enrollSelf = mutation({
  args: { ...secret, actorId: v.number(), cohortId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const actor = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", args.actorId)).unique();
    if (!actor || actor.active !== 1 || actor.role !== "admin") {
      return { error: "Chỉ quản trị đang hoạt động mới tự ghi danh." as const };
    }
    const cohort = await ctx.db.query("cohorts").withIndex("by_legacy", (q) => q.eq("legacyId", args.cohortId)).unique();
    if (!cohort) return { error: "Cohort không tồn tại." as const };
    const seats = (await ctx.db.query("enrollments").withIndex("by_user", (q) => q.eq("userId", actor.legacyId)).collect())
      .filter((row) => row.memberRole === "learner");
    const same = seats.find((row) => row.cohortId === cohort.legacyId);
    if (same) return { status: "already" as const, cohortId: cohort.legacyId, cohortName: cohort.name };
    const enrollmentId = await nextId(ctx, "enrollments");
    await ctx.db.insert("enrollments", {
      legacyId: enrollmentId,
      userId: actor.legacyId,
      cohortId: cohort.legacyId,
      courseId: cohort.courseId,
      memberRole: "learner",
      createdAt: now(),
    });
    await log(ctx, actor.legacyId, "enrollment", "user", String(actor.legacyId), `self:${cohort.name}`);
    return { status: "enrolled" as const, cohortId: cohort.legacyId, cohortName: cohort.name };
  },
});

export const setAccountActive = mutation({
  args: { ...secret, actorId: v.number(), userId: v.number(), active: v.boolean() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const user = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", args.userId)).unique();
    if (!user || user.role === "admin") return;
    await ctx.db.patch(user._id, { active: args.active ? 1 : 0, updatedAt: now() });
    if (!args.active) {
      const sessions = await ctx.db.query("sessions").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
      for (const session of sessions) await ctx.db.delete(session._id);
    }
    await log(ctx, args.actorId, "account_status", "user", String(args.userId), args.active ? "active" : "inactive");
  },
});

export const resetPassword = mutation({
  args: { ...secret, actorId: v.number(), userId: v.number(), passwordHash: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const user = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", args.userId)).unique();
    if (!user) throw new Error("NOT_FOUND");
    await ctx.db.patch(user._id, { passwordHash: args.passwordHash, mustChangePassword: 1, updatedAt: now() });
    const sessions = await ctx.db.query("sessions").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
    for (const session of sessions) await ctx.db.delete(session._id);
    await log(ctx, args.actorId, "password_reset", "user", String(args.userId));
  },
});

// ponytail: membership and submissions have no by-user index. A class-sized scan is enough;
// add those indexes if a wipe hits Convex's transaction limit, then rerun (admins are kept).
async function purgeUserOwned(ctx: MutationCtx, userId: number, usernameLower: string) {
  const sessions = await ctx.db.query("sessions").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  for (const row of sessions) await ctx.db.delete(row._id);
  const attempts = await ctx.db.query("loginAttempts").withIndex("by_username", (q) => q.eq("usernameLower", usernameLower)).collect();
  for (const row of attempts) await ctx.db.delete(row._id);
  const enrollments = await ctx.db.query("enrollments").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  for (const row of enrollments) await ctx.db.delete(row._id);
  const answers = await ctx.db.query("lessonAnswers").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  for (const row of answers) await ctx.db.delete(row._id);
  const submissions = (await ctx.db.query("lessonSubmissions").collect()).filter((row) => row.userId === userId);
  for (const row of submissions) {
    const notes = await ctx.db.query("coachFeedback").withIndex("by_submission", (q) => q.eq("submissionId", row.legacyId)).collect();
    for (const note of notes) await ctx.db.delete(note._id);
    await ctx.db.delete(row._id);
  }
  const tasks = await ctx.db.query("tasks").withIndex("by_assignee", (q) => q.eq("assigneeId", userId)).collect();
  for (const row of tasks) await ctx.db.delete(row._id);
  const notifications = await ctx.db.query("notifications").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  for (const row of notifications) await ctx.db.delete(row._id);
  const members = (await ctx.db.query("discussionMembers").collect()).filter((row) => row.userId === userId);
  for (const row of members) await ctx.db.delete(row._id);
}

export const deleteUserAccount = mutation({
  args: { ...secret, actorId: v.number(), userId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const actor = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", args.actorId)).unique();
    if (!actor || actor.role !== "admin" || actor.active !== 1) return { error: "Không có quyền." as const };
    const user = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", args.userId)).unique();
    if (!user) return { error: "Không tìm thấy tài khoản." as const };
    if (user.role === "admin") return { error: "Không xóa tài khoản quản trị." as const };
    if (user.legacyId === actor.legacyId) return { error: "Không xóa chính mình." as const };
    await purgeUserOwned(ctx, user.legacyId, user.usernameLower);
    await ctx.db.delete(user._id);
    await log(ctx, actor.legacyId, "user_delete", "user", String(user.legacyId), user.username);
    return { ok: true as const };
  },
});

/**
 * Delete every non-admin and their enrollments, progress, sessions, and discussion
 * membership. Courses, lessons, cohorts, and channels stay. Refuses when no admin remains.
 *
 *   npx convex run writes:wipeNonAdmins '{"secret":"<APP_SECRET>"}'
 */
export const wipeNonAdmins = mutation({
  args: secret,
  handler: async (ctx, args) => {
    gate(args.secret);
    const users = await ctx.db.query("users").collect();
    const admins = users.filter((user) => user.role === "admin");
    if (admins.length === 0) return { error: "Không còn admin, dừng wipe." as const };
    let deleted = 0;
    for (const user of users) {
      if (user.role === "admin") continue;
      await purgeUserOwned(ctx, user.legacyId, user.usernameLower);
      await ctx.db.delete(user._id);
      deleted += 1;
    }
    return { deleted, keptAdmins: admins.length };
  },
});

const unlockMode = v.union(v.literal("all_open"), v.literal("sequential"), v.literal("scheduled"));

export const saveCohort = mutation({
  args: {
    ...secret,
    actorId: v.number(),
    cohortId: v.optional(v.number()),
    name: v.string(),
    courseId: v.number(),
    mode: unlockMode,
    code: v.optional(v.string()),
    instructorId: v.number(),
    lessonIds: v.array(v.number()),
    instructorCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    const name = args.name.trim();
    if (!name) return { error: "Thiếu tên lớp." as const };
    const course = await ctx.db.query("courses").withIndex("by_legacy", (q) => q.eq("legacyId", args.courseId)).unique();
    if (!course) return { error: "Khoá không tồn tại." as const };
    const instructor = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", args.instructorId)).unique();
    if (!instructor || instructor.active !== 1) return { error: "Chọn một giảng viên đang hoạt động." as const };
    const catalog = (await ctx.db.query("lessons").withIndex("by_course_number", (q) => q.eq("courseId", course.legacyId)).collect())
      .sort((a, b) => (a.sortOrder ?? a.number) - (b.sortOrder ?? b.number) || a.number - b.number);
    const allowed = new Set(catalog.map((row) => row.legacyId));
    const picked = args.lessonIds.filter((id) => allowed.has(id));
    const lessonIds = catalog.filter((row) => picked.includes(row.legacyId)).map((row) => row.legacyId);
    if (lessonIds.length === 0) return { error: "Chọn ít nhất một buổi của khoá." as const };
    const requested = cleanCode(args.code || "");
    const code = requested || await nextClassCode(ctx, course.code, course.legacyId);
    if (!code) return { error: "Không tạo được mã lớp." as const };
    if (await takenClassCode(ctx, code, args.cohortId)) return { error: "Mã lớp đã được dùng." as const };
    const instructorCode = cleanCode(args.instructorCode || "");
    if (instructorCode) {
      if (instructorCode.length > 40) return { error: "Mã giảng viên không hợp lệ." as const };
      if (await takenUserCode(ctx, instructorCode, instructor.legacyId)) return { error: "Mã giảng viên đã được dùng." as const };
      if (instructor.managementCode !== instructorCode) await ctx.db.patch(instructor._id, { managementCode: instructorCode, updatedAt: now() });
    } else await ensureUserCode(ctx, instructor.legacyId, instructorManagementCode(instructor.legacyId));
    const cohortId = args.cohortId;
    if (cohortId) {
      const cohort = await ctx.db.query("cohorts").withIndex("by_legacy", (q) => q.eq("legacyId", cohortId)).unique();
      if (!cohort) return { error: "Lớp không tồn tại." as const };
      await ctx.db.patch(cohort._id, {
        name,
        courseId: course.legacyId,
        unlockMode: args.mode,
        code,
        instructorId: instructor.legacyId,
        lessonsScoped: 1,
      });
      await replaceClassLessons(ctx, cohort.legacyId, lessonIds);
      const stale = (await ctx.db.query("lessonUnlocks").collect()).filter((row) => row.cohortId === cohort.legacyId && !lessonIds.includes(row.lessonId));
      for (const row of stale) await ctx.db.delete(row._id);
      await log(ctx, args.actorId, "cohort_update", "cohort", String(cohort.legacyId), name);
      return { id: cohort.legacyId };
    }
    const org = await ctx.db.query("organizations").withIndex("by_legacy").first();
    if (!org) return { error: "Chưa có tổ chức." as const };
    const id = await nextId(ctx, "cohorts");
    await ctx.db.insert("cohorts", {
      legacyId: id,
      organizationId: org.legacyId,
      courseId: course.legacyId,
      name,
      unlockMode: args.mode,
      reviewEnabled: 1,
      createdAt: now(),
      code,
      instructorId: instructor.legacyId,
      lessonsScoped: 1,
    });
    await replaceClassLessons(ctx, id, lessonIds);
    await ensureClassChannel(ctx, id, args.actorId);
    await log(ctx, args.actorId, "cohort_create", "cohort", String(id), name);
    return { id };
  },
});

export const cloneCourse = mutation({
  args: {
    ...secret,
    actorId: v.number(),
    sourceCourseId: v.number(),
    code: v.string(),
    title: v.string(),
    tagline: v.string(),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    const code = args.code.trim();
    const title = args.title.trim();
    if (!code || !title) return { error: "Thiếu mã hoặc tên khoá." as const };
    const slug = code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) return { error: "Mã khoá không hợp lệ." as const };
    const taken = await ctx.db.query("courses").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    if (taken) return { error: "Mã khoá đã tồn tại." as const };
    const source = await ctx.db.query("courses").withIndex("by_legacy", (q) => q.eq("legacyId", args.sourceCourseId)).unique();
    if (!source) return { error: "Khoá nguồn không tồn tại." as const };
    const managementCode = await freshCourseCode(ctx, courseManagementCode(code));
    if (!managementCode) return { error: "Không tạo được mã khoá." as const };
    const courseId = await nextId(ctx, "courses");
    await ctx.db.insert("courses", {
      legacyId: courseId,
      slug,
      code,
      title,
      tagline: args.tagline.trim() || source.tagline,
      intro: source.intro ?? "",
      managementCode,
    });
    const lessons = (await ctx.db.query("lessons").collect())
      .filter((row) => row.courseId === source.legacyId)
      .sort((a, b) => (a.sortOrder ?? a.number) - (b.sortOrder ?? b.number) || a.number - b.number);
    for (const lesson of lessons) {
      const lessonId = await nextId(ctx, "lessons");
      await ctx.db.insert("lessons", {
        legacyId: lessonId,
        courseId,
        number: lesson.number,
        title: lesson.title,
        framework: lesson.framework,
        summary: lesson.summary,
        groupName: lesson.groupName,
        hasReport: lesson.hasReport,
        storageKey: lesson.storageKey,
        contentVersion: lesson.contentVersion,
        schemaVersion: lesson.schemaVersion,
        archived: lesson.archived === 1 ? 1 : 0,
        sortOrder: lesson.sortOrder ?? lesson.number,
      });
    }
    await log(ctx, args.actorId, "course_clone", "course", String(courseId), `${source.code} → ${code}`);
    return { id: courseId, lessons: lessons.length };
  },
});

export const saveCourse = mutation({
  args: {
    ...secret,
    actorId: v.number(),
    courseId: v.optional(v.number()),
    code: v.string(),
    title: v.string(),
    tagline: v.string(),
    intro: v.string(),
    managementCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    const code = args.code.trim();
    const title = args.title.trim();
    if (!code || !title) return { error: "Thiếu mã hoặc tên khoá." as const };
    const requested = cleanCode(args.managementCode || "") || courseManagementCode(code);
    if (!requested) return { error: "Không tạo được mã khoá." as const };
    if (await takenCourseCode(ctx, requested, args.courseId)) return { error: "Mã khoá đã được dùng." as const };
    const fields = { code, title, tagline: args.tagline.trim(), intro: args.intro.trim(), managementCode: requested };
    const editingId = args.courseId;
    if (editingId) {
      const course = await ctx.db.query("courses").withIndex("by_legacy", (q) => q.eq("legacyId", editingId)).unique();
      if (!course) return { error: "Khoá không tồn tại." as const };
      await ctx.db.patch(course._id, fields);
      await log(ctx, args.actorId, "course_update", "course", String(course.legacyId), code);
      return { id: course.legacyId };
    }
    const slug = slugFromCode(code);
    if (!slug) return { error: "Mã khoá không hợp lệ." as const };
    const slugOwner = await ctx.db.query("courses").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    if (slugOwner) return { error: "Mã khoá đã tồn tại." as const };
    const courseId = await nextId(ctx, "courses");
    await ctx.db.insert("courses", { legacyId: courseId, slug, ...fields });
    await log(ctx, args.actorId, "course_create", "course", String(courseId), code);
    return { id: courseId };
  },
});

export const addCourseLesson = mutation({
  args: {
    ...secret,
    actorId: v.number(),
    courseId: v.number(),
    title: v.string(),
    framework: v.string(),
    summary: v.string(),
    groupName: v.string(),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    const title = args.title.trim();
    if (!title) return { error: "Thiếu tên buổi." as const };
    const course = await ctx.db.query("courses").withIndex("by_legacy", (q) => q.eq("legacyId", args.courseId)).unique();
    if (!course) return { error: "Khoá không tồn tại." as const };
    const existing = await ctx.db.query("lessons").withIndex("by_course_number", (q) => q.eq("courseId", course.legacyId)).collect();
    const number = existing.reduce((max, row) => Math.max(max, row.number), 0) + 1;
    const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder ?? row.number), 0) + 1;
    const lessonId = await nextId(ctx, "lessons");
    await ctx.db.insert("lessons", {
      legacyId: lessonId,
      courseId: course.legacyId,
      number,
      title,
      framework: args.framework.trim() || "Buổi học",
      summary: args.summary.trim(),
      groupName: args.groupName.trim() || "CATALOG",
      hasReport: 0,
      storageKey: `${course.slug}-buoi${String(number).padStart(2, "0")}`,
      contentVersion: now().slice(0, 7).replace("-", "."),
      schemaVersion: "1",
      archived: 0,
      sortOrder,
    });
    await log(ctx, args.actorId, "lesson_add", "lesson", String(lessonId), title);
    return { id: lessonId, number };
  },
});

export const updateCourseLesson = mutation({
  args: {
    ...secret,
    actorId: v.number(),
    lessonId: v.number(),
    title: v.string(),
    framework: v.string(),
    summary: v.string(),
    groupName: v.string(),
    archived: v.boolean(),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    const lesson = await ctx.db.query("lessons").withIndex("by_legacy", (q) => q.eq("legacyId", args.lessonId)).unique();
    if (!lesson) return { error: "Buổi không tồn tại." as const };
    const title = args.title.trim();
    if (!title) return { error: "Thiếu tên buổi." as const };
    await ctx.db.patch(lesson._id, {
      title,
      framework: args.framework.trim() || lesson.framework,
      summary: args.summary.trim(),
      groupName: args.groupName.trim() || lesson.groupName,
      archived: args.archived ? 1 : 0,
      sortOrder: lesson.sortOrder ?? lesson.number,
    });
    await log(ctx, args.actorId, "lesson_update", "lesson", String(lesson.legacyId), title);
    return { id: lesson.legacyId };
  },
});

export const moveCourseLesson = mutation({
  args: { ...secret, actorId: v.number(), lessonId: v.number(), direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, args) => {
    gate(args.secret);
    const lesson = await ctx.db.query("lessons").withIndex("by_legacy", (q) => q.eq("legacyId", args.lessonId)).unique();
    if (!lesson) return { error: "Buổi không tồn tại." as const };
    const rows = (await ctx.db.query("lessons").withIndex("by_course_number", (q) => q.eq("courseId", lesson.courseId)).collect())
      .sort((a, b) => (a.sortOrder ?? a.number) - (b.sortOrder ?? b.number) || a.number - b.number);
    const index = rows.findIndex((row) => row.legacyId === lesson.legacyId);
    const swap = args.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swap < 0 || swap >= rows.length) return { id: lesson.legacyId };
    const next = rows[swap];
    const orderA = index + 1;
    const orderB = swap + 1;
    await ctx.db.patch(lesson._id, { sortOrder: orderB });
    await ctx.db.patch(next._id, { sortOrder: orderA });
    for (let i = 0; i < rows.length; i += 1) {
      if (i === index || i === swap) continue;
      const row = rows[i];
      if ((row.sortOrder ?? row.number) !== i + 1) await ctx.db.patch(row._id, { sortOrder: i + 1 });
    }
    await log(ctx, args.actorId, "lesson_reorder", "lesson", String(lesson.legacyId), args.direction);
    return { id: lesson.legacyId };
  },
});

export const enrollLearner = mutation({
  args: { ...secret, actorId: v.number(), userId: v.number(), cohortId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const user = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", args.userId)).unique();
    if (!user || user.active !== 1) return { error: "Tài khoản không hoạt động." as const };
    const cohort = await ctx.db.query("cohorts").withIndex("by_legacy", (q) => q.eq("legacyId", args.cohortId)).unique();
    if (!cohort) return { error: "Lớp không tồn tại." as const };
    const seats = await ctx.db.query("enrollments").withIndex("by_user", (q) => q.eq("userId", user.legacyId)).collect();
    if (seats.some((row) => row.memberRole === "learner" && row.cohortId === cohort.legacyId)) {
      return { status: "already" as const };
    }
    const enrollmentId = await nextId(ctx, "enrollments");
    await ctx.db.insert("enrollments", {
      legacyId: enrollmentId,
      userId: user.legacyId,
      cohortId: cohort.legacyId,
      courseId: cohort.courseId,
      memberRole: "learner",
      createdAt: now(),
    });
    if (!user.managementCode) await ensureUserCode(ctx, user.legacyId, user.role === "user" ? learnerManagementCode(user.legacyId) : instructorManagementCode(user.legacyId));
    await ensureClassChannel(ctx, cohort.legacyId, args.actorId);
    await log(ctx, args.actorId, "enrollment", "user", String(user.legacyId), cohort.name);
    return { status: "enrolled" as const };
  },
});

export const unenrollLearner = mutation({
  args: { ...secret, actorId: v.number(), userId: v.number(), cohortId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const seats = await ctx.db.query("enrollments").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
    const seat = seats.find((row) => row.memberRole === "learner" && row.cohortId === args.cohortId);
    if (!seat) return { error: "Học viên không ở lớp này." as const };
    await ctx.db.delete(seat._id);
    await log(ctx, args.actorId, "unenroll", "user", String(args.userId), String(args.cohortId));
    return { ok: true as const };
  },
});

export const setManagementCode = mutation({
  args: { ...secret, actorId: v.number(), userId: v.number(), code: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const user = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", args.userId)).unique();
    if (!user) return { error: "Không tìm thấy tài khoản." as const };
    const code = cleanCode(args.code);
    if (!code || code.length > 40) return { error: "Mã không hợp lệ." as const };
    if (await takenUserCode(ctx, code, user.legacyId)) return { error: "Mã đã được dùng." as const };
    await ctx.db.patch(user._id, { managementCode: code, updatedAt: now() });
    await log(ctx, args.actorId, "management_code", "user", String(user.legacyId), code);
    return { code };
  },
});

export const setUnlockMode = mutation({
  args: { ...secret, actorId: v.number(), cohortId: v.number(), mode: v.union(v.literal("all_open"), v.literal("sequential"), v.literal("scheduled")) },
  handler: async (ctx, args) => {
    gate(args.secret);
    const cohort = await ctx.db.query("cohorts").withIndex("by_legacy", (q) => q.eq("legacyId", args.cohortId)).unique();
    if (!cohort) throw new Error("NOT_FOUND");
    await ctx.db.patch(cohort._id, { unlockMode: args.mode });
    await log(ctx, args.actorId, "unlock_mode", "cohort", String(args.cohortId), args.mode);
  },
});

export const setLessonUnlock = mutation({
  args: { ...secret, actorId: v.number(), cohortId: v.number(), lessonId: v.number(), unlockAt: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    gate(args.secret);
    const existing = await ctx.db.query("lessonUnlocks").withIndex("by_cohort_lesson", (q) => q.eq("cohortId", args.cohortId).eq("lessonId", args.lessonId)).unique();
    if (existing) await ctx.db.patch(existing._id, { unlockAt: args.unlockAt });
    else await ctx.db.insert("lessonUnlocks", { cohortId: args.cohortId, lessonId: args.lessonId, unlockAt: args.unlockAt });
    await log(ctx, args.actorId, "lesson_unlock", "lesson", String(args.lessonId), args.unlockAt ?? "");
  },
});

export const saveDepartment = mutation({
  args: { ...secret, actorId: v.number(), name: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const org = await ctx.db.query("organizations").withIndex("by_legacy").first();
    if (!org) throw new Error("NOT_FOUND");
    const id = await nextId(ctx, "departments");
    await ctx.db.insert("departments", { legacyId: id, organizationId: org.legacyId, name: args.name, createdAt: now() });
    await log(ctx, args.actorId, "department_create", "department", args.name);
  },
});

export const savePermissionGroup = mutation({
  args: { ...secret, actorId: v.number(), id: v.number(), name: v.string(), description: v.string(), menus: v.array(v.string()) },
  handler: async (ctx, args) => {
    gate(args.secret);
    let groupId = args.id;
    if (groupId) {
      const group = await ctx.db.query("permissionGroups").withIndex("by_legacy", (q) => q.eq("legacyId", groupId)).unique();
      if (!group) throw new Error("NOT_FOUND");
      await ctx.db.patch(group._id, { name: args.name, description: args.description });
    } else {
      groupId = await nextId(ctx, "permissionGroups");
      await ctx.db.insert("permissionGroups", { legacyId: groupId, name: args.name, description: args.description, createdAt: now() });
    }
    const links = await ctx.db.query("permissionGroupMenus").withIndex("by_group", (q) => q.eq("groupId", groupId)).collect();
    for (const link of links) await ctx.db.delete(link._id);
    for (const menuKey of args.menus) await ctx.db.insert("permissionGroupMenus", { groupId, menuKey });
    await log(ctx, args.actorId, "permission_group", "permission_group", String(groupId), args.name);
  },
});

export const createAccount = mutation({
  args: {
    ...secret,
    actorId: v.number(),
    username: v.string(),
    passwordHash: v.string(),
    displayName: v.string(),
    role: v.union(v.literal("admin"), v.literal("mod"), v.literal("user")),
    departmentId: v.union(v.number(), v.null()),
    groupId: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    const username = args.username.trim();
    const displayName = args.displayName.trim();
    if (!username || !displayName) return { error: "Thiếu thông tin tài khoản." as const };
    const usernameLower = username.toLowerCase();
    const taken = await ctx.db.query("users").withIndex("by_username", (q) => q.eq("usernameLower", usernameLower)).unique();
    if (taken) return { error: "Tên đăng nhập đã tồn tại." as const };
    let departmentId: number | null = null;
    let groupId: number | null = null;
    if (args.role === "user") {
      if (args.departmentId) {
        const department = await ctx.db.query("departments").withIndex("by_legacy", (q) => q.eq("legacyId", args.departmentId as number)).unique();
        if (!department) return { error: "Phòng ban không tồn tại." as const };
        departmentId = department.legacyId;
      }
      if (args.groupId) {
        const group = await ctx.db.query("permissionGroups").withIndex("by_legacy", (q) => q.eq("legacyId", args.groupId as number)).unique();
        if (!group) return { error: "Nhóm quyền không tồn tại." as const };
        groupId = group.legacyId;
      }
    }
    const org = await ctx.db.query("organizations").withIndex("by_legacy").first();
    if (!org) throw new Error("NOT_FOUND");
    const stamp = now();
    const userId = await nextId(ctx, "users");
    await ctx.db.insert("users", {
      legacyId: userId,
      username,
      usernameLower,
      passwordHash: args.passwordHash,
      displayName,
      role: args.role,
      departmentId,
      permissionGroupId: groupId,
      organizationId: org.legacyId,
      active: 1,
      mustChangePassword: 1,
      createdAt: stamp,
      updatedAt: stamp,
      managementCode: await freshUserCode(ctx, args.role === "user" ? learnerManagementCode(userId) : instructorManagementCode(userId)),
    });
    await log(ctx, args.actorId, "user_create", "user", String(userId), username);
    return { id: userId };
  },
});

export const assignUserAccess = mutation({
  args: { ...secret, actorId: v.number(), userId: v.number(), departmentId: v.union(v.number(), v.null()), groupId: v.union(v.number(), v.null()) },
  handler: async (ctx, args) => {
    gate(args.secret);
    const user = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", args.userId)).unique();
    if (!user || user.role !== "user") return;
    await ctx.db.patch(user._id, { departmentId: args.departmentId, permissionGroupId: args.groupId, updatedAt: now() });
    await log(ctx, args.actorId, "user_access", "user", String(args.userId));
  },
});

export const createTask = mutation({
  args: { ...secret, actorId: v.number(), title: v.string(), body: v.string(), assigneeId: v.number(), dueAt: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    gate(args.secret);
    const id = await nextId(ctx, "tasks");
    await ctx.db.insert("tasks", {
      legacyId: id,
      title: args.title,
      body: args.body,
      assigneeId: args.assigneeId,
      authorId: args.actorId,
      status: "open",
      dueAt: args.dueAt,
      createdAt: now(),
    });
    await log(ctx, args.actorId, "task_create", "user", String(args.assigneeId), args.title);
  },
});

export const saveCmsBlocks = mutation({
  args: { ...secret, actorId: v.number(), rows: v.array(v.object({ key: v.string(), locale: v.union(v.literal("vi"), v.literal("en")), body: v.string() })) },
  handler: async (ctx, args) => {
    gate(args.secret);
    for (const row of args.rows) {
      const existing = await ctx.db.query("cmsBlocks").withIndex("by_key_locale", (q) => q.eq("key", row.key).eq("locale", row.locale)).unique();
      if (existing) await ctx.db.patch(existing._id, { body: row.body, updatedAt: now() });
    }
    await log(ctx, args.actorId, "cms_blocks", "cms", "blocks");
  },
});

export const saveAnnouncement = mutation({
  args: { ...secret, actorId: v.number(), title: v.string(), body: v.string(), locale: v.union(v.literal("vi"), v.literal("en")) },
  handler: async (ctx, args) => {
    gate(args.secret);
    const id = await nextId(ctx, "cmsAnnouncements");
    await ctx.db.insert("cmsAnnouncements", { legacyId: id, title: args.title, body: args.body, locale: args.locale, published: 1, createdAt: now() });
    await log(ctx, args.actorId, "cms_announcement", "cms", args.locale, args.title);
  },
});

export const setAnnouncementPublished = mutation({
  args: { ...secret, actorId: v.number(), id: v.number(), published: v.boolean() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const row = await ctx.db.query("cmsAnnouncements").withIndex("by_legacy", (q) => q.eq("legacyId", args.id)).unique();
    if (!row) return;
    await ctx.db.patch(row._id, { published: args.published ? 1 : 0 });
    await log(ctx, args.actorId, "cms_announcement", "cms", String(args.id), args.published ? "published" : "hidden");
  },
});

export const saveCmsLesson = mutation({
  args: {
    ...secret,
    actorId: v.number(),
    number: v.number(),
    titleVi: v.string(),
    titleEn: v.string(),
    summaryVi: v.string(),
    summaryEn: v.string(),
    published: v.number(),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    const cms = await ctx.db.query("cmsLessons").withIndex("by_number", (q) => q.eq("number", args.number)).unique();
    if (cms) {
      await ctx.db.patch(cms._id, {
        titleVi: args.titleVi,
        titleEn: args.titleEn,
        summaryVi: args.summaryVi,
        summaryEn: args.summaryEn,
        published: args.published,
        updatedAt: now(),
      });
    }
    const bmdo = await ctx.db.query("courses").withIndex("by_slug", (q) => q.eq("slug", BMDO_SLUG)).unique();
    const lessons = bmdo
      ? await ctx.db.query("lessons").withIndex("by_course_number", (q) => q.eq("courseId", bmdo.legacyId).eq("number", args.number)).collect()
      : [];
    for (const lesson of lessons) await ctx.db.patch(lesson._id, { title: args.titleVi, summary: args.summaryVi });
    await log(ctx, args.actorId, "cms_lesson", "lesson", String(args.number), args.titleVi);
  },
});

export const addFeedback = mutation({
  args: { ...secret, actorId: v.number(), submissionId: v.number(), body: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const submission = await ctx.db.query("lessonSubmissions").withIndex("by_legacy", (q) => q.eq("legacyId", args.submissionId)).unique();
    if (!submission) throw new Error("NOT_FOUND");
    const id = await nextId(ctx, "coachFeedback");
    await ctx.db.insert("coachFeedback", { legacyId: id, submissionId: args.submissionId, authorId: args.actorId, body: args.body.trim(), createdAt: now() });
    await ctx.db.patch(submission._id, { reviewStatus: "reviewed" });
    const answer = await ctx.db.query("lessonAnswers").withIndex("by_user_lesson", (q) => q.eq("userId", submission.userId).eq("lessonId", submission.lessonId)).unique();
    if (answer) await ctx.db.patch(answer._id, { status: "reviewed", updatedAt: now() });
    await log(ctx, args.actorId, "review", "submission", String(args.submissionId));
    return { userId: submission.userId };
  },
});

export const saveAnswers = mutation({
  args: {
    ...secret,
    userId: v.number(),
    lessonId: v.number(),
    courseId: v.number(),
    schemaVersion: v.string(),
    answersJson: v.string(),
    phase: v.string(),
    phasesDoneJson: v.string(),
    progressPercent: v.number(),
    status: v.string(),
    completedAt: v.union(v.string(), v.null()),
    logComplete: v.boolean(),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    const existing = await ctx.db.query("lessonAnswers").withIndex("by_user_lesson", (q) => q.eq("userId", args.userId).eq("lessonId", args.lessonId)).unique();
    const stamp = now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        answersJson: args.answersJson,
        currentPhase: args.phase,
        phasesDoneJson: args.phasesDoneJson,
        progressPercent: args.progressPercent,
        status: args.status,
        completedAt: args.completedAt,
        schemaVersion: args.schemaVersion,
        updatedAt: stamp,
      });
    } else {
      const id = await nextId(ctx, "lessonAnswers");
      await ctx.db.insert("lessonAnswers", {
        legacyId: id,
        userId: args.userId,
        courseId: args.courseId,
        lessonId: args.lessonId,
        schemaVersion: args.schemaVersion,
        answersJson: args.answersJson,
        currentPhase: args.phase,
        phasesDoneJson: args.phasesDoneJson,
        progressPercent: args.progressPercent,
        status: args.status,
        completedAt: args.completedAt,
        updatedAt: stamp,
      });
    }
    if (args.logComplete) await log(ctx, args.userId, "lesson_complete", "lesson", String(args.lessonId), `progress ${args.progressPercent}`);
    const saved = await ctx.db.query("lessonAnswers").withIndex("by_user_lesson", (q) => q.eq("userId", args.userId).eq("lessonId", args.lessonId)).unique();
    if (!saved) throw new Error("NOT_FOUND");
    return {
      id: saved.legacyId,
      user_id: saved.userId,
      course_id: saved.courseId,
      lesson_id: saved.lessonId,
      schema_version: saved.schemaVersion,
      answers_json: saved.answersJson,
      current_phase: saved.currentPhase,
      phases_done_json: saved.phasesDoneJson,
      progress_percent: saved.progressPercent,
      status: saved.status,
      completed_at: saved.completedAt,
      updated_at: saved.updatedAt,
    };
  },
});

export const completeLesson = mutation({
  args: { ...secret, userId: v.number(), lessonId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const existing = await ctx.db.query("lessonAnswers").withIndex("by_user_lesson", (q) => q.eq("userId", args.userId).eq("lessonId", args.lessonId)).unique();
    if (!existing) throw new Error("EMPTY");
    if (existing.status === "submitted" || existing.status === "reviewed") {
      return { status: existing.status, updated_at: existing.updatedAt };
    }
    const stamp = now();
    await ctx.db.patch(existing._id, { status: "completed", progressPercent: 100, completedAt: existing.completedAt ?? stamp, updatedAt: stamp });
    await log(ctx, args.userId, "lesson_complete", "lesson", String(args.lessonId));
    return { status: "completed", updated_at: stamp };
  },
});

export const submitLesson = mutation({
  args: {
    ...secret,
    userId: v.number(),
    lessonId: v.number(),
    cohortId: v.number(),
    schemaVersion: v.string(),
    contentVersion: v.string(),
    answersJson: v.string(),
    phase: v.string(),
    progressPercent: v.number(),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    const existing = await ctx.db.query("lessonAnswers").withIndex("by_user_lesson", (q) => q.eq("userId", args.userId).eq("lessonId", args.lessonId)).unique();
    if (!existing) throw new Error("EMPTY");
    const id = await nextId(ctx, "lessonSubmissions");
    const stamp = now();
    await ctx.db.insert("lessonSubmissions", {
      legacyId: id,
      userId: args.userId,
      lessonId: args.lessonId,
      cohortId: args.cohortId,
      schemaVersion: args.schemaVersion,
      contentVersion: args.contentVersion,
      answersJson: args.answersJson,
      phase: args.phase,
      progressPercent: args.progressPercent,
      submittedAt: stamp,
      reviewStatus: "submitted",
    });
    await ctx.db.patch(existing._id, { status: "submitted", completedAt: existing.completedAt ?? stamp, updatedAt: stamp });
    await log(ctx, args.userId, "lesson_submit", "submission", String(id));
    return id;
  },
});
