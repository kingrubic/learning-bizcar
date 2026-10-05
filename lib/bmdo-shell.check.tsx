// Batch 2: every BMDO-K03 lesson (01–30) uses the standard lesson shell. Run: npx tsx lib/bmdo-shell.check.tsx
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LESSONS, phasesFor } from "./course.ts";
import { messages } from "./i18n.ts";
import { loadLessonSource } from "./lesson-source.ts";
import { studioForLesson, STUDIOS } from "./studios/registry.ts";
import { ANSWER_VERSIONS, BMDO_SLUG } from "../convex/codes.ts";
import { LESSONS as CATALOG } from "../convex/catalog.ts";

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}

// --- Storage keys: identical to main (no new keys, no renamed keys). ---
const KEYS = "1:bmdo-k03-buoi01-domains-v1 2:bmdo-k03-buoi02-myBizCar-v1 3:bmdo-k03-buoi03-mtua-v1 4:bmdo-k03-buoi04-vrim-v1 5:bmdo-k03-buoi05-lear-v1 6:bmdo-k03-buoi06-cxc-v1 7:bmdo-k03-buoi07-dfars-v1 8:bmdo-k03-buoi08-scp-v1 9:bmdo_k03_buoi09_mair_cib 10:bmdo_k03_buoi10_mcasing_pfe 11:bmdo_k03_buoi11_mtread_grip 12:bmdo_k03_buoi12_prim_cod 13:bmdo_k03_buoi13_pair_criss 14:bmdo_k03_buoi14_pcasing_wsc 15:bmdo_k03_buoi15_ptread_mapy 16:bmdo_k03_buoi16_frim_fpc 17:bmdo_k03_buoi17_fair_grels 18:bmdo_k03_buoi18_rfe_v1 19:bmdo-k03-buoi19-ftread-v1 20:bmdo_k03_buoi20_gts_kto_v1 21:bmdo_k03_buoi21_chassis_sgd_v1 22:bmdo_k03_buoi22_brand_shell_ils_v1 23:bmdo_k03_buoi23_environment_road_ctr_v1 24:bmdo_k03_buoi24_bizcar_fuel_6ft_v1 25:bmdo_k03_buoi25_bizcar_oil_boile_v1 26:bmdo_k03_buoi26_ichor_decision_v1 27:bmdo_k03_buoi27_3e3s_matrix_v1 28:bmdo_k03_buoi28_ai_first_v1 29:bmdo_k03_buoi29_digital_workforce_epas_v1 30:bmdo_k03_buoi30_master_system_test_v1";
assert(LESSONS.map((row) => `${row.number}:${row.storageKey}`).join(" ") === KEYS, "lib/course.ts storage keys unchanged");
assert(CATALOG.map((row) => `${row.number}:${row.storageKey}`).join(" ") === KEYS, "convex/catalog.ts storage keys unchanged");
assert(JSON.stringify(ANSWER_VERSIONS) === JSON.stringify({
  "bmdo-k03-buoi04-vrim-v1": "bmdo-k03-buoi04-vrim-v2",
  "bmdo-k03-buoi08-scp-v1": "bmdo-k03-buoi08-mrim-v2",
  bmdo_k03_buoi09_mair_cib: "bmdo-k03-buoi09-mair-v2",
  bmdo_k03_buoi10_mcasing_pfe: "bmdo-k03-buoi10-mcasing-v2",
  bmdo_k03_buoi11_mtread_grip: "bmdo-k03-buoi11-mtread-v2",
  bmdo_k03_buoi12_prim_cod: "bmdo-k03-buoi12-prim-v2",
  bmdo_k03_buoi14_pcasing_wsc: "bmdo-k03-buoi14-pcasing-v2",
}), "answer versions from #25/#26 unchanged");

// --- The lesson page turns the shell on for BMDO-K03 only (never VABIX / BABOSORA). ---
const page = fs.readFileSync("app/learn/(studio)/course/[slug]/lesson/[num]/page.tsx", "utf8");
assert(page.includes("standardShell={state.course.slug === BMDO_SLUG && !vabix && !babosora}"), "page enables the shell for BMDO-K03 only");
assert(BMDO_SLUG === "bmdo-k03", "course slug");
const experience = fs.readFileSync("components/learning/LessonExperience.tsx", "utf8");
assert(experience.includes("{standardShell && (") && experience.includes("<LessonHeader"), "LessonExperience renders the header");
assert(experience.includes("showPhases && !standardShell") && experience.includes("!standardShell && <button"), "old mobile phase strip and top print button only outside the shell");
for (const file of ["LessonStage", "VrimLesson", "StudioLesson"]) {
  const source = fs.readFileSync(`components/learning/${file}.tsx`, "utf8");
  assert(source.includes("<LessonTools"), `${file} hands its tools to the shell toolbar`);
}

