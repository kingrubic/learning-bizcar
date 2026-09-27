import {
  accessMode,
  classManagementCode,
  classPickerLabel,
  courseManagementCode,
  fallbackSessions,
  instructorManagementCode,
  isLessonInOpenSession,
  isSessionUnlocked,
  learnerManagementCode,
  lessonUnlocked,
  lessonsOnPlan,
  nextFreeCode,
  normalizeSessionDrafts,
  resolveSubset,
  sessionDateMs,
  slugFromCode,
  subsetProgress,
  validSessionDate,
} from "./codes.ts";

function expect(cond: boolean, label: string) {
  if (!cond) throw new Error(label);
}

expect(courseManagementCode("BMDO K03") === "KH-BMDO-K03", "course code");
expect(courseManagementCode("vabix-applier") === "KH-VABIX-APPLIER", "course slug");
expect(classManagementCode("BMDO K03", 1) === "LH-BMDO-K03-01", "class code");
expect(classPickerLabel({ name: "BMDO K03 · Cohort 01", code: "LH-BMDO-K03-01", courseCode: "BMDO K03" }) === "LH-BMDO-K03-01 · BMDO K03 · Cohort 01", "bmdo class label");
expect(classPickerLabel({ name: "APPLIER · Cohort 01", code: "LH-APPLIER-01", courseCode: "APPLIER" }) === "LH-APPLIER-01 · APPLIER · Cohort 01", "applier class label");
expect(classPickerLabel({ name: "Lớp sáng", code: "LH-BMDO-K03-02", courseCode: "BMDO K03" }) === "LH-BMDO-K03-02 · Lớp sáng · BMDO K03", "course code secondary");
expect(classPickerLabel({ name: "BMDO K03", courseCode: "BMDO K03" }) === "Lớp · BMDO K03", "unnamed code still a class");
expect(classPickerLabel({ name: "  ", code: "", courseCode: "" }) === "Lớp chưa đặt tên", "empty class name");
expect(learnerManagementCode(7) === "HV-0007", "learner code");
expect(instructorManagementCode(12) === "GV-0012", "instructor code");
expect(slugFromCode("BMDO K04") === "bmdo-k04", "slug");
expect(nextFreeCode("KH-BMDO-K03", new Set(["KH-BMDO-K03"])) === "KH-BMDO-K03-2", "free code");

const catalog = [
  { id: 1, number: 1, sortOrder: 1 },
  { id: 2, number: 2, sortOrder: 2 },
  { id: 5, number: 5, sortOrder: 5 },
];
expect(resolveSubset(catalog, null, false).map((row) => row.id).join() === "1,2,5", "full catalog");
const subset = resolveSubset(catalog, [{ lessonId: 5, sortOrder: 1 }, { lessonId: 1, sortOrder: 2 }], true);
expect(subset.map((row) => row.id).join() === "5,1", "subset order");
expect(resolveSubset(catalog, [], true).length === 0, "explicit empty");

const answers = [{ lessonId: 5, status: "completed" }, { lessonId: 1, status: "in_progress" }];
const progress = subsetProgress([5, 1], answers);
expect(progress.completed === 1 && progress.total === 2 && progress.percent === 50, "subset progress");

const ordered = [5, 1];
expect(lessonUnlocked({ mode: "sequential", orderedIds: ordered, lessonId: 5, answers, unlockAt: null, nowMs: 0 }), "first open");
expect(!lessonUnlocked({ mode: "sequential", orderedIds: ordered, lessonId: 1, answers: [], unlockAt: null, nowMs: 0 }), "second waits");
expect(lessonUnlocked({ mode: "sequential", orderedIds: ordered, lessonId: 1, answers: [{ lessonId: 5, status: "submitted" }], unlockAt: null, nowMs: 0 }), "second after done");
expect(!lessonUnlocked({ mode: "all_open", orderedIds: ordered, lessonId: 9, answers, unlockAt: null, nowMs: 0 }), "outside subset");
expect(lessonUnlocked({ mode: "scheduled", orderedIds: ordered, lessonId: 1, answers, unlockAt: "2020-01-01T00:00:00.000Z", nowMs: Date.parse("2021-01-01T00:00:00.000Z") }), "scheduled open");
expect(!lessonUnlocked({ mode: "scheduled", orderedIds: ordered, lessonId: 1, answers, unlockAt: null, nowMs: Date.now() }), "scheduled missing");

