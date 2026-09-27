import {
  classManagementCode,
  courseManagementCode,
  instructorManagementCode,
  learnerManagementCode,
  lessonUnlocked,
  nextFreeCode,
  resolveSubset,
  slugFromCode,
  subsetProgress,
} from "./codes.ts";

function expect(cond: boolean, label: string) {
  if (!cond) throw new Error(label);
}

expect(courseManagementCode("BMDO K03") === "KH-BMDO-K03", "course code");
expect(courseManagementCode("vabix-applier") === "KH-VABIX-APPLIER", "course slug");
expect(classManagementCode("BMDO K03", 1) === "LH-BMDO-K03-01", "class code");
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

console.log("codes ok");
