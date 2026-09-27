import { mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { CMS_BLOCKS, COURSE, LESSONS, PERMISSION_PRESETS, PRACTICAL_INSTRUCTOR_DESCRIPTION, PRACTICAL_INSTRUCTOR_GROUP, PRACTICAL_INSTRUCTOR_MENUS, PREVIOUS_MAP_LEDE, SESSION20_MAP_LEDE, SESSION21_MAP_LEDE, SESSION27_MAP_LEDE } from "./catalog";
import { VABIX_COURSE, VABIX_LESSONS } from "./vabixApplier";
import { BMDO_SLUG, classManagementCode, courseManagementCode, instructorManagementCode, learnerManagementCode, nextFreeCode } from "./codes";
import { gate, nextId, now } from "./helpers";

/** Create the practical-instructor group once. An existing row with the same name is left as-is, including its menus. */
async function ensurePracticalInstructorGroupRow(ctx: MutationCtx) {
  const existing = await ctx.db.query("permissionGroups").withIndex("by_name", (q) => q.eq("name", PRACTICAL_INSTRUCTOR_GROUP)).unique();
  if (existing) return { id: existing.legacyId, created: false as const };
  const id = await nextId(ctx, "permissionGroups");
  await ctx.db.insert("permissionGroups", {
    legacyId: id,
    name: PRACTICAL_INSTRUCTOR_GROUP,
    description: PRACTICAL_INSTRUCTOR_DESCRIPTION,
    createdAt: now(),
  });
  for (const menuKey of PRACTICAL_INSTRUCTOR_MENUS) {
    await ctx.db.insert("permissionGroupMenus", { groupId: id, menuKey });
  }
  return { id, created: true as const };
}

async function ensureLearnerDiscussionMenu(ctx: MutationCtx) {
  for (const name of ["Học viên", "Theo dõi lớp"]) {
    const group = await ctx.db.query("permissionGroups").withIndex("by_name", (q) => q.eq("name", name)).unique();
    if (!group) continue;
    const links = await ctx.db.query("permissionGroupMenus").withIndex("by_group", (q) => q.eq("groupId", group.legacyId)).collect();
    if (links.some((row) => row.menuKey === "discussion")) continue;
    await ctx.db.insert("permissionGroupMenus", { groupId: group.legacyId, menuKey: "discussion" });
  }
}

async function bmdoCourses(ctx: MutationCtx) {
  return (await ctx.db.query("courses").collect()).filter((course) => course.slug === BMDO_SLUG);
}

const SESSIONS_BACKFILL = "classSessionsBackfill";

async function attachNewLesson(ctx: MutationCtx, courseId: number, lessonId: number, sortOrder: number) {
  const cohorts = (await ctx.db.query("cohorts").collect()).filter((row) => row.courseId === courseId);
  const priorIds = (await ctx.db.query("lessons").withIndex("by_course_number", (q) => q.eq("courseId", courseId)).collect())
    .filter((row) => row.legacyId !== lessonId && row.archived !== 1)
    .map((row) => row.legacyId);
  for (const cohort of cohorts) {
    const sessions = await ctx.db.query("classSessions").withIndex("by_cohort", (q) => q.eq("cohortId", cohort.legacyId)).collect();
    if (sessions.length === 1) {
      const links = await ctx.db.query("classSessionLessons").withIndex("by_session", (q) => q.eq("sessionId", sessions[0].legacyId)).collect();
      if (links.some((link) => link.lessonId === lessonId)) continue;
      const have = new Set(links.map((link) => link.lessonId));
      if (!priorIds.every((id) => have.has(id))) continue;
      const maxOrder = links.reduce((max, row) => Math.max(max, row.sortOrder), 0);
      await ctx.db.insert("classSessionLessons", { sessionId: sessions[0].legacyId, lessonId, sortOrder: maxOrder + 1 || sortOrder });
      continue;
    }
    if (sessions.length > 0 || cohort.sessionsReady === 1) continue;
    if (cohort.lessonsScoped !== 1) continue;
    const existing = await ctx.db
      .query("cohortLessons")
      .withIndex("by_cohort_lesson", (q) => q.eq("cohortId", cohort.legacyId).eq("lessonId", lessonId))
      .unique();
    if (existing) continue;
    await ctx.db.insert("cohortLessons", { cohortId: cohort.legacyId, lessonId, sortOrder });
  }
}

async function legacyLessonIds(ctx: MutationCtx, cohort: { legacyId: number; courseId: number; lessonsScoped?: number }) {
  const links = await ctx.db.query("cohortLessons").withIndex("by_cohort", (q) => q.eq("cohortId", cohort.legacyId)).collect();
  const lessons = await ctx.db.query("lessons").withIndex("by_course_number", (q) => q.eq("courseId", cohort.courseId)).collect();
  const allowed = new Set(lessons.map((row) => row.legacyId));
  if (cohort.lessonsScoped === 1 || links.length > 0) {
    return links
      .filter((link) => allowed.has(link.lessonId))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((link) => link.lessonId);
  }
  return lessons
    .filter((row) => row.archived !== 1)
    .sort((a, b) => (a.sortOrder ?? a.number) - (b.sortOrder ?? b.number) || a.number - b.number)
    .map((row) => row.legacyId);
}

/** One buổi covering the previous lesson subset. Scheduled classes become all_open (the buổi has no date). Does not touch learner answers. */
export async function migrateCohortSessions(ctx: MutationCtx, cohort: {
  _id: import("./_generated/dataModel").Id<"cohorts">;
  legacyId: number;
  courseId: number;
  lessonsScoped?: number;
  unlockMode: "all_open" | "sequential" | "scheduled";
  sessionsReady?: number;
}) {
  if (cohort.sessionsReady === 1) return { created: false, relaxed: false };
  const existing = await ctx.db.query("classSessions").withIndex("by_cohort", (q) => q.eq("cohortId", cohort.legacyId)).collect();
  if (existing.length > 0) {
    await ctx.db.patch(cohort._id, { sessionsReady: 1 });
    return { created: false, relaxed: false };
  }
  const lessonIds = await legacyLessonIds(ctx, cohort);
  const relaxed = cohort.unlockMode === "scheduled";
  await ctx.db.patch(cohort._id, { sessionsReady: 1, ...(relaxed ? { unlockMode: "all_open" as const } : {}) });
  if (lessonIds.length === 0) return { created: false, relaxed };
  const sessionId = await nextId(ctx, "classSessions");
  await ctx.db.insert("classSessions", {
    legacyId: sessionId,
    cohortId: cohort.legacyId,
    title: "Buổi 01",
    sessionDate: null,
    sortOrder: 1,
  });
  let order = 0;
  for (const lessonId of lessonIds) {
    order += 1;
    await ctx.db.insert("classSessionLessons", { sessionId, lessonId, sortOrder: order });
  }
  return { created: true, relaxed };
}

async function migrateAllCohorts(ctx: MutationCtx) {
  let sessionsCreated = 0;
  let scheduledRelaxed = 0;
  let alreadyReady = 0;
  for (const cohort of await ctx.db.query("cohorts").collect()) {
    const result = await migrateCohortSessions(ctx, cohort);
    if (result.created) sessionsCreated += 1;
    if (result.relaxed) scheduledRelaxed += 1;
    if (!result.created && !result.relaxed && cohort.sessionsReady === 1) alreadyReady += 1;
  }
  return { sessionsCreated, scheduledRelaxed, alreadyReady };
}

async function markSessionsBackfill(ctx: MutationCtx) {
  const flag = await ctx.db.query("counters").withIndex("by_name", (q) => q.eq("name", SESSIONS_BACKFILL)).unique();
  if (flag) await ctx.db.patch(flag._id, { value: 1 });
  else await ctx.db.insert("counters", { name: SESSIONS_BACKFILL, value: 1 });
}

async function ensureSessionsBackfill(ctx: MutationCtx) {
  const flag = await ctx.db.query("counters").withIndex("by_name", (q) => q.eq("name", SESSIONS_BACKFILL)).unique();
  if (flag?.value === 1) return { skipped: true as const, sessionsCreated: 0, scheduledRelaxed: 0, alreadyReady: 0 };
  const result = await migrateAllCohorts(ctx);
  await markSessionsBackfill(ctx);
  return { skipped: false as const, ...result };
}

export const ensureCatalog = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const existing = await ctx.db.query("courses").withIndex("by_slug", (q) => q.eq("slug", COURSE.slug)).unique();
    if (existing) {
      await ensureLearnerDiscussionMenu(ctx);
      await ensurePracticalInstructorGroupRow(ctx);
      await ensureSessionsBackfill(ctx);
      return { ok: true, seeded: false };
    }

    const createdAt = now();
    const orgId = await nextId(ctx, "organizations");
    await ctx.db.insert("organizations", { legacyId: orgId, name: "VABIX", createdAt });
    const courseId = await nextId(ctx, "courses");
    await ctx.db.insert("courses", {
      legacyId: courseId,
      slug: COURSE.slug,
      code: COURSE.code,
      title: COURSE.title,
      tagline: COURSE.tagline,
      intro: "",
      managementCode: courseManagementCode(COURSE.code),
    });
    for (const lesson of LESSONS) {
      const lessonId = await nextId(ctx, "lessons");
      await ctx.db.insert("lessons", {
        legacyId: lessonId,
        courseId,
        number: lesson.number,
        title: lesson.title,
        framework: lesson.framework,
        summary: lesson.summary,
        groupName: lesson.group,
        hasReport: lesson.hasReport ? 1 : 0,
        storageKey: lesson.storageKey,
        contentVersion: lesson.contentVersion,
        schemaVersion: lesson.schemaVersion,
        archived: 0,
        sortOrder: lesson.number,
      });
      await ctx.db.insert("cmsLessons", {
        number: lesson.number,
        titleVi: lesson.title,
        titleEn: lesson.titleEn,
        summaryVi: lesson.summary,
        summaryEn: lesson.summaryEn,
        published: 1,
        updatedAt: createdAt,
      });
    }
    const cohortId = await nextId(ctx, "cohorts");
    await ctx.db.insert("cohorts", {
      legacyId: cohortId,
      organizationId: orgId,
      courseId,
      name: "BMDO K03 · Cohort 01",
      unlockMode: "all_open",
      reviewEnabled: 1,
      createdAt,
      code: classManagementCode(COURSE.code, 1),
      instructorId: null,
      lessonsScoped: 1,
    });
    const seededLessons = await ctx.db.query("lessons").withIndex("by_course_number", (q) => q.eq("courseId", courseId)).collect();
    for (const lesson of seededLessons) {
      await ctx.db.insert("cohortLessons", { cohortId, lessonId: lesson.legacyId, sortOrder: lesson.number });
    }
    for (const name of ["Học viên BMDO", "Vận hành chương trình"]) {
      const id = await nextId(ctx, "departments");
      await ctx.db.insert("departments", { legacyId: id, organizationId: orgId, name, createdAt });
    }
    for (const preset of PERMISSION_PRESETS) {
      const id = await nextId(ctx, "permissionGroups");
      await ctx.db.insert("permissionGroups", { legacyId: id, name: preset.name, description: preset.description, createdAt });
      for (const menuKey of preset.menus) {
        await ctx.db.insert("permissionGroupMenus", { groupId: id, menuKey });
      }
    }
    for (const [key, locale, body] of CMS_BLOCKS) {
      await ctx.db.insert("cmsBlocks", { key, locale, body, updatedAt: createdAt });
    }
    await ensurePracticalInstructorGroupRow(ctx);
    await ensureSessionsBackfill(ctx);
    return { ok: true, seeded: true };
  },
});

