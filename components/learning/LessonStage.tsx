"use client";

import { useEffect, useRef, useState } from "react";
import { PHASES, type PhaseId } from "@/lib/course";
import { LessonTools } from "./LessonShell";

export type SaveState = "idle" | "saving" | "saved" | "offline" | "preview";

type Props = {
  lessonNumber: number;
  courseSlug?: string;
  storageKey: string;
  css: string;
  html: string;
  script: string;
  initialAnswers: Record<string, unknown>;
  initialPhase: string;
  userId: number;
  serverUpdatedAt: string | null;
  onPhase: (phase: PhaseId, done: PhaseId[], progress: number) => void;
  onSaveState: (state: SaveState, savedAt?: string) => void;
  sampleLabel?: string;
  scopeClass?: string;
  showSample?: boolean;
};

type Bridge = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const memory = new Map<string, string>();

function cacheKey(userId: number, storageKey: string) {
  return `vabix-cache:${userId}:${storageKey}`;
}

export function LessonStage(props: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(false);
  const [generation, setGeneration] = useState(0);
  const snapshot = useRef<string | null>(null);
  const previewRef = useRef(false);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const current = propsRef.current;
    root.innerHTML = current.html;
    root.querySelectorAll("h1, h2, h3, h4").forEach((heading) => trimTrailingStop(heading));
    const scope = current.scopeClass || "bizcar-lesson";
    const style = document.createElement("style");
    style.setAttribute("data-lesson-style", String(current.lessonNumber));
    const chrome = scope === "bizcar-lesson"
      ? `
      .bizcar-lesson .app{display:block !important;min-height:0 !important}
      .bizcar-lesson aside,.bizcar-lesson .topbar,.bizcar-lesson header.top,.bizcar-lesson .toast{display:none !important}
      .bizcar-lesson .content{max-width:920px;padding:4px 0 48px}
      .bizcar-lesson .layout{display:block}
      .bizcar-lesson main{min-width:0}
      .bizcar-lesson{
        --ink:#143420;--paper:#f6f3ea;--white:#fff;--muted:#5e6b62;--line:#e0d6c4;--soft:#efe8d8;
        --gold:#d89830;--gold2:#f8c050;--green:#1f6b45;--teal:#1f6b45;--red:#9d4038;--blue:#1d5c4a;--purple:#3d5c48;
      }
    `
      : `
      ${scope} .shell{max-width:none;padding:4px 0 32px}
      ${scope} header.top{display:none}
    `;
    const fitted = scope === "babosora-lesson"
      ? `${chrome}
      .babosora-lesson .app{min-height:0 !important}
      .babosora-lesson .side{position:static;height:auto}
      .babosora-lesson .topbar{position:static}
      `
      : chrome;
    style.textContent = `${current.css}${fitted}`;
    root.prepend(style);

    delete window.__bizcarProgress;
    // Hooks left by the previous lesson must not leak into this one (each script sets its own).
    if (scope === "bizcar-lesson") {
      for (const name of ["show", "sample", "toggleMenu", "exportJSON", "clearData", "__bizcarShow", "__bizcarState"] as const) delete window[name];
    }
    const key = current.storageKey;
    const localCache = window.localStorage.getItem(cacheKey(current.userId, key));
    let seed = JSON.stringify(current.initialAnswers ?? {});
    if (localCache) {
      try {
        const parsed = JSON.parse(localCache) as { dirty?: boolean; updatedAt?: string; answers?: unknown };
        const serverTime = current.serverUpdatedAt ? Date.parse(current.serverUpdatedAt) : 0;
        const cacheTime = parsed.updatedAt ? Date.parse(parsed.updatedAt) : 0;
        if (parsed.dirty && cacheTime > serverTime && parsed.answers) seed = JSON.stringify(parsed.answers);
      } catch { /* keep server copy */ }
    }
    if (previewRef.current && memory.get(key)) seed = memory.get(key)!;
    memory.set(key, seed === "{}" ? memory.get(key) ?? seed : seed);

    let timer: ReturnType<typeof setTimeout> | undefined;
    let dirty = false;
    const bridge: Bridge = {
      getItem: (itemKey) => {
        if (itemKey !== key) return null;
        const value = memory.get(key);
        return value && value !== "{}" ? value : null;
      },
      removeItem: (itemKey) => { if (itemKey === key) memory.set(key, "{}"); },
      setItem: (itemKey, value) => {
        if (itemKey !== key) return;
        memory.set(key, value);
        if (previewRef.current) {
          current.onSaveState("preview");
          queueMicrotask(publish);
          return;
        }
        dirty = true;
        current.onSaveState("saving");
        window.localStorage.setItem(cacheKey(current.userId, key), JSON.stringify({
          dirty: true, updatedAt: new Date().toISOString(), answers: safeParse(value),
        }));
        clearTimeout(timer);
        timer = setTimeout(() => { void flush(value); }, 700);
        queueMicrotask(publish);
      },
    };

    const fakeLocation = { hash: "", reload: () => setGeneration((n) => n + 1) };
    const realDocument = document;
    let lessonTitle = realDocument.title;
    const scopedDocument = new Proxy(realDocument, {
      set(target, prop, value) {
        // The lesson keeps its own title; the page title is never changed by lesson code.
        if (prop === "title") { lessonTitle = String(value); return true; }
        return Reflect.set(target, prop, value, target);
      },
      get(target, prop, receiver) {
        if (prop === "title") return lessonTitle;
        if (prop === "querySelector") return (selector: string) => root.querySelector(selector);
        if (prop === "querySelectorAll") return (selector: string) => root.querySelectorAll(selector);
        if (prop === "getElementById") return (id: string) => root.querySelector(`#${CSS.escape(id)}`);
        if (prop === "createElement") return (tag: string) => realDocument.createElement(tag);
        if (prop === "body") return root;
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    const run = new Function("localStorage", "location", "document", current.script);
    try {
      run(bridge, fakeLocation, scopedDocument);
    } catch (error) {
      root.setAttribute("data-lesson-error", error instanceof Error ? error.message : String(error));
    }

    const phase = current.initialPhase;
    if (!previewRef.current && phase && phase !== "overview" && typeof window.__bizcarShow === "function") {
      window.__bizcarShow(phase);
    }
    publish();
    // Keep the shell header in step when the lesson's own buttons change panel (no save involved).
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(publish);
    });
    if (scope === "bizcar-lesson") observer.observe(root, { subtree: true, attributes: true, attributeFilter: ["class"] });

    async function flush(value: string) {
      dirty = false;
      try {
        const state = safeParse(value);
        const reading = readDom(root!);
        const response = await fetch("/api/learn/answers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonNumber: current.lessonNumber,
            courseSlug: current.courseSlug,
            answers: state,
            phase: reading.phase,
            phasesDone: reading.done,
            progressPercent: reading.progress,
          }),
        });
        if (!response.ok) throw new Error("save failed");
        const payload = await response.json() as { updatedAt?: string };
        window.localStorage.setItem(cacheKey(current.userId, key), JSON.stringify({
          dirty: false, updatedAt: payload.updatedAt ?? new Date().toISOString(), answers: state,
        }));
        const stamp = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        current.onSaveState("saved", stamp);
      } catch {
        current.onSaveState("offline");
      }
    }

    function publish() {
      const reading = readDom(root!);
      current.onPhase(reading.phase, reading.done, reading.progress);
    }

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      if (dirty && !previewRef.current) void flush(memory.get(key) ?? "{}");
      root.innerHTML = "";
    };
  }, [generation, props.lessonNumber, props.script]);

  function openSample() {
    snapshot.current = memory.get(props.storageKey) ?? "{}";
    previewRef.current = true;
    setPreview(true);
    if (typeof window.sample === "function") window.sample();
    else props.onSaveState("saved");
  }

  function closeSample() {
    if (snapshot.current != null) memory.set(props.storageKey, snapshot.current);
    previewRef.current = false;
    setPreview(false);
    setGeneration((n) => n + 1);
  }

  async function importSample() {
    const confirmed = window.confirm("Chèn bài mẫu sẽ thay thế nội dung bạn đang viết trong bài này. Tiếp tục?");
    if (!confirmed) return;
    previewRef.current = false;
    setPreview(false);
    const value = memory.get(props.storageKey) ?? "{}";
    props.onSaveState("saving");
    await fetch("/api/learn/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonNumber: props.lessonNumber,
        courseSlug: props.courseSlug,
        answers: safeParse(value),
        phase: "overview",
        phasesDone: [],
        progressPercent: 0,
      }),
    });
    setGeneration((n) => n + 1);
  }

  function exportAnswers() {
    if (typeof window.exportJSON === "function") { window.exportJSON(); return; }
    const value = memory.get(props.storageKey) ?? "{}";
    const url = URL.createObjectURL(new Blob([JSON.stringify(safeParse(value), null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `BMDO-Buoi${String(props.lessonNumber).padStart(2, "0")}-${props.storageKey}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const sampleButton = <button type="button" className="btn" onClick={openSample}>{props.sampleLabel ?? "Xem bài mẫu"}</button>;

  return (
    <div>
      {preview && (
        <div className="sample-banner" role="status">
          <div>
            <strong>Bài mẫu — chỉ để xem</strong>
            <span>Nội dung này chưa ghi vào workbook của bạn.</span>
          </div>
          <div className="row-actions">
            <button type="button" className="btn" onClick={closeSample}>Đóng bài mẫu</button>
            <button type="button" className="btn gold" onClick={importSample}>Chèn vào bài của tôi</button>
          </div>
        </div>
      )}
      <LessonTools
        onExport={exportAnswers}
        onPrint={() => window.print()}
        fallback={props.showSample !== false && <div className="lesson-tools no-print">{sampleButton}</div>}
      >
        {props.showSample !== false && sampleButton}
      </LessonTools>
      <div ref={rootRef} className={props.scopeClass || "bizcar-lesson"} />
    </div>
  );
}

function trimTrailingStop(heading: Element) {
  const text = heading.textContent ?? "";
  if (!/[.。]\s*$/.test(text)) return;
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  while (walker.nextNode()) last = walker.currentNode as Text;
  if (last) last.textContent = (last.textContent ?? "").replace(/[.。]\s*$/, "");
}

function safeParse(value: string) {
  try { return JSON.parse(value) as Record<string, unknown>; }
  catch { return {}; }
}

const PHASE_IDS = new Set<string>(PHASES.map((item) => item.id));

/** Current phase: `.panel.active` (most lessons) or `.section.active` (Buổi 18). A sub-step panel that is
 * not one of the shell phases (e.g. Buổi 18 «rfe», «mds») counts as the shell phase before it. */
function activePhase(root: HTMLElement): PhaseId {
  const panels = [...root.querySelectorAll<HTMLElement>(".panel, section.section")];
  const at = panels.findIndex((panel) => panel.classList.contains("active"));
  for (let index = at; index >= 0; index -= 1) {
    const id = panels[index].id || panels[index].getAttribute("data-panel") || "";
    if (PHASE_IDS.has(id)) return id as PhaseId;
  }
  return "overview";
}

function readDom(root: HTMLElement) {
  const phase = activePhase(root);
  const buttons = [...root.querySelectorAll<HTMLElement>(".nav[data-target], .nav-btn[data-target], [data-panel-btn]")];
  const done = buttons.filter((button) => button.classList.contains("done") || button.querySelector(".done")?.textContent?.includes("✓")).map((button) => (button.dataset.target || button.dataset.panelBtn) as PhaseId);
  const text = root.querySelector("#progressText, #progressLabel, #saveState, #progressKpi, #sideProgress")?.textContent ?? "";
  const match = text.match(/(\d+)\s*%/);
  const bar = root.querySelector<HTMLElement>("#progress, #progressFill, #sideMeter");
  const widthMatch = bar?.style.width.match(/(\d+)/);
  const fromDom = match ? Number(match[1]) : widthMatch ? Number(widthMatch[1]) : null;
  const progress = fromDom ?? (typeof window.__bizcarProgress === "number" ? window.__bizcarProgress : (buttons.length ? Math.round((done.length / buttons.length) * 100) : 0));
  return { phase, done, progress };
}

declare global {
  interface Window {
    show?: (id: string) => void;
    sample?: () => void;
    toggleMenu?: () => void;
    exportJSON?: () => void;
    clearData?: () => void;
    __bizcarShow?: (id: string) => void;
    __bizcarState?: () => Record<string, unknown>;
    __bizcarProgress?: number;
    __vabixSession?: number;
    __vabixStorageKey?: string;
    __vabixOpenSession?: (index: number) => void;
    __babosoraSession?: number;
    __babosoraStorageKey?: string;
    __babosoraOpenSession?: (index: number) => void;
  }
}
