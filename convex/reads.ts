import { query } from "./_generated/server";
import { v } from "convex/values";
import { classCatalog, cohortPlan, loadCatalog, type CatalogRow } from "./catalogScope";
import { BMDO_SLUG, subsetProgress } from "./codes";
import { gate, passwordFlag, publicUser } from "./helpers";

const secret = { secret: v.string() };

export const sessionUser = query({
  args: { ...secret, token: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const session = await ctx.db.query("sessions").withIndex("by_token", (q) => q.eq("token", args.token)).unique();
    if (!session || session.expiresAt <= new Date().toISOString()) return null;
    const user = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", session.userId)).unique();
    if (!user || user.active !== 1) return null;
    return publicUser(user);
  },
});

export const loginUser = query({
  args: { ...secret, username: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const usernameLower = args.username.trim().toLowerCase();
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const attempts = await ctx.db.query("loginAttempts").withIndex("by_username", (q) => q.eq("usernameLower", usernameLower)).collect();
    const recent = attempts.filter((row) => row.createdAt > since).length;
    const user = await ctx.db.query("users").withIndex("by_username", (q) => q.eq("usernameLower", usernameLower)).unique();
    return {
      recent,
      user: user ? { id: user.legacyId, passwordHash: user.passwordHash, active: user.active, displayName: user.displayName } : null,
    };
  },
});

export const userFlags = query({
  args: { ...secret, id: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const user = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", args.id)).unique();
    if (!user) return null;
    return { must_change_password: passwordFlag(user.mustChangePassword), role: user.role, password_hash: user.passwordHash };
  },
});

export const menuKeys = query({
  args: { ...secret, groupId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const rows = await ctx.db.query("permissionGroupMenus").withIndex("by_group", (q) => q.eq("groupId", args.groupId)).collect();
    return rows.map((row) => ({ menu_key: row.menuKey }));
  },
});

function publicLesson(row: CatalogRow) {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    framework: row.framework,
    summary: row.summary,
    group_name: row.groupName,
    has_report: row.hasReport,
    content_version: row.contentVersion,
    schema_version: row.schemaVersion,
    storage_key: row.storageKey,
    archived: row.archived,
    sort_order: row.sortOrder,
  };
}

export const learnState = query({
  args: { ...secret, userId: v.number(), courseSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    gate(args.secret);
    const courses = await ctx.db.query("courses").collect();
    const cohorts = await ctx.db.query("cohorts").collect();
    const loaded = await loadCatalog(ctx);
    const catalog = loaded.lessons;
    const seats = args.userId
      ? (await ctx.db.query("enrollments").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect())
        .filter((row) => row.memberRole === "learner")
        .sort((a, b) => b.legacyId - a.legacyId)
      : [];
    const answers = args.userId
      ? await ctx.db.query("lessonAnswers").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect()
      : [];
    const answerRows = answers.map((row) => ({ lessonId: row.lessonId, status: row.status }));
    const enrollments = seats.flatMap((seat) => {
      const cohort = cohorts.find((item) => item.legacyId === seat.cohortId);
      const course = courses.find((item) => item.legacyId === seat.courseId);
      if (!cohort || !course) return [];
      const plan = cohortPlan(loaded, cohort);
      const subset = classCatalog(loaded, cohort);
      const progress = subsetProgress(subset.map((lesson) => lesson.id), answerRows);
      return [{
        id: seat.legacyId,
        cohort_id: seat.cohortId,
        course_id: seat.courseId,
        member_role: seat.memberRole,
        unlock_mode: plan.mode,
        review_enabled: cohort.reviewEnabled,
        cohort_name: cohort.name,
        cohort_code: cohort.code ?? "",
        course_slug: course.slug,
        course_code: course.code,
        course_title: course.title,
        completed: progress.completed,
        total: progress.total,
        percent: progress.percent,
      }];
    });
    const course = args.courseSlug
      ? courses.find((item) => item.slug === args.courseSlug) ?? null
      : courses.find((item) => item.legacyId === enrollments[0]?.course_id) ?? courses.find((item) => item.slug === BMDO_SLUG) ?? null;
    if (!course) return null;
    const enrollment = enrollments.find((item) => item.course_id === course.legacyId) ?? null;
    const cohort = enrollment ? cohorts.find((item) => item.legacyId === enrollment.cohort_id) ?? null : null;
    const activePlan = cohort ? cohortPlan(loaded, cohort) : null;
    const lessons = (cohort ? classCatalog(loaded, cohort) : catalog.filter((lesson) => lesson.courseId === course.legacyId))
      .map(publicLesson);
    const lessonIds = new Set(lessons.map((lesson) => lesson.id));
    return {
      course: {
        id: course.legacyId,
        slug: course.slug,
        code: course.code,
        title: course.title,
        tagline: course.tagline,
        intro: course.intro ?? "",
        management_code: course.managementCode ?? "",
      },
      lessons,
      enrollment: enrollment && cohort ? {
        id: enrollment.id,
        cohort_id: enrollment.cohort_id,
        course_id: enrollment.course_id,
        member_role: enrollment.member_role,
        unlock_mode: enrollment.unlock_mode,
        review_enabled: enrollment.review_enabled,
        cohort_name: enrollment.cohort_name,
        cohort_code: enrollment.cohort_code,
      } : null,
      enrollments,
      sessions: (activePlan?.sessions ?? []).map((session) => ({
        id: session.id,
        sort_order: session.sortOrder,
        title: session.title,
        session_date: session.sessionDate,
        lesson_ids: session.lessonIds,
      })),
      answers: answers.filter((row) => lessonIds.has(row.lessonId)).map((row) => ({
        id: row.legacyId,
        user_id: row.userId,
        course_id: row.courseId,
        lesson_id: row.lessonId,
        schema_version: row.schemaVersion,
        answers_json: row.answersJson,
        current_phase: row.currentPhase,
        phases_done_json: row.phasesDoneJson,
        progress_percent: row.progressPercent,
        status: row.status,
        completed_at: row.completedAt,
        updated_at: row.updatedAt,
      })),
    };
  },
});