/**
 * Idempotent by the exact name "giảng viên dẫn giảng thực hành".
 * Also runs from ensureCatalog on the next app request.
 *
 *   npx convex run seed:ensurePracticalInstructorGroup '{"secret":"<APP_SECRET>"}'
 */
export const ensurePracticalInstructorGroup = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const group = await ensurePracticalInstructorGroupRow(ctx);
    return { ok: true, ...group };
  },
});

export const addSession20 = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const spec = LESSONS.find((lesson) => lesson.number === 20);
    if (!spec) throw new Error("LESSON_20_MISSING");
    const createdAt = now();
    const courses = await bmdoCourses(ctx);
    const insertedLessons: { courseId: number; lessonId: number }[] = [];
    for (const course of courses) {
      const existing = await ctx.db
        .query("lessons")
        .withIndex("by_course_number", (q) => q.eq("courseId", course.legacyId).eq("number", spec.number))
        .unique();
      if (existing) continue;
      const lessonId = await nextId(ctx, "lessons");
      await ctx.db.insert("lessons", {
        legacyId: lessonId,
        courseId: course.legacyId,
        number: spec.number,
        title: spec.title,
        framework: spec.framework,
        summary: spec.summary,
        groupName: spec.group,
        hasReport: spec.hasReport ? 1 : 0,
        storageKey: spec.storageKey,
        contentVersion: spec.contentVersion,
        schemaVersion: spec.schemaVersion,
      });
      await attachNewLesson(ctx, course.legacyId, lessonId, spec.number);
      insertedLessons.push({ courseId: course.legacyId, lessonId });
    }
    const cms = await ctx.db.query("cmsLessons").withIndex("by_number", (q) => q.eq("number", spec.number)).unique();
    let cmsInserted = false;
    if (!cms) {
      await ctx.db.insert("cmsLessons", {
        number: spec.number,
        titleVi: spec.title,
        titleEn: spec.titleEn,
        summaryVi: spec.summary,
        summaryEn: spec.summaryEn,
        published: 1,
        updatedAt: createdAt,
      });
      cmsInserted = true;
    }
    const ledesUpdated: string[] = [];
    for (const locale of ["vi", "en"] as const) {
      const next = SESSION20_MAP_LEDE[locale];
      const block = await ctx.db.query("cmsBlocks").withIndex("by_key_locale", (q) => q.eq("key", "map.lede").eq("locale", locale)).unique();
      if (!block) {
        await ctx.db.insert("cmsBlocks", { key: "map.lede", locale, body: next, updatedAt: createdAt });
        ledesUpdated.push(locale);
        continue;
      }
      if (block.body === PREVIOUS_MAP_LEDE[locale]) {
        await ctx.db.patch(block._id, { body: next, updatedAt: createdAt });
        ledesUpdated.push(locale);
      }
    }
    return {
      ok: true,
      courses: courses.length,
      lessonsInserted: insertedLessons.length,
      lessonIds: insertedLessons,
      cmsInserted,
      ledesUpdated,
    };
  },
});

