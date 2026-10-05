// Batch 1 BMDO-K03 studio lessons (Buổi 08, 09, 10, 11, 12, 14). Run: npx tsx lib/bmdo-studios.check.ts
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { LESSONS, WORKBOOK, readPath } from "./course.ts";
import { STUDIOS, STUDIO_STEPS, emptyEnvelope, isEnvelope, studioForAnswerKey, studioForLesson, studioProgress, type StudioEnvelope } from "./studios/registry.ts";
import { studioDocError, validateEnvelope } from "./studios/validate.ts";
import { legacyRows } from "./studios/legacy.ts";
import { loadStudioSource } from "./studios/source.ts";
import { ANSWER_VERSIONS, STUDIO_ANSWER_KEYS, answerKeyFor, gateRows, isVersionedAnswerJson, splitAnswerRows } from "../convex/codes.ts";
import * as writes from "../convex/writes.ts";
import { answersView } from "../convex/helpers.ts";

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}
const fixture = (id: string) => JSON.parse(fs.readFileSync(`lib/studios/fixtures/${id}.json`, "utf8")) as Record<string, unknown>;

// --- Registry, keys and course data ---
const EXPECTED: Record<number, [string, string, string]> = {
  8: ["mrim", "bmdo-k03-buoi08-scp-v1", "bmdo-k03-buoi08-mrim-v2"],
  9: ["mair", "bmdo_k03_buoi09_mair_cib", "bmdo-k03-buoi09-mair-v2"],
  10: ["mcasing", "bmdo_k03_buoi10_mcasing_pfe", "bmdo-k03-buoi10-mcasing-v2"],
  11: ["mtread", "bmdo_k03_buoi11_mtread_grip", "bmdo-k03-buoi11-mtread-v2"],
  12: ["prim", "bmdo_k03_buoi12_prim_cod", "bmdo-k03-buoi12-prim-v2"],
  14: ["pcasing", "bmdo_k03_buoi14_pcasing_wsc", "bmdo-k03-buoi14-pcasing-v2"],
};
assert(STUDIOS.length === 6, "six studios");
for (const [num, [id, oldKey, newKey]] of Object.entries(EXPECTED)) {
  const lesson = LESSONS.find((row) => row.number === Number(num));
  const config = studioForLesson(Number(num));
  assert(lesson?.storageKey === oldKey, `lesson ${num} old storage key unchanged`);
  assert(config?.id === id && config.oldKey === oldKey && config.answerKey === newKey, `lesson ${num} registry`);
  assert(answerKeyFor(oldKey) === newKey && STUDIO_ANSWER_KEYS[newKey] === id, `lesson ${num} answer version`);
  assert(studioForAnswerKey(newKey) === config, `lesson ${num} lookup by answer key`);
  assert(fs.existsSync(config.file) && fs.existsSync(config.file.replace(/index\.html$/, "README.md")), `lesson ${num} source + README`);
  const fields = WORKBOOK[Number(num)].map((field) => field.path);
  assert(new Set(fields).size === fields.length && fields.includes("outline"), `lesson ${num} workbook fields listed once`);
}
assert(LESSONS.filter((row) => row.hasReport && studioForLesson(row.number)).map((row) => row.number).join() === "9,10,11,12,14", "report lessons unchanged");
assert(Object.keys(ANSWER_VERSIONS).length === 7 && answerKeyFor("bmdo-k03-buoi04-vrim-v1") === "bmdo-k03-buoi04-vrim-v2", "Buổi 04 mapping unchanged; 6 added");
assert(LESSONS.filter((row) => answerKeyFor(row.storageKey)).map((row) => row.number).join() === "4,8,9,10,11,12,14", "no other BMDO lesson moved");
assert(!answerKeyFor("bmdo-k03-buoi05-lear-v1") && !answerKeyFor("babosora-applier-buoi04-so-ra-v1") && !answerKeyFor(""), "other lessons and courses unchanged");
assert(new Set(Object.values(ANSWER_VERSIONS)).size === 7, "answer keys unique");
execFileSync(process.execPath, [...process.execArgv, "scripts/studio-validators.ts", "--check"], { stdio: "inherit" });

// --- Source loads, scoped, with the studio's script intact ---
for (const config of STUDIOS) {
  const source = loadStudioSource(config);
  assert(source.html.length > 100 && source.script.length > 5000, `${config.id} source split`);
  assert(!/(^|\})\s*(body|html|:root)\s*\{/.test(source.css), `${config.id} css scoped`);
  assert(source.script.includes(config.localKey), `${config.id} script uses its storage key`);
}

