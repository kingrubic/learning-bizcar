import { cache } from "react";
import { api, q } from "./convex";
import type { Locale } from "./i18n";

export type CmsLesson = {
  number: number;
  title_vi: string;
  title_en: string;
  summary_vi: string;
  summary_en: string;
  published: number;
};

const loadCms = cache(() => q((convex, secret) => convex.query(api.reads.cmsState, { secret })));

export async function cmsBlock(key: string, locale: Locale, fallback: string) {
  const row = (await loadCms()).blocks.find((item) => item.key === key && item.locale === locale);
  return row?.body?.trim() || fallback;
}

export async function cmsBlocks() {
  return (await loadCms()).blocks;
}

export async function cmsAnnouncements(locale: Locale, includeHidden = false) {
  const rows = (await loadCms()).announcements;
  if (includeHidden) return rows;
  return rows.filter((row) => row.published === 1 && row.locale === locale);
}

export async function cmsLessons() {
  return (await loadCms()).lessons;
}

export async function cmsLesson(number: number) {
  return (await loadCms()).lessons.find((row) => row.number === number);
}

export async function lessonPublished(number: number) {
  const row = await cmsLesson(number);
  return !row || row.published === 1;
}