export const addSession21 = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const spec = LESSONS.find((lesson) => lesson.number === 21);
    if (!spec) throw new Error("LESSON_21_MISSING");
    const createdAt = now();
    const courses = await bmdoCourses(ctx);
    const insertedLessons: { courseId: number; lessonId: number }[] = [];
    for (const course of courses) {
      const existing = await ctx.db
        .query("lessons")
        .withIndex("by_course_number", (q) => q.eq("courseId", course.legacyId).eq("number", spec.number))
        .unique();
      if (existing) continue;
      const lessonId = await nextId(ctx, "lessons");
      await ctx.db.insert("lessons", {
        legacyId: lessonId,
        courseId: course.legacyId,
        number: spec.number,
        title: spec.title,
        framework: spec.framework,
        summary: spec.summary,
        groupName: spec.group,
        hasReport: spec.hasReport ? 1 : 0,
        storageKey: spec.storageKey,
        contentVersion: spec.contentVersion,
        schemaVersion: spec.schemaVersion,
      });
      await attachNewLesson(ctx, course.legacyId, lessonId, spec.number);
      insertedLessons.push({ courseId: course.legacyId, lessonId });
    }
    const cms = await ctx.db.query("cmsLessons").withIndex("by_number", (q) => q.eq("number", spec.number)).unique();
    let cmsInserted = false;
    if (!cms) {
      await ctx.db.insert("cmsLessons", {
        number: spec.number,
        titleVi: spec.title,
        titleEn: spec.titleEn,
        summaryVi: spec.summary,
        summaryEn: spec.summaryEn,
        published: 1,
        updatedAt: createdAt,
      });
      cmsInserted = true;
    }
    const ledesUpdated: string[] = [];
    for (const locale of ["vi", "en"] as const) {
      const next = SESSION21_MAP_LEDE[locale];
      const block = await ctx.db.query("cmsBlocks").withIndex("by_key_locale", (q) => q.eq("key", "map.lede").eq("locale", locale)).unique();
      if (!block) {
        await ctx.db.insert("cmsBlocks", { key: "map.lede", locale, body: next, updatedAt: createdAt });
        ledesUpdated.push(locale);
        continue;
      }
      if (block.body === SESSION20_MAP_LEDE[locale]) {
        await ctx.db.patch(block._id, { body: next, updatedAt: createdAt });
        ledesUpdated.push(locale);
      }
    }
    return {
      ok: true,
      courses: courses.length,
      lessonsInserted: insertedLessons.length,
      lessonIds: insertedLessons,
      cmsInserted,
      ledesUpdated,
    };
  },
});

