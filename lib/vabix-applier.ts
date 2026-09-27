import type { LessonMeta, WorkbookField } from "./course";

export const VABIX_COURSE = {
  slug: "vabix-applier",
  code: "APPLIER",
  title: "VABIX — Tỉnh thức · Kiến tạo · Điều hướng",
  tagline: "Thao trường lãnh đạo 4 buổi · APPLIER.",
  cohortName: "APPLIER · Cohort 01",
  mapLede: {
    vi: "Bốn buổi thao trường lãnh đạo: Tỉnh, Chủ, Kiến tạo, Điều hướng. Mỗi buổi là bảy bước APPLIER.",
    en: "Four leadership practice sessions: Awareness, Mastery, Creation, and Navigation. Each session is seven APPLIER steps.",
  },
} as const;

type VabixLesson = LessonMeta & { titleEn: string; summaryEn: string };

export const VABIX_LESSONS: VabixLesson[] = [
  {
    number: 1,
    code: "01",
    title: "TỈNH",
    titleEn: "TỈNH",
    framework: "SELF-AWARENESS",
    summary: "Thấy rõ trước khi phản ứng.",
    summaryEn: "See clearly before reacting.",
    group: "APPLIER",
    hasReport: false,
    storageKey: "vabix-applier-buoi01-tinh-v1",
    schemaVersion: "1",
    contentVersion: "2026.09",
  },
  {
    number: 2,
    code: "02",
    title: "CHỦ",
    titleEn: "CHỦ",
    framework: "SELF-MASTERY",
    summary: "Làm chủ mình dưới áp lực.",
    summaryEn: "Stay in command under pressure.",
    group: "APPLIER",
    hasReport: false,
    storageKey: "vabix-applier-buoi02-chu-v1",
    schemaVersion: "1",
    contentVersion: "2026.09",
  },
  {
    number: 3,
    code: "03",
    title: "KIẾN TẠO",
    titleEn: "KIẾN TẠO",
    framework: "RÕ · THẬT · CHỦ · LỰC",
    summary: "Từ SELF đến SHARED: Rõ, Thật, Chủ, Lực.",
    summaryEn: "From self to shared: clear, true, owned, and resourced.",
    group: "APPLIER",
    hasReport: false,
    storageKey: "vabix-applier-buoi03-kien-tao-v1",
    schemaVersion: "1",
    contentVersion: "2026.09",
  },
  {
    number: 4,
    code: "04",
    title: "ĐIỀU HƯỚNG",
    titleEn: "ĐIỀU HƯỚNG",
    framework: "SEE · SENSE · SELECT · STEER",
    summary: "Từ SHARED đến SYSTEM: See, Sense, Select, Steer.",
    summaryEn: "From shared to system: see, sense, select, and steer.",
    group: "APPLIER",
    hasReport: false,
    storageKey: "vabix-applier-buoi04-dieu-huong-v1",
    schemaVersion: "1",
    contentVersion: "2026.09",
  },
];

const FIELD_LABELS: [string, string][] = [
  ["choiceText", "Lựa chọn"],
  ["observation", "Điều vừa nhận ra"],
  ["practice", "Bài thực hành"],
  ["lens", "Điểm cần xem lại"],
  ["improve", "Phiên bản sau cải tiến"],
  ["extract", "Đúc kết"],
  ["action", "Việc trong 24 giờ"],
  ["signal", "Tín hiệu kiểm tra"],
];

export function vabixLesson(number: number) {
  return VABIX_LESSONS.find((lesson) => lesson.number === number);
}

export function vabixFields(number: number): WorkbookField[] {
  const index = number - 1;
  if (index < 0 || index > 3) return [];
  return FIELD_LABELS.map(([name, label]) => ({ path: `answers.${index}.${name}`, label }));
}

export function isVabixStorageKey(storageKey: string | undefined) {
  return Boolean(storageKey?.startsWith("vabix-applier-"));
}

export function isVabixCourse(slug: string | undefined, storageKey?: string) {
  return slug === VABIX_COURSE.slug || isVabixStorageKey(storageKey);
}

export function vabixDisplay(storageKey: string | undefined, number: number, locale: "vi" | "en") {
  if (!isVabixStorageKey(storageKey)) return null;
  const row = vabixLesson(number);
  if (!row) return null;
  return locale === "en"
    ? { title: row.titleEn, summary: row.summaryEn }
    : { title: row.title, summary: row.summary };
}

export function vabixHtmlPath() {
  return "source/vabix-applier/index.html";
}

export function bizcarHtmlPath(code: string) {
  return `source/bizcar-original/BMDO-Buoi${code}-Interactive/BMDO-Buoi${code}-Interactive/index.html`;
}
