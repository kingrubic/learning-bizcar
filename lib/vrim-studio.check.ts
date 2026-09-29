import { createHash } from "node:crypto";
import fs from "node:fs";
import { LESSONS as CATALOG } from "../convex/catalog.ts";
import { LESSONS } from "./course.ts";
import { BABOSORA_COURSE } from "./babosora-applier.ts";
import { VABIX_COURSE } from "./vabix-applier.ts";
import { VRIM, vrimDecision, vrimFilePath, vrimStudioPath } from "./vrim-studio.ts";

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}

const html = fs.readFileSync(VRIM.htmlPath);
assert(html.length === 55440, "byte length");
assert(createHash("sha256").update(html).digest("hex") === VRIM.sha256, "sha256");
assert(html.includes(VRIM.storageKey), "studio storage key");
assert(!html.includes(VRIM.workbookKey), "html does not use the workbook key");

const workbook = LESSONS.find((lesson) => lesson.number === 4);
const catalog = CATALOG.find((lesson) => lesson.number === 4);
assert(workbook?.storageKey === VRIM.workbookKey, "workbook key unchanged");
assert(catalog?.storageKey === VRIM.workbookKey, "catalog key unchanged");
assert(workbook?.title === "V-Rim", "workbook title unchanged");
assert(VABIX_COURSE.slug === "vabix-applier", "vabix slug");
assert(BABOSORA_COURSE.slug === "babosora-applier", "babosora slug");
assert(vrimStudioPath() === "/learn/course/bmdo-k03/lesson/04/vrim", "studio route");
assert(vrimFilePath() === "/learn/course/bmdo-k03/lesson/04/vrim/file", "file route");

const open = {
  role: "user" as const,
  slug: VRIM.slug,
  lessonNumber: 4,
  courseFound: true,
  enrolledLearner: true,
  lessonInClass: true,
  published: true,
  unlocked: true,
};
assert(vrimDecision(open) === "allow", "enrolled learner");
assert(vrimDecision({ ...open, unlocked: false }) === "locked", "locked lesson");
assert(vrimDecision({ ...open, published: false }) === "locked", "unpublished lesson");
assert(vrimDecision({ ...open, enrolledLearner: false }) === "denied", "not enrolled");
assert(vrimDecision({ ...open, lessonInClass: false }) === "missing", "lesson outside the class");
assert(vrimDecision({ ...open, slug: VABIX_COURSE.slug }) === "missing", "not on vabix");
assert(vrimDecision({ ...open, slug: BABOSORA_COURSE.slug }) === "missing", "not on babosora");
assert(vrimDecision({ ...open, lessonNumber: 5 }) === "missing", "not lesson 05");
assert(vrimDecision({ ...open, courseFound: false }) === "missing", "missing course");
assert(vrimDecision({ ...open, role: "admin", enrolledLearner: false, unlocked: false, published: false }) === "allow", "admin");
assert(vrimDecision({ ...open, role: "mod", enrolledLearner: false, lessonInClass: false }) === "allow", "mod");