// --- Every lesson has a body the shell can drive. ---
const kinds: Record<string, number[]> = { native: [], studio: [], original: [] };
for (const lesson of LESSONS) {
  if (lesson.number === 4) { kinds.native.push(4); continue; }
  if (studioForLesson(lesson.number)) { kinds.studio.push(lesson.number); continue; }
  kinds.original.push(lesson.number);
  const source = loadLessonSource(lesson.number, { slug: BMDO_SLUG, storageKey: lesson.storageKey });
  assert(source.showPhases && source.scopeClass === "bizcar-lesson" && source.storageKey === lesson.storageKey, `${lesson.code} original source`);
  assert(source.script.includes("window.show=function(id)") && source.script.includes("window.__bizcarShow"), `${lesson.code} navigation bridge`);
  for (const phase of phasesFor(lesson)) {
    assert(new RegExp(`(id|data-panel)="${phase.id}"`).test(source.html), `${lesson.code} has a panel for ${phase.id}`);
  }
}
assert(kinds.native.join() === "4" && kinds.studio.join() === "8,9,10,11,12,14" && kinds.original.length === 23, "30 lessons: 1 native, 6 studios, 23 originals");

// --- The header renders the standard parts for all 30 lessons. ---
(globalThis as { React?: typeof React }).React = React;
async function headers() {
  const { LessonHeader, LessonTools, LessonToolsContext } = await import("../components/learning/LessonShell.tsx");
  const t = messages("vi");
  const links = LESSONS.map((row) => ({ number: row.number, code: row.code, title: row.title, framework: row.framework, unlocked: row.number <= 10 }));
  for (const lesson of LESSONS) {
    const phases = phasesFor(lesson);
    const html = renderToStaticMarkup(React.createElement(LessonHeader, {
      lesson, lessons: links, courseSlug: BMDO_SLUG, phases, phase: "practice", done: ["activate"], progress: 42.4, onGo: () => {}, t, toolsRef: () => {},
    }));
    const group = t.group[lesson.group as keyof typeof t.group].replace(/&/g, "&amp;");
    assert(html.includes(`data-lesson-shell="${lesson.code}"`) && html.includes(`Buổi ${lesson.code} · ${group}`), `${lesson.code} kicker`);
    const esc = (value: string) => value.replace(/&/g, "&amp;");
    assert(html.includes(esc(lesson.title)) && html.includes(esc(lesson.framework)), `${lesson.code} title`);
    assert((html.match(/class="lh-step /g) ?? []).length === (lesson.hasReport ? 9 : 8), `${lesson.code} overview + 7 APPLIER steps${lesson.hasReport ? " + report" : ""}`);
    for (const step of ["Khởi động", "Mô thức", "Thực hành", "Lăng kính", "Cải tiến", "Đúc kết", "Cam kết"]) assert(html.includes(step), `${lesson.code} step ${step}`);
    assert(html.includes("Bước 3/7 · Thực hành") && html.includes('aria-valuenow="42"') && html.includes("42%"), `${lesson.code} progress`);
    assert(html.includes('class="lh-step done"') && html.includes('class="lh-step current"'), `${lesson.code} step states`);
    assert(html.includes('role="toolbar"'), `${lesson.code} toolbar slot`);
    const siblings = LESSONS.filter((row) => row.group === lesson.group);
    if (siblings.length > 1) {
      assert((html.match(/class="lh-chip/g) ?? []).length === siblings.length && html.includes('aria-current="page"'), `${lesson.code} group strip`);
    } else {
      assert(!html.includes("lh-wheel"), `${lesson.code} single-lesson group has no strip`);
    }
  }
  const wheel = renderToStaticMarkup(React.createElement(LessonHeader, { lesson: LESSONS[8], lessons: links, courseSlug: BMDO_SLUG, phases: phasesFor(LESSONS[8]), phase: "overview", done: [], progress: 0, onGo: () => {}, t, toolsRef: () => {} }));
  assert(wheel.includes("Bánh xe Thị trường") && wheel.includes('href="/learn/course/bmdo-k03/lesson/08"') && !wheel.includes('href="/learn/course/bmdo-k03/lesson/11"'), "wheel chips link only to unlocked lessons");
  // Outside the shell (other courses) LessonTools renders its fallback, never the BMDO toolbar.
  const outside = renderToStaticMarkup(React.createElement(LessonTools, { onExport: () => {}, onPrint: () => {}, fallback: React.createElement("i", null, "old") }, "x"));
  assert(outside === "<i>old</i>", "other courses keep their own tools");
  const pending = renderToStaticMarkup(React.createElement(LessonToolsContext.Provider, { value: { slot: null, exportLabel: "Xuất JSON", printLabel: "In / PDF" } }, React.createElement(LessonTools, { onExport: () => {}, onPrint: () => {} })));
  assert(pending === "", "tools wait for the header slot");
}

// --- PR #26 review fixes. ---
for (const config of STUDIOS) {
  const html = fs.readFileSync(config.file, "utf8");
  assert(!/\$\{[a-z]\.(id|target)\}/.test(html), `${config.id}: ids are escaped`);
}
const host = fs.readFileSync("lib/studios/host.ts", "utf8");
assert(/if \(prop === "title"\) \{ studioTitle = String\(value\); return true; \}/.test(host) && host.includes('if (prop === "title") return studioTitle;'), "studio document.title is sandboxed");
assert(host.includes('"window", `${options.script}') && host.includes('if (prop === "document") return scoped;'), "window.document resolves to the sandbox");
const stage = fs.readFileSync("components/learning/LessonStage.tsx", "utf8");
assert(stage.includes('if (prop === "title") { lessonTitle = String(value); return true; }'), "original lessons cannot change document.title either");

headers().then(() => console.log("bmdo-shell checks passed")).catch((error) => { console.error(error); process.exit(1); });