export const addSessions22to27 = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const specs = LESSONS.filter((lesson) => lesson.number >= 22 && lesson.number <= 27);
    if (specs.length !== 6) throw new Error("LESSONS_22_27_MISSING");
    const createdAt = now();
    const courses = await bmdoCourses(ctx);
    const insertedLessons: { courseId: number; number: number; lessonId: number }[] = [];
    const cmsInserted: number[] = [];
    for (const spec of specs) {
      for (const course of courses) {
        const existing = await ctx.db
          .query("lessons")
          .withIndex("by_course_number", (q) => q.eq("courseId", course.legacyId).eq("number", spec.number))
          .unique();
        if (existing) continue;
        const lessonId = await nextId(ctx, "lessons");
        await ctx.db.insert("lessons", {
          legacyId: lessonId,
          courseId: course.legacyId,
          number: spec.number,
          title: spec.title,
          framework: spec.framework,
          summary: spec.summary,
          groupName: spec.group,
          hasReport: spec.hasReport ? 1 : 0,
          storageKey: spec.storageKey,
          contentVersion: spec.contentVersion,
          schemaVersion: spec.schemaVersion,
        });
        await attachNewLesson(ctx, course.legacyId, lessonId, spec.number);
        insertedLessons.push({ courseId: course.legacyId, number: spec.number, lessonId });
      }
      const cms = await ctx.db.query("cmsLessons").withIndex("by_number", (q) => q.eq("number", spec.number)).unique();
      if (!cms) {
        await ctx.db.insert("cmsLessons", {
          number: spec.number,
          titleVi: spec.title,
          titleEn: spec.titleEn,
          summaryVi: spec.summary,
          summaryEn: spec.summaryEn,
          published: 1,
          updatedAt: createdAt,
        });
        cmsInserted.push(spec.number);
      }
    }
    const ledesUpdated: string[] = [];
    for (const locale of ["vi", "en"] as const) {
      const next = SESSION27_MAP_LEDE[locale];
      const block = await ctx.db.query("cmsBlocks").withIndex("by_key_locale", (q) => q.eq("key", "map.lede").eq("locale", locale)).unique();
      if (!block) {
        await ctx.db.insert("cmsBlocks", { key: "map.lede", locale, body: next, updatedAt: createdAt });
        ledesUpdated.push(locale);
        continue;
      }
      if (block.body === SESSION21_MAP_LEDE[locale]) {
        await ctx.db.patch(block._id, { body: next, updatedAt: createdAt });
        ledesUpdated.push(locale);
      }
    }
    return {
      ok: true,
      courses: courses.length,
      lessonsInserted: insertedLessons.length,
      lessonIds: insertedLessons,
      cmsInserted,
      ledesUpdated,
    };
  },
});