export const cmsState = query({
  args: secret,
  handler: async (ctx, args) => {
    gate(args.secret);
    const blocks = (await ctx.db.query("cmsBlocks").collect())
      .sort((a, b) => a.key.localeCompare(b.key) || a.locale.localeCompare(b.locale))
      .map((row) => ({ key: row.key, locale: row.locale, body: row.body }));
    const announcements = (await ctx.db.query("cmsAnnouncements").collect())
      .sort((a, b) => b.legacyId - a.legacyId)
      .map((row) => ({ id: row.legacyId, title: row.title, body: row.body, locale: row.locale, published: row.published, created_at: row.createdAt }));
    const lessons = (await ctx.db.query("cmsLessons").collect())
      .sort((a, b) => a.number - b.number)
      .map((row) => ({
        number: row.number,
        title_vi: row.titleVi,
        title_en: row.titleEn,
        summary_vi: row.summaryVi,
        summary_en: row.summaryEn,
        published: row.published,
      }));
    return { blocks, announcements, lessons };
  },
});

export const adminHome = query({
  args: { ...secret, cohortId: v.union(v.number(), v.null()), status: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const users = await ctx.db.query("users").collect();
    const orgs = await ctx.db.query("organizations").collect();
    const enrollments = (await ctx.db.query("enrollments").collect()).filter((row) => row.memberRole === "learner");
    const learnerIds = new Set(enrollments.map((row) => row.userId));
    const cohorts = await ctx.db.query("cohorts").collect();
    const answers = await ctx.db.query("lessonAnswers").collect();
    const loaded = await loadCatalog(ctx);
    const roster = users.filter((row) => row.role === "user" || learnerIds.has(row.legacyId));
    const rows = roster.flatMap((user) => {
      const org = orgs.find((item) => item.legacyId === user.organizationId);
      const seats = enrollments.filter((item) => item.userId === user.legacyId);
      const targets = seats.length ? seats : [null];
      return targets.flatMap((enrollment) => {
        if (args.cohortId && enrollment?.cohortId !== args.cohortId) return [];
        if (args.cohortId && !enrollment) return [];
        const cohort = cohorts.find((item) => item.legacyId === enrollment?.cohortId);
        const subset = cohort ? classCatalog(loaded, cohort) : [];
        const subsetIds = new Set(subset.map((lesson) => lesson.id));
        const mine = answers.filter((item) => item.userId === user.legacyId && subsetIds.has(item.lessonId));
        const matched = args.status ? mine.filter((item) => (item.status || "not_started") === args.status) : mine;
        if (args.status && matched.length === 0) return [];
        const progress = subsetProgress(subset.map((lesson) => lesson.id), mine.map((item) => ({ lessonId: item.lessonId, status: item.status })));
        const last = matched.map((item) => item.updatedAt).sort().at(-1) ?? null;
        return [{
          id: user.legacyId,
          cohort_id: enrollment?.cohortId ?? 0,
          display_name: user.displayName,
          username: user.username,
          active: user.active,
          role: user.role,
          org: org?.name ?? "",
          cohort: cohort?.name ?? "",
          touched: matched.length,
          done: progress.completed,
          total: cohort ? progress.total : 0,
          last_activity: last,
        }];
      });
    });
    rows.sort((a, b) => (b.last_activity ?? "").localeCompare(a.last_activity ?? ""));
    return {
      rows,
      cohorts: cohorts.map((item) => ({ id: item.legacyId, name: item.name })),
    };
  },
});

