import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  accessMode,
  fallbackSessions,
  lessonsOnPlan,
  orderSessions,
  resolveSubset,
  type ClassSessionPlan,
  type SubsetLesson,
  type UnlockMode,
} from "./codes";

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

export type StoredSession = {
  legacyId: number;
  cohortId: number;
  title: string;
  sessionDate: string | null;
  sortOrder: number;
};

export type StoredSessionLesson = {
  sessionId: number;
  lessonId: number;
  sortOrder: number;
};

export type LoadedCatalog = {
  lessons: CatalogRow[];
  links: { cohortId: number; lessonId: number; sortOrder: number }[];
  sessions: StoredSession[];
  sessionLessons: StoredSessionLesson[];
};

type CohortScope = {
  legacyId: number;
  courseId: number;
  lessonsScoped?: number;
  unlockMode: UnlockMode;
  sessionsReady?: number;
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

export async function loadCatalog(ctx: DbCtx): Promise<LoadedCatalog> {
  const lessons = (await ctx.db.query("lessons").collect()).map(toCatalog);
  const links = await ctx.db.query("cohortLessons").collect();
  const sessions = await ctx.db.query("classSessions").collect();
  const sessionLessons = await ctx.db.query("classSessionLessons").collect();
  return { lessons, links, sessions, sessionLessons };
}

export function cohortPlan(loaded: LoadedCatalog, cohort: CohortScope): { sessions: ClassSessionPlan[]; mode: UnlockMode; persisted: boolean } {
  const catalog = loaded.lessons.filter((lesson) => lesson.courseId === cohort.courseId);
  const allowed = new Set(catalog.map((lesson) => lesson.id));
  const own = loaded.sessions.filter((row) => row.cohortId === cohort.legacyId);
  const persisted = cohort.sessionsReady === 1 || own.length > 0;
  if (persisted) {
    return {
      persisted: true,
      mode: cohort.unlockMode,
      sessions: orderSessions(own.map((row) => ({
        id: row.legacyId,
        sortOrder: row.sortOrder,
        title: row.title,
        sessionDate: row.sessionDate,
        lessonIds: loaded.sessionLessons
          .filter((link) => link.sessionId === row.legacyId && allowed.has(link.lessonId))
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((link) => link.lessonId),
      }))),
    };
  }
  const scoped = cohort.lessonsScoped === 1;
  const subset = resolveSubset(catalog, scoped ? loaded.links.filter((link) => link.cohortId === cohort.legacyId) : null, scoped);
  return {
    persisted: false,
    mode: accessMode(cohort.unlockMode, false),
    sessions: fallbackSessions(subset.map((lesson) => lesson.id)),
  };
}

export function classCatalog(loaded: LoadedCatalog, cohort: CohortScope) {
  const plan = cohortPlan(loaded, cohort);
  return lessonsOnPlan(loaded.lessons.filter((lesson) => lesson.courseId === cohort.courseId), plan.sessions);
}