export const addSessions28to30 = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const specs = LESSONS.filter((lesson) => lesson.number >= 28 && lesson.number <= 30);
    if (specs.length !== 3) throw new Error("LESSONS_28_30_MISSING");
    const createdAt = now();
    const courses = await bmdoCourses(ctx);
    const insertedLessons: { courseId: number; number: number; lessonId: number }[] = [];
    const cmsInserted: number[] = [];
    for (const spec of specs) {
      for (const course of courses) {
        const existing = await ctx.db
          .query("lessons")
          .withIndex("by_course_number", (q) => q.eq("courseId", course.legacyId).eq("number", spec.number))
          .unique();
        if (existing) continue;
        const lessonId = await nextId(ctx, "lessons");
        await ctx.db.insert("lessons", {
          legacyId: lessonId,
          courseId: course.legacyId,
          number: spec.number,
          title: spec.title,
          framework: spec.framework,
          summary: spec.summary,
          groupName: spec.group,
          hasReport: spec.hasReport ? 1 : 0,
          storageKey: spec.storageKey,
          contentVersion: spec.contentVersion,
          schemaVersion: spec.schemaVersion,
        });
        await attachNewLesson(ctx, course.legacyId, lessonId, spec.number);
        insertedLessons.push({ courseId: course.legacyId, number: spec.number, lessonId });
      }
      const cms = await ctx.db.query("cmsLessons").withIndex("by_number", (q) => q.eq("number", spec.number)).unique();
      if (!cms) {
        await ctx.db.insert("cmsLessons", {
          number: spec.number,
          titleVi: spec.title,
          titleEn: spec.titleEn,
          summaryVi: spec.summary,
          summaryEn: spec.summaryEn,
          published: 1,
          updatedAt: createdAt,
        });
        cmsInserted.push(spec.number);
      }
    }
    const ledesUpdated: string[] = [];
    for (const locale of ["vi", "en"] as const) {
      const next = CMS_BLOCKS.find((block) => block[0] === "map.lede" && block[1] === locale)?.[2];
      if (!next) continue;
      const block = await ctx.db.query("cmsBlocks").withIndex("by_key_locale", (q) => q.eq("key", "map.lede").eq("locale", locale)).unique();
      if (!block) {
        await ctx.db.insert("cmsBlocks", { key: "map.lede", locale, body: next, updatedAt: createdAt });
        ledesUpdated.push(locale);
        continue;
      }
      if (block.body === SESSION27_MAP_LEDE[locale]) {
        await ctx.db.patch(block._id, { body: next, updatedAt: createdAt });
        ledesUpdated.push(locale);
      }
    }
    return {
      ok: true,
      courses: courses.length,
      lessonsInserted: insertedLessons.length,
      lessonIds: insertedLessons,
      cmsInserted,
      ledesUpdated,
    };
  },
});

