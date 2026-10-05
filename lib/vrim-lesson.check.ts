import fs from "node:fs";
import { LESSONS } from "./course.ts";
import { LIBRARY, OPTIONS, addExample, assess, deleteNode, fresh, importProfile, legacyLines, openStudio, progressOf, sampleState, validateStudio } from "./vrim-lesson.ts";

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}

assert(LIBRARY.length === 12, "12 industries");
assert(LIBRARY.reduce((sum, row) => sum + row[3].length, 0) === 24, "24 situations");
assert(OPTIONS.V.length === 10 && OPTIONS.B.length === 10 && OPTIONS.F.length === 10, "option bank");

const lesson = LESSONS.find((row) => row.number === 4);
assert(lesson?.storageKey === "bmdo-k03-buoi04-vrim-v1", "lesson 4 storage key stays");
assert(!fs.existsSync("source/bmdo-k03-vrim/index.html"), "static studio removed");
assert(!fs.existsSync("app/learn/(studio)/course/[slug]/lesson/[num]/vrim/page.tsx"), "iframe page removed");
const config = fs.readFileSync("next.config.ts", "utf8");
assert(config.includes('"/learn/course/bmdo-k03/lesson/04/vrim"'), "retired route redirects");

const empty = openStudio({});
assert(empty.version === 2 && empty.nodes.length === 0 && empty.legacy === null, "new studio starts empty");
assert(progressOf(empty).progress === 0, "empty progress");

const old = {
  profile: { company: "Công ty ABC" },
  practice: { statement: "CEO thấy dòng tiền sớm nhờ cảnh báo tuần." },
  improve: { before: "Nói tính năng trước", after: "Nói giá trị trước" },
  extract: { principle: "Không dẫn bằng tính năng" },
  resolve: { action: "Gọi 3 CEO", hypothesis: "Họ dời một khoản chi" },
};
const opened = openStudio(old);
assert(opened.nodes.length === 0 && opened.context.company === "", "old answers do not fill the new form");
assert(opened.legacy && (opened.legacy as { practice: { statement: string } }).practice.statement === old.practice.statement, "old work kept");
const lines = legacyLines(opened.legacy);
assert(lines.some((line) => line.label === "Câu VBF" && line.value.includes("cảnh báo")), "legacy section labels the old VBF");
assert(legacyLines({ ui: { section: "overview" } }).length === 0, "navigation-only blob is not old work");

const again = openStudio(opened);
assert((again.legacy as { profile: { company: string } }).profile.company === "Công ty ABC", "legacy round-trips inside version 2");

const added = addExample(fresh(), "food:0");
assert(added.nodes.length === 3, "example adds three nodes");
assert(added.nodes.map((item) => item.type).join("") === "VBF", "example order");
const feature = added.nodes.find((item) => item.type === "F");
const benefit = added.nodes.find((item) => item.type === "B");
const value = added.nodes.find((item) => item.type === "V");
assert(feature?.links.length === 1 && feature.links[0] === benefit?.id, "F links to B");
assert(benefit?.links.length === 1 && benefit.links[0] === value?.id, "B links to V");
assert(value?.links.length === 0, "V stores no outward link");
const kept = addExample(added, "software:1");
assert(kept.nodes.length === 6, "second example does not replace");
const removed = deleteNode(kept, feature!.id);
assert(removed.nodes.length === 5, "delete removes one node");
assert(removed.nodes.every((item) => !item.links.includes(feature!.id)), "delete drops links to that node");

const issues = assess(fresh());
assert(issues.issues.some((issue) => issue.code === "CONTEXT"), "missing context is reported");
assert(!issues.issues.some((issue) => /điểm|MDS|chứng nhận/.test(issue.text)), "no automatic quality score");

let rejected = false;
try { validateStudio({ version: 1 }); } catch { rejected = true; }
assert(rejected, "import rejects a non-v2 file");
const imported = importProfile(added, opened);
assert(imported.nodes.length === 3 && (imported.legacy as { profile: { company: string } }).profile.company === "Công ty ABC", "import keeps legacy");

const sample = sampleState(old);
assert(sample.legacy === old && sample.nodes.length === 3 && progressOf(sample).progress > 0, "sample keeps legacy and is fillable");
assert(LIBRARY.every((row) => row[3].every((example) => example.length === 8)), "each situation has the eight teaching fields");
