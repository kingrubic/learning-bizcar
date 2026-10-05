/**
 * Runs an original studio script inside a lesson page element (no iframe).
 * - document.querySelector/All/getElementById are scoped to the studio element.
 * - localStorage for the studio's own key is backed by the lesson record (via onSave); other keys stay in memory.
 * - A hook appended to the script reads/sets the studio's current APPLIER step and state from its own scope.
 */
import type { StudioConfig } from "./registry";

export type StudioHost = {
  step: () => number;
  go: (index: number) => void;
  doc: () => unknown;
  /** Header buttons of the studio (Xuất JSON, Nhập JSON, In / Phiếu…), mirrored in the lesson toolbar. */
  actions: () => { index: number; label: string }[];
  runAction: (index: number) => void;
  destroy: () => void;
};

export type HostOptions = {
  root: HTMLElement;
  config: Pick<StudioConfig, "localKey" | "stateVar" | "readStep" | "writeStep">;
  css: string;
  html: string;
  script: string;
  /** Raw JSON the studio should read at start, or null for the studio's own empty profile. */
  initialRaw: string | null;
  onSave: (raw: string) => void;
  onStep: (index: number) => void;
  onError?: (message: string) => void;
};

type Hook = { step?: () => number; go?: (index: number) => void; doc?: () => unknown };

function cryptoShim(): Pick<Crypto, "randomUUID" | "getRandomValues"> {
  const real = globalThis.crypto;
  const getRandomValues = real?.getRandomValues ? real.getRandomValues.bind(real) : <T extends ArrayBufferView | null>(array: T) => {
    const bytes = array as unknown as Uint8Array;
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    return array;
  };
  // randomUUID only exists in secure contexts; studios call it for every new row.
  const randomUUID = real?.randomUUID ? real.randomUUID.bind(real) : () => {
    const b = getRandomValues(new Uint8Array(16)) as Uint8Array;
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
  };
  return { randomUUID, getRandomValues } as Pick<Crypto, "randomUUID" | "getRandomValues">;
}

export function mountStudio(options: HostOptions): StudioHost {
  const { root, config } = options;
  root.innerHTML = options.html;
  const style = document.createElement("style");
  style.textContent = options.css;
  root.prepend(style);

  let raw = options.initialRaw;
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => (key === config.localKey ? raw : memory.get(key) ?? null),
    setItem: (key: string, value: string) => {
      if (key !== config.localKey) { memory.set(key, String(value)); return; }
      raw = String(value);
      options.onSave(raw);
    },
    removeItem: (key: string) => { if (key === config.localKey) raw = null; else memory.delete(key); },
    clear: () => memory.clear(),
    key: () => null,
    get length() { return memory.size; },
  };
  // The studio keeps its own document.title; the page title (set by the app) is never changed.
  let studioTitle = document.title;
  const scoped = new Proxy(document, {
    set(target, prop, value) {
      if (prop === "title") { studioTitle = String(value); return true; }
      return Reflect.set(target, prop, value, target);
    },
    get(target, prop) {
      if (prop === "title") return studioTitle;
      if (prop === "querySelector") return (selector: string) => root.querySelector(selector);
      if (prop === "querySelectorAll") return (selector: string) => root.querySelectorAll(selector);
      if (prop === "getElementById") return (id: string) => root.querySelector(`#${CSS.escape(id)}`);
      if (prop === "body") return root;
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const location = { hash: "", href: "", pathname: "", search: "", reload: () => {} };
  // `window.document` / `window.localStorage` / `window.location` resolve to the same sandboxed objects.
  const scopedWindow = new Proxy(window, {
    get(target, prop) {
      if (prop === "document") return scoped;
      if (prop === "localStorage") return storage;
      if (prop === "location") return location;
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" && !/^[A-Z]/.test(String(prop)) ? value.bind(target) : value;
    },
    set(target, prop, value) { return Reflect.set(target, prop, value, target); },
  });
  const hook: Hook = {};
  const tail = `
;__host.step = function () { try { return Number(${config.readStep}); } catch (e) { return 0; } };
;__host.go = function (i) { ${config.writeStep}; render(); };
;__host.doc = function () { return ${config.stateVar}; };`;
  try {
    const run = new Function("localStorage", "location", "document", "crypto", "__host", "window", `${options.script}\n${tail}`);
    run(storage, location, scoped, cryptoShim(), hook, scopedWindow);
  } catch (error) {
    options.onError?.(error instanceof Error ? error.message : String(error));
  }

  let last = -1;
  const report = () => {
    const index = hook.step ? hook.step() : 0;
    if (index !== last && index >= 0) { last = index; options.onStep(index); }
  };
  const observer = new MutationObserver(report);
  observer.observe(root, { childList: true, subtree: true });
  report();

  const headerButtons = () => [...root.querySelectorAll<HTMLButtonElement>("header button")];
  return {
    step: () => (hook.step ? hook.step() : 0),
    go: (index) => { hook.go?.(index); report(); },
    doc: () => hook.doc?.(),
    actions: () => headerButtons().map((button, index) => ({ index, label: (button.textContent ?? "").trim() })),
    runAction: (index) => headerButtons()[index]?.click(),
    destroy: () => { observer.disconnect(); root.innerHTML = ""; },
  };
}
