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

// --- Buổi 04 new version has its own record; the old record is never written. ---
import { ANSWER_VERSIONS, answerKeyFor, gateRows, splitAnswerRows } from "../convex/codes.ts";
import { loadStudio, savePayload } from "./vrim-lesson.ts";
import * as writes from "../convex/writes.ts";
import { answersView } from "../convex/helpers.ts";

const OLD_KEY = "bmdo-k03-buoi04-vrim-v1";
const NEW_KEY = "bmdo-k03-buoi04-vrim-v2";
assert(answerKeyFor(OLD_KEY) === NEW_KEY, "lesson 4 has its own new answer key");
assert(Object.keys(ANSWER_VERSIONS).length === 1, "only Buổi 04 BMDO-K03 moved");
assert(LESSONS.filter((row) => answerKeyFor(row.storageKey)).map((row) => row.number).join() === "4", "no other BMDO lesson moved");
assert(!answerKeyFor("babosora-applier-buoi04-so-ra-v1") && !answerKeyFor("bmdo-k03-buoi05-lear-v1") && !answerKeyFor(""), "other courses unchanged");

const keyOf = (id: number) => (id === 4 ? NEW_KEY : null);
const split = splitAnswerRows(
  [{ lessonId: 4, status: "completed" }, { lessonId: 5, status: "in_progress" }],
  [{ lessonId: 4, answerKey: NEW_KEY, status: "in_progress" }, { lessonId: 4, answerKey: "other", status: "completed" }],
  keyOf,
);
assert(split.legacy.length === 1 && split.legacy[0].lessonId === 4, "old row is legacy");
assert(split.active.length === 2 && split.active.every((row) => row.status === "in_progress"), "progress reads the new row only");
assert(gateRows(split.active, split.legacy).find((row) => row.lessonId === 4)?.status === "completed", "finished old version still unlocks the next session");

const fromOld = loadStudio({}, old);
assert(fromOld.broken === null && fromOld.state.nodes.length === 0 && fromOld.state.context.company === "", "new version starts empty");
assert((fromOld.state.legacy as typeof old).practice.statement === old.practice.statement, "old work shown from the old record");
assert(savePayload(fromOld.state).legacy === null, "old work is not copied into the new record");
assert(savePayload(added).nodes.length === 3, "payload keeps the design");
const badDoc = { version: 2, context: {}, nodes: [{ id: "x", type: "F", links: ["missing"], status: "planned", control: "core" }] };
const opensBroken = loadStudio(badDoc, old);
assert(opensBroken.broken === badDoc && opensBroken.state.nodes.length === 0, "an unreadable new record is kept aside, not reset");
const resumed = loadStudio(savePayload(added), old);
assert(resumed.broken === null && resumed.state.nodes.length === 3, "saved new version reopens");
const preRelease = loadStudio({}, { ...savePayload(added), legacy: old });
assert(preRelease.state.nodes.length === 3 && (preRelease.state.legacy as typeof old).profile.company === "Công ty ABC", "a pre-release V-RIM doc in the old record is not lost from view");