// --- Validation: fresh, fixture, malformed ---
for (const config of STUDIOS) {
  const doc = fixture(config.id);
  assert(studioDocError(config, doc) === null, `${config.id} fixture passes the studio's own check`);
  const env: StudioEnvelope = { ...emptyEnvelope(config.id), doc, visited: ["activate", "paradigm"], outline: config.summary(doc) };
  assert(validateEnvelope(config, env) === env, `${config.id} envelope valid`);
  assert(validateEnvelope(config, emptyEnvelope(config.id)), `${config.id} empty envelope valid`);
  assert(isVersionedAnswerJson(config.answerKey, JSON.stringify(env)) && isVersionedAnswerJson(config.answerKey, JSON.stringify(emptyEnvelope(config.id))), `${config.id} server shape ok`);
  const bad: [string, unknown][] = [
    ["not an envelope", doc],
    ["wrong studio", { ...env, studio: config.id === "mrim" ? "mair" : "mrim" }],
    ["wrong version", { ...env, version: 1 }],
    ["doc is array", { ...env, doc: [] }],
    ["bad visited", { ...env, visited: ["nope"] }],
    ["outline too long", { ...env, outline: "x".repeat(7000) }],
    ["doc kind mismatch", { ...env, doc: { ...doc, kind: "other", type: "other" } }],
    ["doc missing fields", { ...env, doc: { kind: doc.kind, type: doc.type } }],
  ];
  for (const [label, value] of bad) {
    let refused = false;
    try { validateEnvelope(config, value); } catch { refused = true; }
    assert(refused, `${config.id} rejects: ${label}`);
  }
  for (const value of ["{", "[]", JSON.stringify(doc), JSON.stringify({ ...env, studio: "x" }), JSON.stringify({ ...env, doc: [] })]) {
    assert(!isVersionedAnswerJson(config.answerKey, value), `${config.id} server rejects ${value.slice(0, 20)}`);
  }
  // Progress: empty is 0, fixture with every step visited counts the filled steps.
  assert(studioProgress(config, emptyEnvelope(config.id)).progress === 0, `${config.id} empty progress`);
  const full = studioProgress(config, { ...env, visited: [...STUDIO_STEPS] });
  assert(full.progress > 0 && full.progress <= 100 && full.done[0] === "overview", `${config.id} progress counts steps`);
  assert(config.summary(doc).length > 0 && config.summary({}).length <= 6000, `${config.id} summary`);
  assert(config.intro.length > 0 && /[ạảãáàâăêôơưđ]/.test(config.intro.join(" ")), `${config.id} Vietnamese intro`);
}
assert(isVersionedAnswerJson("bmdo-k03-buoi05-lear-v1", "{}"), "other keys untouched by the check");

// --- Legacy (read-only old version) ---
const old8 = { profile: { company: "Công ty ABC" }, improve: { segment: "SME" }, ui: { section: "x" }, notes: ["Ghi chú cũ"] };
const rows8 = legacyRows(8, old8);
assert(rows8.some((row) => row.label === "Doanh nghiệp" && row.value === "Công ty ABC"), "legacy labelled field");
assert(rows8.some((row) => row.value === "Ghi chú cũ") && !rows8.some((row) => row.value === "x"), "legacy keeps other text, skips ui");
assert(legacyRows(9, null).length === 0 && legacyRows(9, { ui: { a: "b" } }).length === 0, "empty legacy");
assert(readPath({ outline: "A" }, "outline") === "A", "admin outline field readable");

// --- Unlock: finished old version still opens the next lesson ---
const NEW8 = EXPECTED[8][2];
const split = splitAnswerRows(
  [{ lessonId: 8, status: "completed" }, { lessonId: 9, status: "submitted" }],
  [{ lessonId: 8, answerKey: NEW8, status: "in_progress" }],
  (id) => (id === 8 ? NEW8 : id === 9 ? EXPECTED[9][2] : null),
);
assert(split.legacy.length === 2 && split.active.length === 1, "old rows are legacy for moved lessons");
const gated = gateRows(split.active, split.legacy);
assert(gated.find((row) => row.lessonId === 8)?.status === "completed" && gated.find((row) => row.lessonId === 9)?.status === "submitted", "old completion still gates");