export const progressRows = query({
  args: secret,
  handler: async (ctx, args) => {
    gate(args.secret);
    const users = await ctx.db.query("users").collect();
    const courses = await ctx.db.query("courses").collect();
    const cohorts = await ctx.db.query("cohorts").collect();
    const answers = await ctx.db.query("lessonAnswers").collect();
    const enrollments = (await ctx.db.query("enrollments").collect()).filter((row) => row.memberRole === "learner");
    const loaded = await loadCatalog(ctx);
    const catalog = loaded.lessons;
    const allowed = new Map<number, Set<number>>();
    for (const seat of enrollments) {
      const cohort = cohorts.find((item) => item.legacyId === seat.cohortId);
      if (!cohort) continue;
      const ids = allowed.get(seat.userId) ?? new Set<number>();
      for (const lesson of classCatalog(loaded, cohort)) ids.add(lesson.id);
      allowed.set(seat.userId, ids);
    }
    return answers
      .filter((row) => allowed.get(row.userId)?.has(row.lessonId))
      .map((row) => {
        const user = users.find((item) => item.legacyId === row.userId);
        const lesson = catalog.find((item) => item.id === row.lessonId);
        const course = courses.find((item) => item.legacyId === lesson?.courseId);
        return {
          id: row.userId,
          display_name: user?.displayName ?? "",
          course_code: course?.code ?? "",
          number: lesson?.number ?? null,
          title: lesson?.title ?? null,
          progress_percent: row.progressPercent,
          status: row.status,
          current_phase: row.currentPhase,
          updated_at: row.updatedAt,
        };
      })
      .filter((row) => row.number)
      .sort((a, b) => a.display_name.localeCompare(b.display_name) || a.course_code.localeCompare(b.course_code) || (a.number ?? 0) - (b.number ?? 0));
  },
});

export const taskBoard = query({
  args: { ...secret, exceptUserId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const users = await ctx.db.query("users").collect();
    const people = users
      .filter((row) => row.active === 1 && row.legacyId !== args.exceptUserId)
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((row) => ({ id: row.legacyId, display_name: row.displayName, username: row.username, role: row.role }));
    const tasks = (await ctx.db.query("tasks").collect())
      .sort((a, b) => b.legacyId - a.legacyId)
      .map((row) => ({
        title: row.title,
        body: row.body,
        status: row.status,
        due_at: row.dueAt,
        created_at: row.createdAt,
        assignee: users.find((item) => item.legacyId === row.assigneeId)?.displayName ?? "",
        author: users.find((item) => item.legacyId === row.authorId)?.displayName ?? "",
      }));
    return { people, tasks };
  },
});

export const myTasks = query({
  args: { ...secret, userId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const users = await ctx.db.query("users").collect();
    return (await ctx.db.query("tasks").withIndex("by_assignee", (q) => q.eq("assigneeId", args.userId)).collect())
      .sort((a, b) => b.legacyId - a.legacyId)
      .map((row) => ({
        id: row.legacyId,
        title: row.title,
        body: row.body,
        status: row.status,
        due_at: row.dueAt,
        author: users.find((item) => item.legacyId === row.authorId)?.displayName ?? "",
      }));
  },
});

export const departmentsView = query({
  args: secret,
  handler: async (ctx, args) => {
    gate(args.secret);
    const users = await ctx.db.query("users").collect();
    return (await ctx.db.query("departments").collect())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((row) => ({ name: row.name, members: users.filter((user) => user.departmentId === row.legacyId).length }));
  },
});

