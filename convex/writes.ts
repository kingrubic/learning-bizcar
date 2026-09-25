import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { gate, nextId, now } from "./helpers";

const secret = { secret: v.string() };

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
    await log(ctx, args.userId, "password_change", "user", String(args.userId));
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
    const usernameLower = args.username.trim().toLowerCase();
    const taken = await ctx.db.query("users").withIndex("by_username", (q) => q.eq("usernameLower", usernameLower)).unique();
    if (taken) return { error: "Tên đăng nhập đã tồn tại." as const };
    const cohort = await ctx.db.query("cohorts").withIndex("by_legacy", (q) => q.eq("legacyId", args.cohortId)).unique();
    if (!cohort) return { error: "Cohort không tồn tại." as const };
    const stamp = now();
    const userId = await nextId(ctx, "users");
    const group = await ctx.db.query("permissionGroups").withIndex("by_name", (q) => q.eq("name", "Học viên")).unique();
    const department = (await ctx.db.query("departments").collect()).find((row) => row.name === "Học viên BMDO");
    await ctx.db.insert("users", {
      legacyId: userId,
      username: args.username.trim(),
      usernameLower,
      passwordHash: args.passwordHash,
      displayName: args.displayName.trim(),
      role: "user",
      departmentId: department?.legacyId ?? null,
      permissionGroupId: group?.legacyId ?? null,
      organizationId: cohort.organizationId,
      active: 1,
      mustChangePassword: 1,
      createdAt: stamp,
      updatedAt: stamp,
    });
    const enrollmentId = await nextId(ctx, "enrollments");
    await ctx.db.insert("enrollments", {
      legacyId: enrollmentId,
      userId,
      cohortId: args.cohortId,
      courseId: cohort.courseId,
      memberRole: "learner",
      createdAt: stamp,
    });
    await log(ctx, args.actorId, "enrollment", "user", String(userId), args.username.trim());
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
    const other = seats[0];
    if (other) {
      const otherCohort = await ctx.db.query("cohorts").withIndex("by_legacy", (q) => q.eq("legacyId", other.cohortId)).unique();
      return { status: "other" as const, cohortId: other.cohortId, cohortName: otherCohort?.name ?? "" };
    }
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

export const createCohort = mutation({
  args: {
    ...secret,
    actorId: v.number(),
    name: v.string(),
    courseId: v.number(),
    mode: v.union(v.literal("all_open"), v.literal("sequential"), v.literal("scheduled")),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    const name = args.name.trim();
    if (!name) return { error: "Thiếu tên lớp." as const };
    const course = await ctx.db.query("courses").withIndex("by_legacy", (q) => q.eq("legacyId", args.courseId)).unique();
    if (!course) return { error: "Khoá không tồn tại." as const };
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
    });
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
    const courseId = await nextId(ctx, "courses");
    await ctx.db.insert("courses", {
      legacyId: courseId,
      slug,
      code,
      title,
      tagline: args.tagline.trim() || source.tagline,
    });
    const lessons = (await ctx.db.query("lessons").collect())
      .filter((row) => row.courseId === source.legacyId)
      .sort((a, b) => a.number - b.number);
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
      });
    }
    await log(ctx, args.actorId, "course_clone", "course", String(courseId), `${source.code} → ${code}`);
    return { id: courseId, lessons: lessons.length };
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
    const lessons = (await ctx.db.query("lessons").collect()).filter((row) => row.number === args.number);
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