/**
 * Add the APPLIER course, its four lessons, and cohort "APPLIER · Cohort 01"
 * when they are missing. Does not write BMDO lessons, cmsLessons, cmsBlocks, or map.lede.
 *
 *   npx convex run seed:addCourseVabixApplier '{"secret":"<APP_SECRET>"}'
 */
export const addCourseVabixApplier = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const orgs = await ctx.db.query("organizations").collect();
    const org = orgs.find((row) => row.name === "VABIX") ?? orgs[0];
    if (!org) throw new Error("CATALOG_MISSING");
    const createdAt = now();
    let course = await ctx.db.query("courses").withIndex("by_slug", (q) => q.eq("slug", VABIX_COURSE.slug)).unique();
    let courseInserted = false;
    if (!course) {
      const courseId = await nextId(ctx, "courses");
      await ctx.db.insert("courses", {
        legacyId: courseId,
        slug: VABIX_COURSE.slug,
        code: VABIX_COURSE.code,
        title: VABIX_COURSE.title,
        tagline: VABIX_COURSE.tagline,
        intro: "",
        managementCode: courseManagementCode(VABIX_COURSE.code),
      });
      course = await ctx.db.query("courses").withIndex("by_legacy", (q) => q.eq("legacyId", courseId)).unique();
      courseInserted = true;
    }
    if (!course) throw new Error("COURSE_INSERT_FAILED");
    const courseRow = course;
    const insertedLessons: number[] = [];
    for (const spec of VABIX_LESSONS) {
      const existing = await ctx.db
        .query("lessons")
        .withIndex("by_course_number", (q) => q.eq("courseId", courseRow.legacyId).eq("number", spec.number))
        .unique();
      if (existing) continue;
      const lessonId = await nextId(ctx, "lessons");
      await ctx.db.insert("lessons", {
        legacyId: lessonId,
        courseId: courseRow.legacyId,
        number: spec.number,
        title: spec.title,
        framework: spec.framework,
        summary: spec.summary,
        groupName: spec.group,
        hasReport: spec.hasReport ? 1 : 0,
        storageKey: spec.storageKey,
        contentVersion: spec.contentVersion,
        schemaVersion: spec.schemaVersion,
        archived: 0,
        sortOrder: spec.number,
      });
      await attachNewLesson(ctx, courseRow.legacyId, lessonId, spec.number);
      insertedLessons.push(spec.number);
    }
    const cohorts = (await ctx.db.query("cohorts").collect()).filter((row) => row.courseId === courseRow.legacyId);
    let cohortInserted = false;
    let cohortId = cohorts[0]?.legacyId ?? 0;
    if (!cohortId) {
      cohortId = await nextId(ctx, "cohorts");
      await ctx.db.insert("cohorts", {
        legacyId: cohortId,
        organizationId: org.legacyId,
        courseId: courseRow.legacyId,
        name: VABIX_COURSE.cohortName,
        unlockMode: "all_open",
        reviewEnabled: 1,
        createdAt,
        code: classManagementCode(VABIX_COURSE.code, 1),
        instructorId: null,
        lessonsScoped: 1,
      });
      const applierLessons = await ctx.db.query("lessons").withIndex("by_course_number", (q) => q.eq("courseId", courseRow.legacyId)).collect();
      for (const lesson of applierLessons) {
        await ctx.db.insert("cohortLessons", { cohortId, lessonId: lesson.legacyId, sortOrder: lesson.sortOrder ?? lesson.number });
      }
      cohortInserted = true;
    }
    const cohortRow = await ctx.db.query("cohorts").withIndex("by_legacy", (q) => q.eq("legacyId", cohortId)).unique();
    if (cohortRow) await migrateCohortSessions(ctx, cohortRow);
    return {
      ok: true,
      courseId: courseRow.legacyId,
      courseInserted,
      lessonsInserted: insertedLessons,
      cohortId,
      cohortInserted,
    };
  },
});