// --- Write paths against an in-memory Convex db ---
type Doc = Record<string, unknown> & { _id: string };
function fakeCtx() {
  const tables = new Map<string, Doc[]>();
  const log: { op: string; id: string }[] = [];
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
    insert: async (name: string, value: Record<string, unknown>) => { const _id = `${name}:${++seq}`; rows(name).push({ ...value, _id }); log.push({ op: "insert", id: _id }); return _id; },
    patch: async (id: string, value: Record<string, unknown>) => { Object.assign(find(id)!, value); log.push({ op: "patch", id }); },
    replace: async (id: string, value: Record<string, unknown>) => { Object.assign(find(id)!, value); log.push({ op: "replace", id }); },
    delete: async (id: string) => { for (const list of tables.values()) { const at = list.findIndex((doc) => doc._id === id); if (at >= 0) list.splice(at, 1); } log.push({ op: "delete", id }); },
  };
  return { ctx: { db }, rows, log };
}
type Handler = (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
const run = (fn: unknown, ctx: unknown, args: Record<string, unknown>) => (fn as { _handler: Handler })._handler(ctx, { secret: "check", ...args });

async function writePaths() {
  process.env.APP_SECRET = "check";
  for (const config of STUDIOS) {
    const { ctx, rows, log } = fakeCtx();
    const id = config.lesson;
    rows("lessons").push({ _id: `lessons:${id}`, legacyId: id, courseId: 1, number: id, storageKey: config.oldKey }, { _id: "lessons:5", legacyId: 5, courseId: 1, number: 5, storageKey: "bmdo-k03-buoi05-lear-v1" });
    const oldRow = { _id: "lessonAnswers:old", legacyId: 1, userId: 7, courseId: 1, lessonId: id, schemaVersion: "1", answersJson: JSON.stringify({ profile: { company: "Cũ" } }), currentPhase: "resolve", phasesDoneJson: "[\"overview\"]", progressPercent: 80, status: "completed", completedAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" };
    rows("lessonAnswers").push(oldRow);
    rows("lessonSubmissions").push({ _id: "lessonSubmissions:old", legacyId: 1, userId: 7, lessonId: id, cohortId: 1, answersJson: oldRow.answersJson, reviewStatus: "submitted" });
    rows("counters").push({ _id: "counters:1", name: "lessonSubmissions", value: 1 }, { _id: "counters:2", name: "lessonAnswers", value: 1 });
    const frozen = JSON.stringify(oldRow);
    const untouched = (label: string) => {
      assert(JSON.stringify(rows("lessonAnswers").find((row) => row._id === oldRow._id)) === frozen, `${config.id} old record untouched: ${label}`);
      assert(!log.some((entry) => entry.id === oldRow._id), `${config.id} no write hit the old record: ${label}`);
    };
    const doc = fixture(config.id);
    const env = { ...emptyEnvelope(config.id), doc, visited: ["activate"], outline: config.summary(doc) };
    const save = (answers: unknown, progress = 10) => run(writes.saveAnswers, ctx, {
      userId: 7, lessonId: id, courseId: 1, schemaVersion: "1", answersJson: JSON.stringify(answers), phase: "practice",
      phasesDoneJson: "[\"overview\"]", progressPercent: progress, status: "in_progress", completedAt: null, logComplete: false,
    });
    await save(emptyEnvelope(config.id));
    await save(env, 40);
    untouched("save");
    const versions = rows("lessonAnswerVersions");
    assert(versions.length === 1 && versions[0].answerKey === config.answerKey && versions[0].progressPercent === 40, `${config.id} one new-version row`);
    let refused = "";
    try { await save(doc); } catch (error) { refused = (error as Error).message; }
    assert(refused === "INVALID_ANSWERS" && versions[0].progressPercent === 40, `${config.id} server refuses a raw / broken doc`);
    await run(writes.completeLesson, ctx, { userId: 7, lessonId: id });
    assert(versions[0].status === "completed", `${config.id} complete marks the new record`);
    untouched("complete");
    await run(writes.submitLesson, ctx, { userId: 7, lessonId: id, cohortId: 1, schemaVersion: "1", contentVersion: "x", answersJson: String(versions[0].answersJson), phase: "report", progressPercent: 100 });
    const submitted = rows("lessonSubmissions").find((row) => row.answerKey === config.answerKey);
    assert(submitted && versions[0].status === "submitted", `${config.id} submit snapshots the new record`);
    untouched("submit");
    await run(writes.addFeedback, ctx, { actorId: 1, submissionId: 1, body: "Bài cũ" });
    untouched("feedback old");
    await run(writes.addFeedback, ctx, { actorId: 1, submissionId: submitted!.legacyId, body: "Bài mới" });
    assert(versions[0].status === "reviewed", `${config.id} feedback marks the new record`);
    untouched("feedback new");
    await run(writes.saveAnswers, ctx, { userId: 7, lessonId: 5, courseId: 1, schemaVersion: "1", answersJson: "{\"a\":1}", phase: "overview", phasesDoneJson: "[]", progressPercent: 5, status: "in_progress", completedAt: null, logComplete: false });
    assert(rows("lessonAnswers").some((row) => row.lessonId === 5) && versions.length === 1, `${config.id} other lessons keep the usual record`);
    const view = await answersView(ctx as never, 7);
    assert(view.legacy.length === 1 && view.legacy[0]._id === oldRow._id, `${config.id} old record reads back as legacy`);
    assert(view.active.find((row) => row.lessonId === id)?.status === "reviewed", `${config.id} readers see the new record`);
    assert(isEnvelope(JSON.parse(String(view.active.find((row) => row.lessonId === id)?.answersJson ?? view.active.find((row) => row.lessonId === id)?.answers_json)), config.id), `${config.id} stored envelope`);
  }
}

writePaths().then(() => console.log("bmdo-studios checks passed")).catch((error) => { console.error(error); process.exit(1); });