export const usersView = query({
  args: secret,
  handler: async (ctx, args) => {
    gate(args.secret);
    const departments = (await ctx.db.query("departments").collect()).sort((a, b) => a.name.localeCompare(b.name));
    const groups = (await ctx.db.query("permissionGroups").collect()).sort((a, b) => a.name.localeCompare(b.name));
    const roleOrder = { admin: 0, mod: 1, user: 2 };
    const users = (await ctx.db.query("users").collect())
      .sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.displayName.localeCompare(b.displayName))
      .map((row) => ({
        id: row.legacyId,
        display_name: row.displayName,
        username: row.username,
        role: row.role,
        active: row.active,
        department: departments.find((item) => item.legacyId === row.departmentId)?.name ?? null,
        group_name: groups.find((item) => item.legacyId === row.permissionGroupId)?.name ?? null,
        department_id: row.departmentId,
        permission_group_id: row.permissionGroupId,
      }));
    return {
      users,
      departments: departments.map((row) => ({ id: row.legacyId, name: row.name })),
      groups: groups.map((row) => ({ id: row.legacyId, name: row.name })),
    };
  },
});

export const groupsView = query({
  args: secret,
  handler: async (ctx, args) => {
    gate(args.secret);
    const groups = (await ctx.db.query("permissionGroups").collect())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((row) => ({ id: row.legacyId, name: row.name, description: row.description }));
    const links = (await ctx.db.query("permissionGroupMenus").collect()).map((row) => ({ group_id: row.groupId, menu_key: row.menuKey }));
    return { groups, links };
  },
});

export const submissionsView = query({
  args: secret,
  handler: async (ctx, args) => {
    gate(args.secret);
    const users = await ctx.db.query("users").collect();
    const lessons = await ctx.db.query("lessons").collect();
    const feedback = await ctx.db.query("coachFeedback").collect();
    const rows = (await ctx.db.query("lessonSubmissions").collect())
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .map((row) => {
        const user = users.find((item) => item.legacyId === row.userId);
        const lesson = lessons.find((item) => item.legacyId === row.lessonId);
        const notes = feedback
          .filter((item) => item.submissionId === row.legacyId)
          .sort((a, b) => a.legacyId - b.legacyId)
          .map((item) => ({
            body: item.body,
            created_at: item.createdAt,
            display_name: users.find((person) => person.legacyId === item.authorId)?.displayName ?? "",
          }));
        return {
          id: row.legacyId,
          submitted_at: row.submittedAt,
          review_status: row.reviewStatus,
          answers_json: row.answersJson,
          progress_percent: row.progressPercent,
          display_name: user?.displayName ?? "",
          user_id: row.userId,
          number: lesson?.number ?? 0,
          title: lesson?.title ?? "",
          framework: lesson?.framework ?? "",
          storage_key: lesson?.storageKey ?? "",
          notes,
        };
      });
    return rows;
  },
});

export const learnersView = query({
  args: secret,
  handler: async (ctx, args) => {
    gate(args.secret);
    const cohorts = (await ctx.db.query("cohorts").collect()).map((row) => ({ id: row.legacyId, name: row.name, course_id: row.courseId }));
    const enrollments = (await ctx.db.query("enrollments").collect()).filter((row) => row.memberRole === "learner");
    const learners = (await ctx.db.query("users").collect())
      .filter((row) => row.role === "user")
      .sort((a, b) => b.legacyId - a.legacyId)
      .map((row) => {
        const names = enrollments
          .filter((item) => item.userId === row.legacyId)
          .map((item) => cohorts.find((cohort) => cohort.id === item.cohortId)?.name)
          .filter((name): name is string => Boolean(name));
        return {
          id: row.legacyId,
          display_name: row.displayName,
          username: row.username,
          active: row.active,
          role: row.role,
          management_code: row.managementCode ?? "",
          cohort: names.length ? names.join(", ") : null,
        };
      });
    return { cohorts, learners };
  },
});