// In-memory Convex db: run the real mutations and record every write.
type Doc = Record<string, unknown> & { _id: string };
function fakeCtx() {
  const tables = new Map<string, Doc[]>();
  const writesLog: { op: string; id: string }[] = [];
  let seq = 0;
  const rows = (name: string) => { if (!tables.has(name)) tables.set(name, []); return tables.get(name)!; };
  const find = (id: string) => [...tables.values()].flat().find((doc) => doc._id === id);
  function builder(name: string, filters: [string, unknown][] = []) {
    const list = () => rows(name).filter((doc) => filters.every(([key, value]) => doc[key] === value));
    return {
      withIndex(_index: string, fn?: (q: unknown) => unknown) {
        const next: [string, unknown][] = [...filters];
        const q = { eq(key: string, value: unknown) { next.push([key, value]); return q; } };
        fn?.(q);
        return builder(name, next);
      },
      collect: async () => list(),
      first: async () => list()[0] ?? null,
      unique: async () => { const found = list(); if (found.length > 1) throw new Error(`unique() on ${name}`); return found[0] ?? null; },
    };
  }
  const db = {
    query: (name: string) => builder(name),
    get: async (id: string) => find(id) ?? null,
    insert: async (name: string, value: Record<string, unknown>) => { const _id = `${name}:${++seq}`; rows(name).push({ ...value, _id }); writesLog.push({ op: "insert", id: _id }); return _id; },
    patch: async (id: string, value: Record<string, unknown>) => { Object.assign(find(id)!, value); writesLog.push({ op: "patch", id }); },
    replace: async (id: string, value: Record<string, unknown>) => { Object.assign(find(id)!, value); writesLog.push({ op: "replace", id }); },
    delete: async (id: string) => { for (const list of tables.values()) { const at = list.findIndex((doc) => doc._id === id); if (at >= 0) list.splice(at, 1); } writesLog.push({ op: "delete", id }); },
  };
  return { ctx: { db }, rows, writesLog };
}
type Handler = (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
const run = (fn: unknown, ctx: unknown, args: Record<string, unknown>) => (fn as { _handler: Handler })._handler(ctx, { secret: "check", ...args });

async function writePaths() {
  process.env.APP_SECRET = "check";
  const { ctx, rows, writesLog } = fakeCtx();
  rows("lessons").push({ _id: "lessons:4", legacyId: 4, courseId: 1, number: 4, storageKey: OLD_KEY }, { _id: "lessons:5", legacyId: 5, courseId: 1, number: 5, storageKey: "bmdo-k03-buoi05-lear-v1" });
  const oldRow = { _id: "lessonAnswers:old", legacyId: 1, userId: 7, courseId: 1, lessonId: 4, schemaVersion: "1", answersJson: JSON.stringify(old), currentPhase: "resolve", phasesDoneJson: JSON.stringify(["overview", "activate"]), progressPercent: 80, status: "in_progress", completedAt: null, updatedAt: "2026-09-01T00:00:00.000Z" };
  rows("lessonAnswers").push(oldRow);
  rows("lessonSubmissions").push({ _id: "lessonSubmissions:old", legacyId: 1, userId: 7, lessonId: 4, cohortId: 1, answersJson: oldRow.answersJson, reviewStatus: "submitted" });
  rows("counters").push({ _id: "counters:1", name: "lessonSubmissions", value: 1 }, { _id: "counters:2", name: "lessonAnswers", value: 1 });
  const frozen = JSON.stringify(oldRow);
  const untouched = (label: string) => {
    assert(JSON.stringify(rows("lessonAnswers").find((row) => row._id === oldRow._id)) === frozen, `old record untouched: ${label}`);
    assert(!writesLog.some((entry) => entry.id === oldRow._id), `no write hit the old record: ${label}`);
  };
  const save = (answers: unknown, progress = 10) => run(writes.saveAnswers, ctx, {
    userId: 7, lessonId: 4, courseId: 1, schemaVersion: "1", answersJson: JSON.stringify(answers), phase: "practice",
    phasesDoneJson: JSON.stringify(["overview"]), progressPercent: progress, status: "in_progress", completedAt: null, logComplete: false,
  });
  const first = await save(savePayload(added)) as { answers_json: string };
  assert(JSON.parse(first.answers_json).nodes.length === 3, "save returns the new record");
  await save(savePayload(kept), 20);
  untouched("save");
  const versions = rows("lessonAnswerVersions");
  assert(versions.length === 1 && versions[0].answerKey === NEW_KEY && versions[0].progressPercent === 20, "one new-version row, updated in place");
  let refused = "";
  try { await save({ version: 1 }); } catch (error) { refused = (error as Error).message; }
  assert(refused === "INVALID_ANSWERS" && versions[0].progressPercent === 20 && JSON.parse(String(versions[0].answersJson)).nodes.length === 6, "broken payload refused; good new data kept");
  await run(writes.completeLesson, ctx, { userId: 7, lessonId: 4 });
  assert(versions[0].status === "completed", "complete marks the new record");
  untouched("complete");
  await run(writes.submitLesson, ctx, { userId: 7, lessonId: 4, cohortId: 1, schemaVersion: "1", contentVersion: "x", answersJson: String(versions[0].answersJson), phase: "resolve", progressPercent: 100 });
  const submitted = rows("lessonSubmissions").find((row) => row.answerKey === NEW_KEY);
  assert(submitted && versions[0].status === "submitted", "submit snapshots the new record");
  untouched("submit");
  await run(writes.addFeedback, ctx, { actorId: 1, submissionId: 1, body: "Bài cũ tốt" });
  untouched("feedback on an old submission");
  await run(writes.addFeedback, ctx, { actorId: 1, submissionId: submitted!.legacyId, body: "Bài mới tốt" });
  assert(versions[0].status === "reviewed", "feedback on a new submission marks the new record");
  untouched("feedback on a new submission");
  await run(writes.saveAnswers, ctx, { userId: 7, lessonId: 5, courseId: 1, schemaVersion: "1", answersJson: "{\"a\":1}", phase: "overview", phasesDoneJson: "[]", progressPercent: 5, status: "in_progress", completedAt: null, logComplete: false });
  assert(rows("lessonAnswers").some((row) => row.lessonId === 5) && versions.length === 1, "other lessons keep the usual record");
  const view = await answersView(ctx as never, 7);
  assert(view.legacy.length === 1 && view.legacy[0]._id === oldRow._id, "old record reads back as legacy");
  assert(view.active.length === 2 && view.active.find((row) => row.lessonId === 4)?.status === "reviewed", "readers see the new record for Buổi 04");
  untouched("end");
}

writePaths().then(() => console.log("vrim-lesson checks passed")).catch((error) => { console.error(error); process.exit(1); });
