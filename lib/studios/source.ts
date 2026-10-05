import fs from "fs";
import path from "path";
import { scopeCss } from "../css-scope";
import { studioScript } from "./script";
import type { StudioConfig } from "./registry";

export const STUDIO_SCOPE = "bmdo-studio";

/** Lesson-shell overrides: the shell already has the phase bar, toolbar and save state. */
const SHELL_CSS = `
.${STUDIO_SCOPE}{display:block;min-height:0;background:transparent;border-radius:18px;overflow-wrap:anywhere}
.${STUDIO_SCOPE} > header,.${STUDIO_SCOPE} > nav,.${STUDIO_SCOPE} > footer{display:none !important}
.${STUDIO_SCOPE} main{max-width:none;margin:0;padding:8px 0 32px}
.${STUDIO_SCOPE} h1{margin-top:0}
.${STUDIO_SCOPE} button{min-height:40px}
.${STUDIO_SCOPE} .tablewrap,.${STUDIO_SCOPE} table{max-width:100%}
.${STUDIO_SCOPE} #notice{z-index:60}
@media (max-width:760px){
  .${STUDIO_SCOPE} main{padding:4px 0 24px}
  .${STUDIO_SCOPE} h1{font-size:26px;line-height:1.25}
  .${STUDIO_SCOPE} article,.${STUDIO_SCOPE} .card{padding:16px;border-radius:14px}
  .${STUDIO_SCOPE} .grid,.${STUDIO_SCOPE} .wheels{grid-template-columns:1fr !important}
  .${STUDIO_SCOPE} input,.${STUDIO_SCOPE} select,.${STUDIO_SCOPE} textarea{font-size:16px}
}
@media print{.${STUDIO_SCOPE} main{padding:0}}
`;

export type StudioSource = { css: string; html: string; script: string };

/** Reads the original studio file. Content and code are used as shipped; only CSS is scoped to the lesson. */
export function loadStudioSource(config: Pick<StudioConfig, "file">): StudioSource {
  const html = fs.readFileSync(path.join(process.cwd(), config.file), "utf8");
  const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
  const body = html.match(/<body[^>]*>([\s\S]*?)<script>/)?.[1] ?? "";
  return { css: `${scopeCss(css, `.${STUDIO_SCOPE}`)}${SHELL_CSS}`, html: body, script: studioScript(html) };
}