export const learnerDetail = query({
  args: { ...secret, id: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const learner = await ctx.db.query("users").withIndex("by_legacy", (q) => q.eq("legacyId", args.id)).unique();
    if (!learner) return null;
    const lessons = await ctx.db.query("lessons").collect();
    const cohorts = await ctx.db.query("cohorts").collect();
    const courses = await ctx.db.query("courses").collect();
    const seats = (await ctx.db.query("enrollments").withIndex("by_user", (q) => q.eq("userId", args.id)).collect())
      .filter((row) => row.memberRole === "learner")
      .map((row) => {
        const cohort = cohorts.find((item) => item.legacyId === row.cohortId);
        const course = courses.find((item) => item.legacyId === row.courseId);
        return { cohort_name: cohort?.name ?? "", course_code: course?.code ?? "", cohort_code: cohort?.code ?? "" };
      });
    const answers = (await ctx.db.query("lessonAnswers").withIndex("by_user", (q) => q.eq("userId", args.id)).collect())
      .map((row) => {
        const lesson = lessons.find((item) => item.legacyId === row.lessonId);
        return {
          number: lesson?.number ?? 0,
          title: lesson?.title ?? "",
          framework: lesson?.framework ?? "",
          storage_key: lesson?.storageKey ?? "",
          answers_json: row.answersJson,
          status: row.status,
          progress_percent: row.progressPercent,
          current_phase: row.currentPhase,
          updated_at: row.updatedAt,
        };
      })
      .sort((a, b) => a.number - b.number);
    const target = String(args.id);
    const logs = (await ctx.db.query("activityLogs").collect())
      .filter((row) => row.actorId === args.id || (row.targetType === "user" && row.targetId === target))
      .sort((a, b) => b.legacyId - a.legacyId)
      .slice(0, 20)
      .map((row) => ({ action: row.action, detail: row.detail, created_at: row.createdAt }));
    return {
      learner: {
        id: learner.legacyId,
        display_name: learner.displayName,
        username: learner.username,
        active: learner.active,
        role: learner.role,
        management_code: learner.managementCode ?? "",
      },
      classes: seats,
      answers,
      logs,
    };
  },
});

export const cohortsView = query({
  args: secret,
  handler: async (ctx, args) => {
    gate(args.secret);
    const orgs = await ctx.db.query("organizations").collect();
    const userDocs = await ctx.db.query("users").collect();
    const users = userDocs
      .filter((row) => row.active === 1)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"))
      .map((row) => ({
        id: row.legacyId,
        display_name: row.displayName,
        username: row.username,
        role: row.role,
        management_code: row.managementCode ?? "",
      }));
    const loaded = await loadCatalog(ctx);
    const catalog = loaded.lessons;
    const cohortDocs = await ctx.db.query("cohorts").collect();
    const enrollments = (await ctx.db.query("enrollments").collect())
      .filter((row) => row.memberRole === "learner")
      .map((row) => {
        const user = userDocs.find((item) => item.legacyId === row.userId);
        return {
          user_id: row.userId,
          cohort_id: row.cohortId,
          display_name: user?.displayName ?? "",
          username: user?.username ?? "",
          management_code: user?.managementCode ?? "",
        };
      });
    const cohorts = cohortDocs.map((row) => {
      const plan = cohortPlan(loaded, row);
      return {
        id: row.legacyId,
        name: row.name,
        org: orgs.find((item) => item.legacyId === row.organizationId)?.name ?? "",
        unlock_mode: plan.persisted ? row.unlockMode : plan.mode,
        review_enabled: row.reviewEnabled,
        course_id: row.courseId,
        organization_id: row.organizationId,
        code: row.code ?? "",
        instructor_id: row.instructorId ?? null,
        sessions: plan.sessions.map((session) => ({
          title: session.title,
          session_date: session.sessionDate ?? "",
          lesson_ids: session.lessonIds,
        })),
      };
    });
    const courses = (await ctx.db.query("courses").collect()).map((row) => ({
      id: row.legacyId,
      code: row.code,
      title: row.title,
      slug: row.slug,
      tagline: row.tagline,
      intro: row.intro ?? "",
      management_code: row.managementCode ?? "",
    }));
    const lessons = catalog
      .sort((a, b) => a.courseId - b.courseId || a.sortOrder - b.sortOrder || a.number - b.number)
      .map((row) => ({
        id: row.id,
        course_id: row.courseId,
        number: row.number,
        title: row.title,
        framework: row.framework,
        summary: row.summary,
        group_name: row.groupName,
        content_version: row.contentVersion,
        schema_version: row.schemaVersion,
        has_report: row.hasReport,
        archived: row.archived,
        sort_order: row.sortOrder,
      }));
    return { cohorts, lessons, courses, users, enrollments };
  },
});

export const cohortById = query({
  args: { ...secret, id: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const row = await ctx.db.query("cohorts").withIndex("by_legacy", (q) => q.eq("legacyId", args.id)).unique();
    if (!row) return null;
    return { course_id: row.courseId, organization_id: row.organizationId };
  },
});

export const learnerGroupId = query({
  args: secret,
  handler: async (ctx, args) => {
    gate(args.secret);
    const row = await ctx.db.query("permissionGroups").withIndex("by_name", (q) => q.eq("name", "Học viên")).unique();
    return row?.legacyId ?? null;
  },
});
