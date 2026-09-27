import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { classManagementCode, courseManagementCode } from "../convex/codes.ts";
import { LESSONS } from "./course.ts";
import { BABOSORA_COURSE, BABOSORA_LESSONS, babosoraFields, babosoraHtmlPath } from "./babosora-applier.ts";
import { VABIX_COURSE, VABIX_LESSONS, bizcarHtmlPath } from "./vabix-applier.ts";

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}

assert(BABOSORA_LESSONS.length === 4, "four sessions");
assert(BABOSORA_COURSE.slug === "babosora-applier", "slug");
assert(BABOSORA_COURSE.code === "BABOSORA", "code");
assert(BABOSORA_COURSE.code !== VABIX_COURSE.code && BABOSORA_COURSE.code !== "BMDO K03", "course code is separate");
assert(BABOSORA_COURSE.slug !== VABIX_COURSE.slug, "slug is separate");
assert(BABOSORA_COURSE.title === "BABOSORA — Thao trường APPLIER 04 buổi", "title");
assert(BABOSORA_COURSE.cohortName === "BABOSORA · Cohort 01", "cohort");
assert(courseManagementCode(BABOSORA_COURSE.code) === "KH-BABOSORA", "management code");
assert(classManagementCode(BABOSORA_COURSE.code, 1) === "LH-BABOSORA-01", "class code");
assert(courseManagementCode("APPLIER") === "KH-APPLIER", "applier code unchanged");
assert(courseManagementCode("BMDO K03") === "KH-BMDO-K03", "bmdo code unchanged");
assert(!babosoraHtmlPath().includes("bizcar-original"), "babosora html stays out of bizcar-original");
assert(!babosoraHtmlPath().includes("vabix-applier"), "babosora html stays out of vabix");
assert(bizcarHtmlPath("01").includes("source/bizcar-original/BMDO-Buoi01-Interactive"), "bmdo path");
assert(fs.existsSync(babosoraHtmlPath()), "babosora file");

const taken = new Set([...LESSONS, ...VABIX_LESSONS].map((lesson) => lesson.storageKey));
const seen = new Set<string>();
for (const lesson of BABOSORA_LESSONS) {
  assert(!taken.has(lesson.storageKey), `storage key collides: ${lesson.storageKey}`);
  assert(!seen.has(lesson.storageKey), "duplicate babosora storage key");
  seen.add(lesson.storageKey);
  assert(lesson.storageKey.startsWith("babosora-applier-"), "babosora key prefix");
  assert(!lesson.storageKey.startsWith("vabix-applier-"), "not a vabix key");
  assert(!lesson.storageKey.includes("bmdo"), "not a bmdo key");
}
assert(LESSONS.find((lesson) => lesson.number === 1)?.title === "12 Miền quản trị", "bmdo lesson 1 title");
assert(VABIX_LESSONS[0]?.title === "TỈNH", "vabix session 1 title");
assert(BABOSORA_LESSONS[0]?.title === "Định vị và đo điểm nghẽn BA", "session 1 title");
assert(BABOSORA_LESSONS[0]?.framework === "BA", "session 1 code");
assert(BABOSORA_LESSONS[1]?.framework === "BTS", "session 2 code");
assert(BABOSORA_LESSONS[2]?.framework === "BO", "session 3 code");
assert(BABOSORA_LESSONS[3]?.framework === "SO · RA", "session 4 code");
assert(babosoraFields(1)[0]?.path === "answers.s0.choiceText", "session 1 choice path");
assert(babosoraFields(1).some((field) => field.path === "answers.s0.own.b2a"), "session 1 own path");
assert(babosoraFields(4).at(-1)?.path === "answers.s3.own.ra", "session 4 ra path");
assert(babosoraFields(5).length === 0, "no fifth session");

const html = fs.readFileSync(babosoraHtmlPath(), "utf8");
assert(html.includes("__babosoraStorageKey"), "platform storage key hook");
assert(html.includes("__babosoraSession"), "platform session hook");
assert(html.includes("babosora-applier-v1"), "standalone key remains the fallback");
assert(html.includes("__babosoraOpenSession"), "session nav can leave the lesson");
assert(html.includes("choiceText"), "choice is stored as text");
assert(html.includes("__bizcarProgress"), "progress bridge");
assert(html.includes("Định vị và đo điểm nghẽn BA"), "session 1 copy");
assert(html.includes("Thiết kế hệ thống phủ sóng BA"), "session 2 copy");
assert(html.includes("Săn và xác nhận Business Opportunity"), "session 3 copy");
assert(html.includes("Chuyển BO thành SO và quản trị RA"), "session 4 copy");
const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1] ?? "";
assert(script.includes("const SESSIONS="), "workbook script extracted");
fs.writeFileSync("/tmp/babosora-applier-script.js", script);
execFileSync(process.execPath, ["--check", "/tmp/babosora-applier-script.js"], { stdio: "inherit" });

const convex = fs.readFileSync("convex/babosoraApplier.ts", "utf8");
assert(convex.includes(BABOSORA_COURSE.slug) && convex.includes(BABOSORA_COURSE.code), "convex catalog copy");
for (const lesson of BABOSORA_LESSONS) {
  assert(convex.includes(lesson.storageKey), `convex storage key ${lesson.storageKey}`);
  assert(convex.includes(lesson.title), `convex title ${lesson.title}`);
}

const seed = fs.readFileSync("convex/seed.ts", "utf8");
const body = seed.slice(seed.indexOf("export const addCourseBabosoraApplier"), seed.indexOf("export const upsertAdmin"));
assert(body.includes("BABOSORA_COURSE.slug"), "seed targets the new course");
assert(body.includes("BABOSORA_LESSONS"), "seed inserts the four lessons");
assert(!body.includes("cmsLessons"), "seed does not touch cms lessons");
assert(!body.includes("map.lede"), "seed does not touch map lede");
assert(!body.includes("bmdo-k03"), "seed does not name BMDO");
assert(!body.includes("vabix-applier"), "seed does not name the APPLIER course");
assert(!body.includes("VABIX_"), "seed does not write the APPLIER catalog");

console.log("babosora-applier ok");
