import fs from "fs";
import path from "path";
import { scopeCss } from "./css-scope";
import { lessonByNumber } from "./course";

export type LessonSource = {
  css: string;
  html: string;
  script: string;
  storageKey: string;
};

export function loadLessonSource(number: number): LessonSource {
  const meta = lessonByNumber(number);
  if (!meta) throw new Error("Không tìm thấy bài học");
  const code = meta.code;
  const file = path.join(
    process.cwd(),
    "source/bizcar-original",
    `BMDO-Buoi${code}-Interactive`,
    `BMDO-Buoi${code}-Interactive`,
    "index.html",
  );
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
  };
}
