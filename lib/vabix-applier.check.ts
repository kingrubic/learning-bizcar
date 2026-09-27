import fs from "node:fs";
import { LESSONS } from "./course.ts";
import { VABIX_COURSE, VABIX_LESSONS, bizcarHtmlPath, vabixFields, vabixHtmlPath } from "./vabix-applier.ts";

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}

assert(VABIX_LESSONS.length === 4, "four sessions");
assert(VABIX_COURSE.slug === "vabix-applier", "slug");
assert(VABIX_COURSE.code === "APPLIER", "code");
assert(!vabixHtmlPath().includes("bizcar-original"), "vabix html stays out of bizcar-original");
assert(bizcarHtmlPath("01").includes("source/bizcar-original/BMDO-Buoi01-Interactive"), "bmdo path");
assert(!bizcarHtmlPath("30").includes("vabix"), "bmdo path is not vabix");
assert(fs.existsSync(bizcarHtmlPath("01")), "bmdo lesson 1 file");
assert(fs.existsSync(vabixHtmlPath()), "vabix file");

const bmdoKeys = new Set(LESSONS.map((lesson) => lesson.storageKey));
const seen = new Set<string>();
for (const lesson of VABIX_LESSONS) {
  assert(!bmdoKeys.has(lesson.storageKey), `storage key collides with BMDO: ${lesson.storageKey}`);
  assert(!seen.has(lesson.storageKey), "duplicate vabix storage key");
  seen.add(lesson.storageKey);
  assert(lesson.storageKey.startsWith("vabix-applier-"), "vabix key prefix");
}
assert(LESSONS.find((lesson) => lesson.number === 1)?.title === "12 Miền quản trị", "bmdo lesson 1 title");
assert(VABIX_LESSONS[0]?.title === "TỈNH", "session 1 title");
assert(vabixFields(1)[0]?.path === "answers.0.choiceText", "session 1 choice path");
assert(vabixFields(4).at(-1)?.path === "answers.3.signal", "session 4 signal path");
assert(vabixFields(5).length === 0, "no fifth session");

const html = fs.readFileSync(vabixHtmlPath(), "utf8");
assert(html.includes('__vabixStorageKey'), "platform storage key hook");
assert(html.includes("vabix-applier-leadership-v1"), "standalone key remains the fallback");
assert(html.includes("__vabixOpenSession"), "session nav can leave the lesson");
assert(html.includes("choiceText"), "choice is stored as text");
assert(html.includes("__bizcarProgress"), "progress bridge");
const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1] ?? "";
assert(script.includes("const DATA="), "workbook script extracted");
fs.writeFileSync("/tmp/vabix-applier-script.js", script);
assert(fs.existsSync("/tmp/vabix-applier-script.js"), "script written for parse check");

const seed = fs.readFileSync("convex/seed.ts", "utf8");
const body = seed.slice(seed.indexOf("export const addCourseVabixApplier"), seed.indexOf("export const upsertAdmin"));
assert(body.includes("VABIX_COURSE.slug"), "seed targets the new course");
assert(!body.includes("cmsLessons"), "seed does not touch cms lessons");
assert(!body.includes("map.lede"), "seed does not touch map lede");
assert(!body.includes("bmdo-k03"), "seed does not name BMDO");

console.log("vabix-applier ok");