const openAt = sessionDateMs("2026-09-27");
expect(openAt === Date.parse("2026-09-27T00:00:00+07:00"), "session midnight ict");
expect(validSessionDate("2026-09-27") && !validSessionDate("2026-02-31") && !validSessionDate("27-09-2026"), "calendar date");

const sessions = [
  { id: 10, sortOrder: 1, title: "Buổi 01", sessionDate: "2026-09-01", lessonIds: [5, 1] },
  { id: 11, sortOrder: 2, title: "Buổi 02", sessionDate: "2026-10-01", lessonIds: [1, 2] },
];
const now = Date.parse("2026-09-15T00:00:00+07:00");
expect(isSessionUnlocked({ mode: "scheduled", sessions, sessionId: 10, answers, nowMs: now }), "dated buổi open");
expect(!isSessionUnlocked({ mode: "scheduled", sessions, sessionId: 11, answers, nowMs: now }), "future buổi locked");
expect(!isSessionUnlocked({ mode: "scheduled", sessions: [{ ...sessions[0], sessionDate: null }], sessionId: 10, answers, nowMs: now }), "missing date locked");
expect(isLessonInOpenSession({ mode: "scheduled", sessions, lessonId: 5, answers, nowMs: now }), "bài in open buổi");
expect(isLessonInOpenSession({ mode: "scheduled", sessions, lessonId: 1, answers, nowMs: now }), "shared bài follows the open buổi");
expect(!isLessonInOpenSession({ mode: "scheduled", sessions, lessonId: 2, answers, nowMs: now }), "bài waits for its buổi");
expect(!isLessonInOpenSession({ mode: "all_open", sessions, lessonId: 9, answers, nowMs: now }), "bài outside buổi");
expect(!isSessionUnlocked({ mode: "sequential", sessions, sessionId: 11, answers: [], nowMs: 0 }), "next buổi waits");
expect(isSessionUnlocked({ mode: "sequential", sessions, sessionId: 11, answers: [{ lessonId: 5, status: "completed" }, { lessonId: 1, status: "reviewed" }], nowMs: 0 }), "next buổi after bài done");
expect(isSessionUnlocked({ mode: "all_open", sessions, sessionId: 11, answers: [], nowMs: 0 }), "all buổi open");

const placed = lessonsOnPlan(
  [{ id: 1, number: 1, sortOrder: 1 }, { id: 2, number: 2, sortOrder: 2 }, { id: 5, number: 5, sortOrder: 5 }, { id: 9, number: 9, sortOrder: 9 }],
  sessions,
);
expect(placed.map((row) => row.id).join() === "5,1,2", "unique bài in buổi order");
const counted = subsetProgress(placed.map((row) => row.id), answers);
expect(counted.total === 3 && counted.completed === 1, "progress counts each bài once");
expect(fallbackSessions([]).length === 0 && fallbackSessions([5])[0]?.lessonIds.join() === "5", "fallback buổi");
expect(accessMode("scheduled", false) === "all_open" && accessMode("scheduled", true) === "scheduled" && accessMode("sequential", false) === "sequential", "unpersisted schedule stays open");
const rejected = normalizeSessionDrafts([{ id: 1 }, { id: 2 }], [{ title: "Buổi", sessionDate: "2026-02-31", lessonIds: [2, 2, 9] }]);
expect(!rejected.ok, "bad date rejected");
const kept = normalizeSessionDrafts([{ id: 1 }, { id: 2 }], [{ title: "  Sáng  ", sessionDate: null, lessonIds: [2, 2, 9] }]);
expect(kept.ok && kept.sessions[0]?.lessonIds.join() === "2" && kept.sessions[0]?.title === "Sáng", "bài kept in catalog order");
const emptyBuoi = normalizeSessionDrafts([{ id: 1 }], [{ title: "", sessionDate: null, lessonIds: [] }]);
expect(!emptyBuoi.ok, "buổi needs a bài");

console.log("codes ok");
