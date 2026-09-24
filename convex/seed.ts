import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { CMS_BLOCKS, COURSE, LESSONS, PERMISSION_PRESETS, PREVIOUS_MAP_LEDE } from "./catalog";
import { gate, nextId, now } from "./helpers";

export const ensureCatalog = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const existing = await ctx.db.query("courses").withIndex("by_slug", (q) => q.eq("slug", COURSE.slug)).unique();
    if (existing) return { ok: true, seeded: false };

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
    });
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
    return { ok: true, seeded: true };
  },
});

export const addSession20 = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const spec = LESSONS.find((lesson) => lesson.number === 20);
    if (!spec) throw new Error("LESSON_20_MISSING");
    const createdAt = now();
    const courses = await ctx.db.query("courses").collect();
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
      const next = CMS_BLOCKS.find((block) => block[0] === "map.lede" && block[1] === locale)?.[2];
      if (!next) continue;
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
    });
    return { id, updated: false };
  },
});
