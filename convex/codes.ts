export const BMDO_SLUG = "bmdo-k03";

const DONE = new Set(["completed", "submitted", "reviewed"]);

export function codeToken(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function courseManagementCode(codeOrSlug: string) {
  const token = codeToken(codeOrSlug);
  return token ? `KH-${token}` : "";
}

export function classManagementCode(courseCode: string, seq: number) {
  const token = codeToken(courseCode);
  return token ? `LH-${token}-${String(Math.max(1, seq)).padStart(2, "0")}` : "";
}

export function learnerManagementCode(legacyId: number) {
  return `HV-${String(legacyId).padStart(4, "0")}`;
}

export function instructorManagementCode(legacyId: number) {
  return `GV-${String(legacyId).padStart(4, "0")}`;
}

export function slugFromCode(code: string) {
  return code.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function nextFreeCode(base: string, taken: Set<string>) {
  if (!base) return "";
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return "";
}

export type SubsetLesson = { id: number; number: number; sortOrder: number };

export function resolveSubset<T extends SubsetLesson>(
  catalog: T[],
  links: { lessonId: number; sortOrder: number }[] | null,
  lessonsScoped: boolean,
): T[] {
  const ordered = [...catalog].sort((a, b) => a.sortOrder - b.sortOrder || a.number - b.number || a.id - b.id);
  if (!lessonsScoped || !links) return ordered;
  const order = new Map(links.map((link) => [link.lessonId, link.sortOrder]));
  return ordered
    .filter((lesson) => order.has(lesson.id))
    .sort((a, b) => (order.get(a.id)! - order.get(b.id)!) || a.number - b.number || a.id - b.id);
}

export function subsetProgress(lessonIds: number[], answers: { lessonId: number; status: string }[]) {
  const byId = new Map(answers.map((row) => [row.lessonId, row.status]));
  const completed = lessonIds.filter((id) => DONE.has(byId.get(id) ?? "")).length;
  const total = lessonIds.length;
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 };
}

export function lessonUnlocked(input: {
  mode: "all_open" | "sequential" | "scheduled";
  orderedIds: number[];
  lessonId: number;
  answers: { lessonId: number; status: string }[];
  unlockAt: string | null | undefined;
  nowMs: number;
}) {
  const index = input.orderedIds.indexOf(input.lessonId);
  if (index < 0) return false;
  if (input.mode === "all_open") return true;
  if (input.mode === "scheduled") {
    if (!input.unlockAt) return false;
    return new Date(input.unlockAt).getTime() <= input.nowMs;
  }
  if (index === 0) return true;
  const previous = input.orderedIds[index - 1];
  return DONE.has(input.answers.find((row) => row.lessonId === previous)?.status ?? "");
}
