import type { MutationCtx, QueryCtx } from "./_generated/server";
import { resolveSubset, type SubsetLesson } from "./codes";

type DbCtx = QueryCtx | MutationCtx;

export type CatalogRow = SubsetLesson & {
  courseId: number;
  title: string;
  framework: string;
  summary: string;
  groupName: string;
  hasReport: number;
  contentVersion: string;
  schemaVersion: string;
  storageKey: string;
  archived: number;
};

type LessonDoc = {
  legacyId: number;
  courseId: number;
  number: number;
  title: string;
  framework: string;
  summary: string;
  groupName: string;
  hasReport: number;
  contentVersion: string;
  schemaVersion: string;
  storageKey: string;
  archived?: number;
  sortOrder?: number;
};

export function toCatalog(row: LessonDoc): CatalogRow {
  return {
    id: row.legacyId,
    courseId: row.courseId,
    number: row.number,
    sortOrder: row.sortOrder ?? row.number,
    title: row.title,
    framework: row.framework,
    summary: row.summary,
    groupName: row.groupName,
    hasReport: row.hasReport,
    contentVersion: row.contentVersion,
    schemaVersion: row.schemaVersion,
    storageKey: row.storageKey,
    archived: row.archived === 1 ? 1 : 0,
  };
}

export async function loadCatalog(ctx: DbCtx) {
  const lessons = (await ctx.db.query("lessons").collect()).map(toCatalog);
  const links = await ctx.db.query("cohortLessons").collect();
  return { lessons, links };
}

export function classCatalog(
  lessons: CatalogRow[],
  links: { cohortId: number; lessonId: number; sortOrder: number }[],
  cohort: { legacyId: number; courseId: number; lessonsScoped?: number },
) {
  const catalog = lessons.filter((lesson) => lesson.courseId === cohort.courseId);
  const scoped = cohort.lessonsScoped === 1;
  const cohortLinks = scoped ? links.filter((link) => link.cohortId === cohort.legacyId) : null;
  return resolveSubset(catalog, cohortLinks, scoped);
}
