import fs from "fs";
import path from "path";
import { scopeCss } from "./css-scope";
import { lessonByNumber } from "./course";
import { babosoraHtmlPath, babosoraLesson, isBabosoraCourse, BABOSORA_COURSE } from "./babosora-applier";
import { bizcarHtmlPath, isVabixCourse, vabixHtmlPath, vabixLesson, VABIX_COURSE } from "./vabix-applier";

export type LessonSource = {
  css: string;
  html: string;
  script: string;
  storageKey: string;
  scopeClass: string;
  showSample: boolean;
  showPhases: boolean;
};

export function loadLessonSource(number: number, course?: { slug?: string; storageKey?: string }): LessonSource {
  if (isVabixCourse(course?.slug, course?.storageKey)) {
    return loadVabixLesson(number, course?.storageKey, course?.slug || VABIX_COURSE.slug);
  }
  if (isBabosoraCourse(course?.slug, course?.storageKey)) {
    return loadBabosoraLesson(number, course?.storageKey, course?.slug || BABOSORA_COURSE.slug);
  }
  const meta = lessonByNumber(number);
  if (!meta) throw new Error("Không tìm thấy bài học");
  const file = path.join(process.cwd(), bizcarHtmlPath(meta.code));
  const html = fs.readFileSync(file, "utf8");
  const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
  const body = html.match(/<body[^>]*>([\s\S]*?)<script>/)?.[1] ?? "";
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1] ?? "";
  const bridge = `
;try{window.show=typeof show==='function'?show:showPanel}catch(e){}
;try{window.sample=typeof loadSample==='function'?loadSample:(document.querySelector('#sampleBtn')?function(){document.querySelector('#sampleBtn').click()}:sample)}catch(e){}
;try{window.toggleMenu=toggleMenu}catch(e){}
;try{window.exportJSON=exportJSON}catch(e){}
;try{window.clearData=typeof clearData==='function'?clearData:(typeof resetData==='function'?resetData:undefined)}catch(e){}
;try{window.__bizcarShow=window.show}catch(e){}
;try{window.__bizcarState=function(){return state}}catch(e){}
`;
  return {
    css: scopeCss(css, ".bizcar-lesson"),
    html: body,
    script: `${script}\n${bridge}`,
    storageKey: meta.storageKey,
    scopeClass: "bizcar-lesson",
    showSample: true,
    showPhases: true,
  };
}

function loadVabixLesson(number: number, storageKey: string | undefined, slug: string): LessonSource {
  const meta = vabixLesson(number);
  if (!meta) throw new Error("Không tìm thấy bài học");
  const key = storageKey || meta.storageKey;
  const html = fs.readFileSync(path.join(process.cwd(), vabixHtmlPath()), "utf8");
  const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
  const body = html.match(/<body[^>]*>([\s\S]*?)<script>/)?.[1] ?? "";
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1] ?? "";
  const sessionIndex = number - 1;
  const prelude = `
window.__vabixSession=${sessionIndex};
window.__vabixStorageKey=${JSON.stringify(key)};
window.__vabixOpenSession=function(i){
  var code=String(i+1).padStart(2,"0");
  window.location.assign(${JSON.stringify(`/learn/course/${slug}/lesson/`)}+code);
};
`;
  return {
    css: scopeCss(css, ".vabix-lesson"),
    html: body,
    script: `${prelude}\n${script}`,
    storageKey: key,
    scopeClass: "vabix-lesson",
    showSample: false,
    showPhases: false,
  };
}

function loadBabosoraLesson(number: number, storageKey: string | undefined, slug: string): LessonSource {
  const meta = babosoraLesson(number);
  if (!meta) throw new Error("Không tìm thấy bài học");
  const key = storageKey || meta.storageKey;
  const html = fs.readFileSync(path.join(process.cwd(), babosoraHtmlPath()), "utf8");
  const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
  const body = html.match(/<body[^>]*>([\s\S]*?)<script>/)?.[1] ?? "";
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1] ?? "";
  const sessionIndex = number - 1;
  const prelude = `
window.__babosoraSession=${sessionIndex};
window.__babosoraStorageKey=${JSON.stringify(key)};
window.__babosoraOpenSession=function(i){
  var code=String(i+1).padStart(2,"0");
  window.location.assign(${JSON.stringify(`/learn/course/${slug}/lesson/`)}+code);
};
`;
  return {
    css: scopeCss(css, ".babosora-lesson"),
    html: body,
    script: `${prelude}\n${script}`,
    storageKey: key,
    scopeClass: "babosora-lesson",
    showSample: false,
    showPhases: false,
  };
}