export const upsertAdmin = mutation({
  args: {
    secret: v.string(),
    username: v.string(),
    passwordHash: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    gate(args.secret);
    const usernameLower = args.username.trim().toLowerCase();
    const org = await ctx.db.query("organizations").withIndex("by_legacy").first();
    if (!org) throw new Error("CATALOG_MISSING");
    const existing = await ctx.db.query("users").withIndex("by_username", (q) => q.eq("usernameLower", usernameLower)).unique();
    const stamp = now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        passwordHash: args.passwordHash,
        displayName: args.displayName,
        role: "admin",
        active: 1,
        mustChangePassword: 0,
        organizationId: org.legacyId,
        updatedAt: stamp,
        ...(existing.managementCode ? {} : { managementCode: instructorManagementCode(existing.legacyId) }),
      });
      return { id: existing.legacyId, updated: true };
    }
    const id = await nextId(ctx, "users");
    await ctx.db.insert("users", {
      legacyId: id,
      username: args.username.trim(),
      usernameLower,
      passwordHash: args.passwordHash,
      displayName: args.displayName,
      role: "admin",
      departmentId: null,
      permissionGroupId: null,
      organizationId: org.legacyId,
      active: 1,
      mustChangePassword: 0,
      createdAt: stamp,
      updatedAt: stamp,
      managementCode: instructorManagementCode(id),
    });
    return { id, updated: false };
  },
});

/**
 * Backfill Phase 1 mã, class lesson subsets, a single instructor pointer,
 * then one buổi per class covering that subset.
 * Idempotent. Does not rewrite lesson answers.
 *
 *   npx convex run seed:backfillPhase1 '{"secret":"<APP_SECRET>"}'
 */
