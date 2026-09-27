import type { LessonMeta, WorkbookField } from "./course";

export const BABOSORA_COURSE = {
  slug: "babosora-applier",
  code: "BABOSORA",
  title: "BABOSORA — Thao trường APPLIER 04 buổi",
  tagline: "Thao trường tương tác 4 buổi · BA · BTS · BO · SO · RA.",
  cohortName: "BABOSORA · Cohort 01",
  mapLede: {
    vi: "Bốn buổi thao trường APPLIER: định vị BA, phủ sóng BTS, xác nhận BO, rồi chuyển BO thành SO và quản trị RA.",
    en: "Four APPLIER practice sessions: position BA, design BTS coverage, confirm BO, then turn BO into SO and manage RA.",
  },
} as const;

type BabosoraLesson = LessonMeta & { titleEn: string; summaryEn: string };

export const BABOSORA_LESSONS: BabosoraLesson[] = [
  {
    number: 1,
    code: "01",
    title: "Định vị và đo điểm nghẽn BA",
    titleEn: "Position and measure the BA bottleneck",
    framework: "BA",
    summary: "Chọn đúng B2A Segment, lập BA Cell, đo BA Signal Strength và xác định nghẽn Biết – Thích – Tin.",
    summaryEn: "Choose the B2A segment, build a BA cell, measure signal strength, and name the awareness–like–trust gap.",
    group: "APPLIER",
    hasReport: false,
    storageKey: "babosora-applier-buoi01-ba-v1",
    schemaVersion: "1",
    contentVersion: "2026.09",
  },
  {
    number: 2,
    code: "02",
    title: "Thiết kế hệ thống phủ sóng BA",
    titleEn: "Design the BA coverage system",
    framework: "BTS",
    summary: "Chọn trạm BTS trên 4O, thiết kế BA Signals và lập kế hoạch đưa Signal Strength từ mức hiện tại đến mức mục tiêu.",
    summaryEn: "Pick the 4O stations, design BA signals, and plan the move from the current signal strength to the target.",
    group: "APPLIER",
    hasReport: false,
    storageKey: "babosora-applier-buoi02-bts-v1",
    schemaVersion: "1",
    contentVersion: "2026.09",
  },
  {
    number: 3,
    code: "03",
    title: "Săn và xác nhận Business Opportunity",
    titleEn: "Hunt and confirm the business opportunity",
    framework: "BO",
    summary: "Phân biệt Lead với BO, xác định BO nóng/lạnh, tính BO/BA và thiết kế cơ cấu nguồn săn BO.",
    summaryEn: "Separate leads from BO, mark hot and cold opportunities, compute BO/BA, and design the source mix.",
    group: "APPLIER",
    hasReport: false,
    storageKey: "babosora-applier-buoi03-bo-v1",
    schemaVersion: "1",
    contentVersion: "2026.09",
  },
  {
    number: 4,
    code: "04",
    title: "Chuyển BO thành SO và quản trị RA",
    titleEn: "Turn BO into SO and manage RA",
    framework: "SO · RA",
    summary: "Chẩn đoán nghẽn SO, thực hành ASKING với Key Gap và thiết kế tăng trưởng sáu dòng doanh thu BRUCCS.",
    summaryEn: "Find the SO bottleneck, practice ASKING around the key gap, and grow the six BRUCCS revenue streams.",
    group: "APPLIER",
    hasReport: false,
    storageKey: "babosora-applier-buoi04-so-ra-v1",
    schemaVersion: "1",
    contentVersion: "2026.09",
  },
];

const SHARED: [string, string][] = [
  ["choiceText", "Lựa chọn"],
  ["reflection", "Điểm cần xem lại"],
  ["before", "Phương án ban đầu"],
  ["after", "Phiên bản sau soi chiếu"],
  ["evidence", "Bằng chứng cần bổ sung"],
  ["extract", "Đúc kết"],
];

const OWN: [string, string][][] = [
  [
    ["b2a", "B2A Segment ưu tiên"],
    ["cell", "BA Cell"],
    ["strength", "Signal Strength hiện tại"],
    ["bottleneck", "Điểm nghẽn ALT"],
    ["missing", "Dữ liệu còn thiếu"],
    ["action", "Hành động trong 7 ngày"],
  ],
  [
    ["target", "BA Cell cần phủ"],
    ["shift", "Mục tiêu Signal Strength"],
    ["stations", "Tổ hợp BTS 4O"],
    ["signal", "BA Signal cốt lõi"],
    ["measure", "Chỉ số xác nhận"],
    ["plan", "Kế hoạch 30–90 ngày"],
  ],
  [
    ["gate", "Cổng xác nhận BO"],
    ["hot", "Tiêu chuẩn BO nóng"],
    ["ratio", "Tỷ lệ BO/BA hiện tại"],
    ["sources", "Cơ cấu nguồn BO"],
    ["block", "Điểm nghẽn BO"],
    ["action", "Hành động trong 30 ngày"],
  ],
  [
    ["standard", "Chuẩn xác nhận SO"],
    ["ratio", "SO/BO hiện tại"],
    ["asking", "Điểm nghẽn ASKING"],
    ["script", "Câu hỏi Key Gap"],
    ["bruccs", "Trụ BRUCCS ưu tiên"],
    ["ra", "Kế hoạch RA 90 ngày"],
  ],
];

export function babosoraLesson(number: number) {
  return BABOSORA_LESSONS.find((lesson) => lesson.number === number);
}

export function babosoraFields(number: number): WorkbookField[] {
  const index = number - 1;
  const own = OWN[index];
  if (!own) return [];
  const shared = SHARED.map(([name, label]) => ({ path: `answers.s${index}.${name}`, label }));
  return shared.concat(own.map(([name, label]) => ({ path: `answers.s${index}.own.${name}`, label })));
}

export function isBabosoraStorageKey(storageKey: string | undefined) {
  return Boolean(storageKey?.startsWith("babosora-applier-"));
}

export function isBabosoraCourse(slug: string | undefined, storageKey?: string) {
  return slug === BABOSORA_COURSE.slug || isBabosoraStorageKey(storageKey);
}

export function babosoraDisplay(storageKey: string | undefined, number: number, locale: "vi" | "en") {
  if (!isBabosoraStorageKey(storageKey)) return null;
  const row = babosoraLesson(number);
  if (!row) return null;
  return locale === "en"
    ? { title: row.titleEn, summary: row.summaryEn }
    : { title: row.title, summary: row.summary };
}

export function babosoraHtmlPath() {
  return "source/babosora-applier/index.html";
}
