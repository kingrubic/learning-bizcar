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

export type UnlockMode = "all_open" | "sequential" | "scheduled";

export type SubsetLesson = { id: number; number: number; sortOrder: number };

export type ClassSessionPlan = {
  id: number;
  sortOrder: number;
  title: string;
  sessionDate: string | null;
  lessonIds: number[];
};

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

export function orderSessions<T extends { sortOrder: number; id: number }>(sessions: T[]) {
  return [...sessions].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/** Calendar date opens at 00:00 Asia/Ho_Chi_Minh. */
export function sessionDateMs(sessionDate: string | null) {
  if (!sessionDate || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return null;
  const ms = Date.parse(`${sessionDate}T00:00:00+07:00`);
  return Number.isNaN(ms) ? null : ms;
}

export function validSessionDate(sessionDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return false;
  const [year, month, day] = sessionDate.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

export function sessionIsComplete(lessonIds: number[], answers: { lessonId: number; status: string }[]) {
  if (lessonIds.length === 0) return true;
  const byId = new Map(answers.map((row) => [row.lessonId, row.status]));
  return lessonIds.every((id) => DONE.has(byId.get(id) ?? ""));
}

export function isSessionUnlocked(input: {
  mode: UnlockMode;
  sessions: ClassSessionPlan[];
  sessionId: number;
  answers: { lessonId: number; status: string }[];
  nowMs: number;
}) {
  const ordered = orderSessions(input.sessions);
  const index = ordered.findIndex((session) => session.id === input.sessionId);
  if (index < 0) return false;
  if (input.mode === "all_open") return true;
  if (input.mode === "scheduled") {
    const at = sessionDateMs(ordered[index].sessionDate);
    if (at == null) return false;
    return at <= input.nowMs;
  }
  if (index === 0) return true;
  return sessionIsComplete(ordered[index - 1].lessonIds, input.answers);
}

/** A bài is open when any buổi that includes it is unlocked. */
export function isLessonInOpenSession(input: {
  mode: UnlockMode;
  sessions: ClassSessionPlan[];
  lessonId: number;
  answers: { lessonId: number; status: string }[];
  nowMs: number;
}) {
  return input.sessions.some((session) => session.lessonIds.includes(input.lessonId) && isSessionUnlocked({
    mode: input.mode,
    sessions: input.sessions,
    sessionId: session.id,
    answers: input.answers,
    nowMs: input.nowMs,
  }));
}

/** Unique bài across buổi, ordered by the first buổi that includes each one. */
export function lessonsOnPlan<T extends { id: number; number: number; sortOrder: number }>(catalog: T[], sessions: ClassSessionPlan[]) {
  const byId = new Map(catalog.map((lesson) => [lesson.id, lesson]));
  const placed = new Map<number, { sessionOrder: number; lessonOrder: number }>();
  for (const session of orderSessions(sessions)) {
    session.lessonIds.forEach((lessonId, index) => {
      if (!placed.has(lessonId)) placed.set(lessonId, { sessionOrder: session.sortOrder, lessonOrder: index });
    });
  }
  return [...placed.entries()]
    .flatMap(([id, pos]) => {
      const lesson = byId.get(id);
      return lesson ? [{ lesson, pos }] : [];
    })
    .sort((a, b) => a.pos.sessionOrder - b.pos.sessionOrder || a.pos.lessonOrder - b.pos.lessonOrder || a.lesson.sortOrder - b.lesson.sortOrder || a.lesson.number - b.lesson.number || a.lesson.id - b.lesson.id)
    .map((row) => row.lesson);
}

export function fallbackSessions(lessonIds: number[]): ClassSessionPlan[] {
  if (lessonIds.length === 0) return [];
  return [{ id: 0, sortOrder: 1, title: "Buổi 01", sessionDate: null, lessonIds }];
}

/** A class with no buổi yet has no date to schedule against, so scheduled must not lock the old subset. */
export function accessMode(mode: UnlockMode, persisted: boolean): UnlockMode {
  if (!persisted && mode === "scheduled") return "all_open";
  return mode;
}

export function normalizeSessionDrafts(
  catalog: { id: number }[],
  drafts: { title: string; sessionDate: string | null; lessonIds: number[] }[],
): { ok: true; sessions: { title: string; sessionDate: string | null; lessonIds: number[] }[] } | { ok: false; error: string } {
  const order = new Map(catalog.map((row, index) => [row.id, index]));
  const sessions: { title: string; sessionDate: string | null; lessonIds: number[] }[] = [];
  for (const draft of drafts) {
    const sessionDate = draft.sessionDate?.trim() || null;
    if (sessionDate && !validSessionDate(sessionDate)) return { ok: false, error: "Ngày buổi không hợp lệ." };
    const lessonIds = [...new Set(draft.lessonIds.filter((id) => order.has(id)))].sort((a, b) => order.get(a)! - order.get(b)!);
    if (lessonIds.length === 0) return { ok: false, error: "Mỗi buổi cần ít nhất một bài học của khoá." };
    sessions.push({ title: draft.title.trim().slice(0, 80), sessionDate, lessonIds });
  }
  return { ok: true, sessions };
}

export function lessonUnlocked(input: {
  mode: UnlockMode;
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