export const backfillPhase1 = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const courseCodes = new Set<string>();
    let coursesUpdated = 0;
    for (const course of await ctx.db.query("courses").collect()) {
      if (course.managementCode) {
        courseCodes.add(course.managementCode);
        continue;
      }
      const code = nextFreeCode(courseManagementCode(course.code || course.slug), courseCodes);
      if (!code) continue;
      courseCodes.add(code);
      await ctx.db.patch(course._id, { managementCode: code, intro: course.intro ?? "" });
      coursesUpdated += 1;
    }
    const classCodes = new Set<string>();
    const cohorts = await ctx.db.query("cohorts").collect();
    for (const cohort of cohorts) if (cohort.code) classCodes.add(cohort.code);
    const courses = await ctx.db.query("courses").collect();
    const lessons = await ctx.db.query("lessons").collect();
    const enrollments = await ctx.db.query("enrollments").collect();
    let cohortsUpdated = 0;
    let linksInserted = 0;
    const byCourse = new Map<number, typeof cohorts>();
    for (const cohort of cohorts.sort((a, b) => a.legacyId - b.legacyId)) {
      const list = byCourse.get(cohort.courseId) ?? [];
      list.push(cohort);
      byCourse.set(cohort.courseId, list);
    }
    for (const [courseId, rows] of byCourse) {
      const course = courses.find((item) => item.legacyId === courseId);
      let seq = 0;
      for (const cohort of rows) {
        seq += 1;
        const patch: { code?: string; instructorId?: number | null; lessonsScoped?: number } = {};
        if (!cohort.code && course) {
          const code = nextFreeCode(classManagementCode(course.code, seq), classCodes);
          if (code) {
            classCodes.add(code);
            patch.code = code;
          }
        }
        if (cohort.instructorId == null) {
          const coach = enrollments
            .filter((row) => row.cohortId === cohort.legacyId && row.memberRole === "coach")
            .sort((a, b) => a.legacyId - b.legacyId)[0];
          if (coach) patch.instructorId = coach.userId;
        }
        const links = await ctx.db.query("cohortLessons").withIndex("by_cohort", (q) => q.eq("cohortId", cohort.legacyId)).collect();
        if (cohort.lessonsScoped !== 1) {
          if (links.length === 0) {
            const catalog = lessons.filter((row) => row.courseId === cohort.courseId).sort((a, b) => a.number - b.number);
            for (const lesson of catalog) {
              await ctx.db.insert("cohortLessons", { cohortId: cohort.legacyId, lessonId: lesson.legacyId, sortOrder: lesson.sortOrder ?? lesson.number });
              linksInserted += 1;
            }
          }
          patch.lessonsScoped = 1;
        }
        if (Object.keys(patch).length) {
          await ctx.db.patch(cohort._id, patch);
          cohortsUpdated += 1;
        }
      }
    }
    const userCodes = new Set<string>();
    let usersUpdated = 0;
    for (const user of await ctx.db.query("users").collect()) {
      if (user.managementCode) {
        userCodes.add(user.managementCode);
        continue;
      }
      const teaches = cohorts.some((row) => row.instructorId === user.legacyId);
      const learns = enrollments.some((row) => row.userId === user.legacyId && row.memberRole === "learner");
      const preferred = user.role !== "user" || (teaches && !learns)
        ? instructorManagementCode(user.legacyId)
        : learnerManagementCode(user.legacyId);
      const code = nextFreeCode(preferred, userCodes);
      if (!code) continue;
      userCodes.add(code);
      await ctx.db.patch(user._id, { managementCode: code });
      usersUpdated += 1;
    }
    const sessions = await ensureSessionsBackfill(ctx);
    return { coursesUpdated, cohortsUpdated, linksInserted, usersUpdated, ...sessions };
  },
});

/**
 * Turn each class lesson subset into one buổi covering those bài.
 * Scheduled classes become all_open because the buổi has no date.
 * Idempotent. Does not rewrite lesson answers.
 *
 *   npx convex run seed:backfillClassSessions '{"secret":"<APP_SECRET>"}'
 */
export const backfillClassSessions = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const result = await migrateAllCohorts(ctx);
    await markSessionsBackfill(ctx);
    return result;
  },
});
