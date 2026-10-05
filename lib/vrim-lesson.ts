import type { PhaseId } from "./course";

/** Lesson row key. Old learner answers stay on this lesson; do not retarget or delete them. */
export const LEGACY_STORAGE_KEY = "bmdo-k03-buoi04-vrim-v1";
/** Browser cache for the new studio only, so a dirty v1 cache cannot fill the new form. */
export const STUDIO_CACHE_KEY = "bmdo-k03-buoi04-vrim-v2";
export const LESSON_PATH = "/learn/course/bmdo-k03/lesson/04";
export const RETIRED_VRIM_PATH = "/learn/course/bmdo-k03/lesson/04/vrim";

export type NodeType = "V" | "B" | "F";
export type NodeStatus = "planned" | "internal" | "observed";
export type RimControl = "core" | "open";
export type LibraryRow = [string, string, string, string[][]];

export type VrimNode = {
  id: string;
  type: NodeType;
  text: string;
  audience: string;
  condition: string;
  status: NodeStatus;
  source: string;
  date: string;
  measure: string;
  target: string;
  owner: string;
  control: RimControl;
  links: string[];
};

export type VrimContext = {
  company: string;
  product: string;
  industry: string;
  model: string;
  address: string;
  uc: string;
  situation: string;
  baseline: string;
  mission: string;
  aspiration: string;
  commitment: string;
  values: string;
  market: string;
  limit: string;
};

export type Signal = { signal: string; evidence: string };

export type WorkbookNotes = {
  name: string;
  date: string;
  barriers: Signal[];
  drivers: Signal[];
  priority: string;
  why: string;
  quiz: string[];
  extract: { clear: string; shift: string; principle: string; sentence: string };
  resolve: { action: string; hypothesis: string; first24: string; people: string; result: string; evidence: string };
};

export type VrimState = {
  version: 2;
  context: VrimContext;
  nodes: VrimNode[];
  lens: { customer: string; operation: string; evidence: string };
  improve: { action: string; owner: string; due: string; proof: string; lesson: string; decision: string };
  snapshots: { date: string; text: string }[];
  workbook: WorkbookNotes;
  legacy: unknown;
  ui: { section: string };
  outline?: string;
};

export type Issue = { code: string; text: string; id?: string };

const PHASES: PhaseId[] = ["overview", "activate", "paradigm", "practice", "lens", "improve", "extract", "resolve"];

export function studioCacheKey(userId: number) {
  return `vabix-cache:${userId}:${STUDIO_CACHE_KEY}`;
}

export function legacyCacheKey(userId: number) {
  return `vabix-cache:${userId}:${LEGACY_STORAGE_KEY}`;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function signal(): Signal {
  return { signal: "", evidence: "" };
}

export function blankWorkbook(): WorkbookNotes {
  return {
    name: "",
    date: "",
    barriers: [signal(), signal(), signal()],
    drivers: [signal(), signal(), signal()],
    priority: "",
    why: "",
    quiz: ["", "", "", ""],
    extract: { clear: "", shift: "", principle: "", sentence: "" },
    resolve: { action: "", hypothesis: "", first24: "", people: "", result: "", evidence: "" },
  };
}

export function fresh(): VrimState {
  return {
    version: 2,
    context: {
      company: "", product: "", industry: "food", model: "Sản phẩm", address: "AH",
      uc: "", situation: "", baseline: "", mission: "", aspiration: "", commitment: "",
      values: "", market: "", limit: "",
    },
    nodes: [],
    lens: { customer: "", operation: "", evidence: "" },
    improve: { action: "", owner: "", due: "", proof: "", lesson: "", decision: "" },
    snapshots: [],
    workbook: blankWorkbook(),
    legacy: null,
    ui: { section: "overview" },
  };
}

export function node(type: NodeType, id = uid()): VrimNode {
  return {
    id, type, text: "", audience: "", condition: "", status: "planned", source: "", date: "",
    measure: "", target: "", owner: "", control: "core", links: [],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function hasLearnerText(value: unknown, depth = 0): boolean {
  if (depth > 8 || value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return false;
  if (Array.isArray(value)) return value.some((item) => hasLearnerText(item, depth + 1));
  const record = asRecord(value);
  if (!record) return false;
  return Object.entries(record).some(([key, item]) => key !== "ui" && key !== "version" && hasLearnerText(item, depth + 1));
}

export function isStudioDocument(value: unknown): value is VrimState {
  const record = asRecord(value);
  return Boolean(record && record.version === 2 && record.context && Array.isArray(record.nodes));
}

function str(value: unknown, max = 20000) {
  if (typeof value !== "string" || value.length > max) throw new Error("Trường dữ liệu không hợp lệ.");
  return value;
}

function padSignals(value: unknown): Signal[] {
  const rows = Array.isArray(value) ? value : [];
  return [0, 1, 2].map((index) => {
    const row = asRecord(rows[index]);
    return {
      signal: typeof row?.signal === "string" ? row.signal.slice(0, 20000) : "",
      evidence: typeof row?.evidence === "string" ? row.evidence.slice(0, 20000) : "",
    };
  });
}

export function normalizeWorkbook(value: unknown): WorkbookNotes {
  const base = blankWorkbook();
  const record = asRecord(value);
  if (!record) return base;
  const text = (key: string) => typeof record[key] === "string" ? (record[key] as string).slice(0, 20000) : "";
  base.name = text("name");
  base.date = text("date").slice(0, 40);
  base.priority = text("priority");
  base.why = text("why");
  base.barriers = padSignals(record.barriers);
  base.drivers = padSignals(record.drivers);
  const quiz = Array.isArray(record.quiz) ? record.quiz : [];
  base.quiz = [0, 1, 2, 3].map((index) => typeof quiz[index] === "string" ? quiz[index].slice(0, 8) : "");
  const extract = asRecord(record.extract);
  const resolve = asRecord(record.resolve);
  for (const key of ["clear", "shift", "principle", "sentence"] as const) {
    base.extract[key] = typeof extract?.[key] === "string" ? extract[key].slice(0, 20000) : "";
  }
  for (const key of ["action", "hypothesis", "first24", "people", "result", "evidence"] as const) {
    base.resolve[key] = typeof resolve?.[key] === "string" ? resolve[key].slice(0, 20000) : "";
  }
  return base;
}

function workbookHasText(notes: WorkbookNotes) {
  return hasLearnerText({
    name: notes.name, priority: notes.priority, why: notes.why,
    barriers: notes.barriers, drivers: notes.drivers, quiz: notes.quiz.filter(Boolean),
    extract: notes.extract, resolve: notes.resolve,
  });
}

/** Strict V-RIM 2.0 check, plus optional class notes. Throws on a bad import. */
export function validateStudio(value: unknown): VrimState {
  const raw = asRecord(value);
  if (!raw || raw.version !== 2 || !raw.context || !Array.isArray(raw.nodes) || raw.nodes.length > 500) {
    throw new Error("Không đúng hồ sơ V-RIM 2.0 hoặc quá 500 thành phần.");
  }
  const base = fresh();
  const context = asRecord(raw.context);
  if (!context) throw new Error("Dữ liệu bối cảnh không hợp lệ.");
  for (const key of Object.keys(base.context) as (keyof VrimContext)[]) {
    base.context[key] = str(context[key]);
  }
  const ids = new Set<string>();
  for (const item of raw.nodes) {
    const row = asRecord(item);
    if (!row || typeof row.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(row.id) || ids.has(row.id)) {
      throw new Error("Thành phần không hợp lệ hoặc trùng ID.");
    }
    if (row.type !== "V" && row.type !== "B" && row.type !== "F") throw new Error("Thành phần không hợp lệ hoặc trùng ID.");
    ids.add(row.id);
    const next = node(row.type, row.id);
    for (const key of ["text", "audience", "condition", "source", "date", "measure", "target", "owner"] as const) {
      next[key] = str(row[key]);
    }
    if (row.status !== "planned" && row.status !== "internal" && row.status !== "observed") {
      throw new Error("Trạng thái/liên kết không hợp lệ.");
    }
    if (row.control !== "core" && row.control !== "open") throw new Error("Trạng thái/liên kết không hợp lệ.");
    if (!Array.isArray(row.links) || row.links.some((id) => typeof id !== "string")) {
      throw new Error("Trạng thái/liên kết không hợp lệ.");
    }
    next.status = row.status;
    next.control = row.control;
    next.links = [...new Set(row.links)];
    base.nodes.push(next);
  }
  for (const item of base.nodes) {
    const expect = item.type === "F" ? "B" : item.type === "B" ? "V" : "";
    if (item.links.some((id) => !base.nodes.some((other) => other.id === id && other.type === expect))) {
      throw new Error("Liên kết sai tầng hoặc mất thành phần.");
    }
  }
  for (const group of ["lens", "improve"] as const) {
    const source = asRecord(raw[group]);
    const target = base[group] as Record<string, string>;
    for (const key of Object.keys(target)) target[key] = str(source?.[key] ?? "");
  }
  if (Array.isArray(raw.snapshots)) {
    base.snapshots = raw.snapshots.filter((item) => {
      const row = asRecord(item);
      return Boolean(row && typeof row.date === "string" && typeof row.text === "string");
    }).slice(-20).map((item) => {
      const row = item as { date: string; text: string };
      return { date: row.date.slice(0, 100), text: row.text.slice(0, 100000) };
    });
  }
  base.workbook = normalizeWorkbook(raw.workbook);
  base.legacy = hasLearnerText(raw.legacy) ? raw.legacy : null;
  const ui = asRecord(raw.ui);
  base.ui = { section: typeof ui?.section === "string" ? ui.section : "overview" };
  return base;
}

export function openStudio(raw: unknown): VrimState {
  if (!isStudioDocument(raw)) {
    const next = fresh();
    next.legacy = hasLearnerText(raw) ? raw : null;
    return next;
  }
  try {
    return validateStudio(raw);
  } catch {
    const next = fresh();
    next.legacy = hasLearnerText(raw.legacy) ? raw.legacy : null;
    return next;
  }
}

/** Strict check that never throws: null when the document is not a valid V-RIM 2.0 file. */
export function tryStudio(raw: unknown): VrimState | null {
  if (!isStudioDocument(raw)) return null;
  try {
    return validateStudio(raw);
  } catch {
    return null;
  }
}

/**
 * Opens Buổi 04 from two separate records.
 * - saved: the new-version record (answer key bmdo-k03-buoi04-vrim-v2). The only record the studio writes.
 * - legacy: the old record (bmdo-k03-buoi04-vrim-v1). Read-only; shown under «Bài làm phiên bản cũ».
 * A saved document that fails the strict check comes back as `broken` with an empty form, and the
 * studio must not autosave, so the stored copy is never overwritten.
 */
export function loadStudio(saved: unknown, legacy: unknown): { state: VrimState; broken: unknown } {
  let oldWork: unknown = hasLearnerText(legacy) ? legacy : null;
  let earlier: VrimState | null = null;
  if (isStudioDocument(legacy)) {
    // Only a pre-release build of this lesson wrote V-RIM 2.0 into the old record. Show the old
    // workbook it carried, and start the new record from its design instead of losing it from view.
    const carried = (legacy as { legacy?: unknown }).legacy;
    oldWork = hasLearnerText(carried) ? carried : null;
    earlier = tryStudio(legacy);
  }
  let state: VrimState;
  let broken: unknown = null;
  if (isStudioDocument(saved)) {
    const opened = tryStudio(saved);
    state = opened ?? fresh();
    if (!opened) broken = saved;
  } else if (hasLearnerText(saved)) {
    state = fresh();
    broken = saved;
  } else {
    state = earlier ?? fresh();
  }
  state.legacy = oldWork;
  return { state, broken };
}

/** What the studio sends to the new record. The old work is never copied into it. */
export function savePayload(state: VrimState): VrimState {
  const payload = withOutline(state);
  payload.legacy = null;
  return payload;
}

/** Device cache of the old workbook, used only when the server copy has no legacy text. */
export function legacyFromCache(raw: string | null): unknown {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { answers?: unknown };
    return hasLearnerText(parsed?.answers) && !isStudioDocument(parsed.answers) ? parsed.answers : null;
  } catch {
    return null;
  }
}

export function importProfile(raw: unknown, current: VrimState): VrimState {
  const next = validateStudio(raw);
  // The old work always comes from the read-only old record, never from an imported file.
  next.legacy = current.legacy;
  if (!workbookHasText(next.workbook)) next.workbook = clone(current.workbook);
  return next;
}

export function assess(state: VrimState): { issues: Issue[]; linked: number; declared: number; planned: number } {
  const issues: Issue[] = [];
  const add = (code: string, text: string, id?: string) => issues.push({ code, text, id });
  if (!state.context.company.trim() || !state.context.product.trim()) add("CONTEXT", "Bổ sung doanh nghiệp và sản phẩm/dịch vụ đang thiết kế.");
  if (!state.context.uc.trim() || !state.context.situation.trim()) add("UC", "Chưa rõ UC và bối cảnh sử dụng; không thể xác nhận phù hợp khách hàng.");
  for (const type of ["V", "B", "F"] as const) {
    if (!state.nodes.some((item) => item.type === type && item.text.trim())) add(`EMPTY_${type}`, `Chưa có nội dung ${type}.`);
  }
  for (const item of state.nodes) {
    if (!item.text.trim()) add("TEXT", `Một thành phần ${item.type} chưa được mô tả.`, item.id);
    const next = item.type === "F" ? "B" : "V";
    if (item.type !== "V" && !item.links.some((id) => state.nodes.some((other) => other.id === id && other.type === next))) {
      add("LINK", `Chưa nối ${item.type} với ${next}: ${item.text || "chưa đặt tên"}`, item.id);
    }
    if (item.type === "V" && !state.nodes.some((other) => other.type === "B" && other.links.includes(item.id))) {
      add("SUPPORT", `Giá trị chưa có lợi ích hỗ trợ: ${item.text || "chưa đặt tên"}`, item.id);
    }
    if (item.type === "B" && !state.nodes.some((other) => other.type === "F" && other.links.includes(item.id))) {
      add("SUPPORT", `Lợi ích chưa có tính năng hỗ trợ: ${item.text || "chưa đặt tên"}`, item.id);
    }
    if (!item.audience.trim()) add("AUDIENCE", `Chưa chỉ rõ người hưởng lợi / sử dụng của ${item.text || item.type}`, item.id);
    if (!item.condition.trim()) add("CONDITION", `Chưa nêu điều kiện / giới hạn của ${item.text || item.type}`, item.id);
    if (item.status === "observed" && (!item.source.trim() || !item.date)) {
      add("EVIDENCE", `Đã khai có bằng chứng nhưng thiếu nguồn hoặc ngày: ${item.text || item.type}`, item.id);
    }
    if (item.status === "planned" && (!item.measure.trim() || !item.owner.trim())) {
      add("PLAN", `Giả thuyết chưa có cách kiểm chứng hoặc người phụ trách: ${item.text || item.type}`, item.id);
    }
    if (item.type === "F" && item.control === "open" && !item.owner.trim()) {
      add("OPEN", "Open Rim cần người chịu trách nhiệm cho nguồn lực bên ngoài.", item.id);
    }
  }
  return {
    issues,
    linked: state.nodes.filter((item) => item.type !== "V" && item.links.length).length,
    declared: state.nodes.filter((item) => item.status === "observed" && item.source.trim() && item.date).length,
    planned: state.nodes.filter((item) => item.status === "planned").length,
  };
}

export function findExample(key: string) {
  const [groupId, indexText] = key.split(":");
  const group = LIBRARY.find((row) => row[0] === groupId);
  const example = group?.[3][Number(indexText)];
  if (!group || !example) return null;
  return { group, example };
}

/** Adds three hypotheses. Does not replace nodes already on the wheel. */
export function addExample(state: VrimState, key: string): VrimState {
  const found = findExample(key);
  if (!found) return state;
  if (state.nodes.length + 3 > 500) throw new Error("Một hồ sơ hỗ trợ tối đa 500 thành phần.");
  const next = clone(state);
  const { group, example } = found;
  const value = node("V");
  const benefit = node("B");
  const feature = node("F");
  for (const item of [value, benefit, feature]) {
    item.audience = example[1];
    item.condition = example[5];
    item.measure = example[6];
  }
  value.text = example[4];
  benefit.text = example[3];
  feature.text = example[2];
  benefit.links = [value.id];
  feature.links = [benefit.id];
  next.nodes.push(value, benefit, feature);
  if (!next.context.product.trim()) next.context.product = group[2];
  return next;
}

export function deleteNode(state: VrimState, id: string): VrimState {
  const next = clone(state);
  next.nodes = next.nodes.filter((item) => item.id !== id).map((item) => ({
    ...item,
    links: item.links.filter((link) => link !== id),
  }));
  return next;
}

export function setLink(state: VrimState, id: string, target: string, on: boolean): VrimState {
  const next = clone(state);
  const item = next.nodes.find((row) => row.id === id);
  if (!item || item.type === "V") return next;
  const expect = item.type === "F" ? "B" : "V";
  if (!next.nodes.some((row) => row.id === target && row.type === expect)) return next;
  item.links = on ? [...new Set([...item.links, target])] : item.links.filter((link) => link !== target);
  return next;
}

function filled(value: string | undefined) {
  return Boolean(value && value.trim());
}

export function phaseFlags(state: VrimState): Record<PhaseId, boolean> {
  const linked = state.nodes.some((item) => item.type === "F" && item.text.trim() && item.links.length)
    && state.nodes.some((item) => item.type === "B" && item.text.trim() && item.links.length)
    && state.nodes.some((item) => item.type === "V" && item.text.trim());
  return {
    overview: filled(state.workbook.name) || filled(state.context.company),
    activate: filled(state.context.company) && filled(state.context.product) && (filled(state.context.uc) || filled(state.workbook.priority)),
    paradigm: state.workbook.quiz.filter(Boolean).length >= 4 || state.nodes.length >= 3,
    practice: linked,
    lens: filled(state.lens.customer) || filled(state.lens.operation) || filled(state.lens.evidence),
    improve: filled(state.improve.action) || state.snapshots.length > 0,
    extract: filled(state.improve.lesson) || filled(state.workbook.extract.principle) || filled(state.workbook.extract.clear),
    resolve: filled(state.improve.owner) && (filled(state.improve.decision) || filled(state.workbook.resolve.action)),
    report: false,
  };
}

export function progressOf(state: VrimState) {
  const flags = phaseFlags(state);
  const done = PHASES.filter((id) => flags[id]);
  return { done, progress: Math.round((done.length / PHASES.length) * 100) };
}

export function summary(state: VrimState) {
  const lines = [
    `V-RIM — ${state.context.company}`,
    state.context.product,
    `UC: ${state.context.uc}`,
    `Bối cảnh: ${state.context.situation}`,
    ...state.nodes.map((item) => {
      const links = item.links.map((id) => state.nodes.find((other) => other.id === id)?.text).filter(Boolean).join("; ");
      return `${item.type}: ${item.text}\nCho: ${item.audience} | Trạng thái: ${item.status}\nLiên kết: ${links}\nĐiều kiện: ${item.condition}\nNguồn: ${item.source} (${item.date})\nKiểm chứng: ${item.measure} | Tiêu chí: ${item.target}`;
    }),
  ];
  return lines.filter(Boolean).join("\n\n");
}

export function withOutline(state: VrimState): VrimState {
  return { ...state, outline: summary(state).slice(0, 4000) };
}

const LEGACY_LABELS: Record<string, string> = {
  "profile.name": "Họ và tên",
  "profile.company": "Doanh nghiệp",
  "profile.industry": "Lĩnh vực",
  "profile.group": "Nhóm",
  "profile.date": "Ngày thực hành",
  "activate.product": "Sản phẩm / dịch vụ",
  "activate.customer": "Khách hàng",
  "activate.priority": "Vấn đề ưu tiên",
  "activate.why": "Vì sao ưu tiên",
  "practice.value": "Value",
  "practice.valueWhy": "Vì sao giá trị này",
  "practice.gaps": "Khoảng trống",
  "practice.statement": "Câu VBF",
  "practice.promiseLimit": "Giới hạn lời hứa",
  "practice.coreCritical": "Core phải kiểm soát",
  "practice.openOpportunity": "Open có thể huy động",
  "fit.mission": "Khớp Mission",
  "fit.aspiration": "Khớp Aspiration",
  "fit.commitment": "Khớp Commitment",
  "fit.values": "Khớp Values",
  "lens.keyFeedback": "Phản biện quan trọng",
  "lens.knownUnknown": "Đã biết / còn giả thuyết",
  "improve.before": "VBF trước",
  "improve.after": "VBF sau",
  "improve.resistance": "Lực cản dự kiến giảm",
  "improve.momentum": "Lực đẩy dự kiến tăng",
  "extract.clear": "Điều đã nhìn rõ",
  "extract.shift": "Điều đổi góc nhìn",
  "extract.principle": "Nguyên tắc",
  "extract.sentence": "Câu mang theo",
  "resolve.action": "Hành động kiểm chứng",
  "resolve.hypothesis": "Giả thuyết",
  "resolve.first24": "Việc trong 24 giờ",
  "resolve.people": "Người phối hợp",
  "resolve.result": "Kết quả sau 7 ngày",
  "resolve.evidence": "Bằng chứng",
  "resolve.due": "Thời hạn",
  "resolve.owner": "Người chịu trách nhiệm",
  "resolve.decision": "Quyết định",
};

function pathValue(source: unknown, path: string): string {
  const value = path.split(".").reduce<unknown>((obj, key) => {
    if (Array.isArray(obj) && /^\d+$/.test(key)) return obj[Number(key)];
    if (obj && typeof obj === "object" && key in (obj as Record<string, unknown>)) return (obj as Record<string, unknown>)[key];
    return undefined;
  }, source);
  return typeof value === "string" ? value.trim() : "";
}

function humanize(path: string) {
  return path
    .replace(/\.\d+\./g, " ")
    .replace(/\./g, " · ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function legacyLines(source: unknown): { label: string; value: string }[] {
  if (!hasLearnerText(source)) return [];
  const lines: { label: string; value: string }[] = [];
  const seen = new Set<string>();
  for (const [path, label] of Object.entries(LEGACY_LABELS)) {
    const value = pathValue(source, path);
    if (!value) continue;
    seen.add(path);
    lines.push({ label, value });
  }
  const walk = (value: unknown, path: string) => {
    if (lines.length >= 48) return;
    if (typeof value === "string") {
      const text = value.trim();
      if (!text || seen.has(path) || path.startsWith("ui.") || path === "version") return;
      lines.push({ label: humanize(path), value: text });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}.${index}`));
      return;
    }
    const record = asRecord(value);
    if (!record) return;
    for (const [key, item] of Object.entries(record)) {
      if (key === "ui") continue;
      walk(item, path ? `${path}.${key}` : key);
    }
  };
  walk(source, "");
  return lines;
}

export const QUIZ: { prompt: string; answer: string; why: string; choices: [string, string][] }[] = [
  {
    prompt: "Hệ thống gửi cảnh báo tồn kho theo thời gian thực",
    answer: "F",
    why: "Đây là khả năng quan sát được của sản phẩm.",
    choices: [["V", "V"], ["B", "B"], ["F", "F"], ["X", "Chưa đủ"]],
  },
  {
    prompt: "Người quản lý phát hiện sớm nguy cơ thiếu hàng",
    answer: "B",
    why: "Đây là cải thiện cụ thể nhờ Feature.",
    choices: [["V", "V"], ["B", "B"], ["F", "F"], ["X", "Chưa đủ"]],
  },
  {
    prompt: "Doanh nghiệp duy trì khả năng cung ứng ổn định",
    answer: "V",
    why: "Đây là kết quả có ý nghĩa đối với khách hàng.",
    choices: [["V", "V"], ["B", "B"], ["F", "F"], ["X", "Chưa đủ"]],
  },
  {
    prompt: "Giải pháp toàn diện",
    answer: "X",
    why: "Đây mới là khẩu hiệu chung chung, chưa đủ là Value.",
    choices: [["V", "V"], ["B", "B"], ["F", "F"], ["X", "Chưa đủ"]],
  },
];

export const NAMES: Record<NodeType, string> = { V: "Giá trị", B: "Lợi ích", F: "Tính năng" };

export function sampleState(legacy: unknown): VrimState {
  const state = fresh();
  state.legacy = legacy;
  state.workbook.name = "Nguyễn Minh An";
  state.workbook.date = "2026-10-05";
  state.workbook.barriers = [
    { signal: "Báo cáo đến muộn", evidence: "CEO nhận số liệu sau 15–20 ngày" },
    { signal: "Nhiều file rời rạc", evidence: "Dữ liệu nằm ở kế toán, ngân hàng và bảng tính" },
    { signal: "Lợi ích mô tả chung chung", evidence: "Đội ngũ chỉ nói “quản trị tài chính tốt hơn”" },
  ];
  state.workbook.drivers = [
    { signal: "Khách hàng hỏi về cảnh báo tiền", evidence: "7/10 CEO quan tâm dòng tiền tuần" },
    { signal: "Đã có giao dịch lặp lại", evidence: "60% khách hàng gia hạn" },
    { signal: "Có dữ liệu vận hành", evidence: "Đo được công nợ và số dư theo tuần" },
  ];
  state.workbook.priority = "CEO không nhìn thấy nguy cơ thiếu tiền đủ sớm để hành động.";
  state.workbook.why = "Ảnh hưởng trực tiếp đến khả năng thanh toán và quyết định chi tiêu.";
  state.workbook.quiz = ["F", "B", "V", "X"];
  state.context.company = "Công ty ABC";
  state.context.product = "Dịch vụ kế toán và quản trị dòng tiền cho SME";
  state.context.industry = "professional";
  state.context.model = "Dịch vụ";
  state.context.address = "AC";
  state.context.uc = "CEO doanh nghiệp nhỏ — người dùng báo cáo; kế toán trưởng — người nhập liệu";
  state.context.situation = "Mỗi tuần CEO cần biết tiền có đủ cho các khoản đến hạn hay không.";
  state.context.baseline = "Số liệu đến sau 15–20 ngày, nằm ở nhiều file.";
  state.context.limit = "Không hứa loại bỏ mọi rủi ro thiếu tiền.";
  state.context.market = "Thử với 10 CEO đang dùng dịch vụ kế toán, trong 4 tuần.";
  const value = node("V", "sampleV");
  const benefit = node("B", "sampleB");
  const feature = node("F", "sampleF");
  value.text = "CEO hiểu tình hình tiền và ra quyết định tài chính kịp thời";
  benefit.text = "Nhìn thấy nguy cơ thiếu tiền sớm hơn chu kỳ báo cáo tháng";
  feature.text = "Cảnh báo dòng tiền tuần từ số dư, công nợ và lịch chi";
  value.audience = benefit.audience = feature.audience = "CEO SME";
  value.condition = benefit.condition = feature.condition = "Số liệu được cập nhật; có người xử lý cảnh báo";
  feature.measure = "Thời điểm CEO thấy cảnh báo so với ngày thiếu tiền thực tế";
  feature.owner = "Kế toán trưởng";
  benefit.links = ["sampleV"];
  feature.links = ["sampleB"];
  state.nodes = [value, benefit, feature];
  state.lens.customer = "CEO có cần cảnh báo tuần, hay chỉ cần báo cáo tháng đã đủ?";
  state.improve.action = "Tách người dùng (CEO) khỏi người nhập (kế toán) trước khi thêm tính năng.";
  state.improve.proof = "Nhật ký 10 CEO: ngày thấy cảnh báo và quyết định chi đã đổi hay chưa.";
  state.improve.lesson = "Không giới thiệu tính năng trước khi làm rõ giá trị với đúng UC.";
  state.workbook.extract = {
    clear: "Feature, Benefit và Value đang bị gộp thành một câu chào hàng.",
    shift: "Thiết kế đi từ giá trị của CEO, rồi mới chọn lợi ích và tính năng.",
    principle: "Không giới thiệu tính năng trước khi làm rõ giá trị với đúng UC.",
    sentence: "làm rõ ai cần điều gì, và điều kiện nào khiến lời hứa còn đúng",
  };
  state.improve.owner = "CEO Công ty ABC";
  state.improve.due = "2026-10-12";
  state.improve.decision = "Thử nghiệm";
  state.workbook.resolve = {
    action: "Ngồi với 3 CEO, đọc một cảnh báo tuần và ghi họ quyết định gì.",
    hypothesis: "Cảnh báo sớm giúp CEO dời một khoản chi trước hạn.",
    first24: "Chọn 3 khách hàng và đặt lịch 20 phút.",
    people: "Kế toán trưởng",
    result: "Ít nhất một quyết định chi được ghi lại kèm ngày.",
    evidence: "Biên bản 3 cuộc nói chuyện, không kèm số liệu nhạy cảm.",
  };
  return state;
}
export const LIBRARY: LibraryRow[] = [
['food','Thực phẩm & đồ uống','Bánh mì que cho văn phòng',[
['Suất ăn sáng theo lịch','Nhân viên văn phòng / người đặt suất ăn','Đóng gói từng suất, nhãn thành phần, giao theo khung giờ','Giảm công chia suất và dễ kiểm tra thành phần','Chủ động tổ chức bữa ăn phù hợp','Nhãn đúng thực tế; năng lực giao theo lịch','Nhật ký giao hàng, thời gian chia suất và phản hồi hai nhóm UC','Đóng gói đẹp chưa chứng minh thực phẩm an toàn.'],
['Thực phẩm cho nhà bán lẻ','Chủ cửa hàng AR','Lô nhỏ, ghi hạn dùng, lịch bổ sung hàng','Dễ điều chỉnh tồn và giảm hàng quá hạn','Vận hành vốn lưu động chủ động hơn','Dữ liệu bán ra và bảo quản phù hợp','Số ngày tồn, lượng hủy và phản hồi cửa hàng','Hàng giao vào AR không đồng nghĩa AR đã bán được.']]],
['software','Phần mềm & công nghệ','Phần mềm điều hành',[
['Cảnh báo tồn kho','Nhân viên kho / người quản lý','Cảnh báo theo ngưỡng tồn cấu hình','Nhận biết sớm nguy cơ thiếu hàng','Duy trì cung ứng ổn định','Tồn kho được cập nhật; có người xử lý cảnh báo','Lịch cảnh báo, thời gian xử lý, số lần hết hàng','Có cảnh báo không tự động làm giảm thiếu hàng.'],
['Phân quyền tài khoản','Quản trị viên / nhân viên','Phân quyền theo vai trò và nhật ký truy cập','Giới hạn thao tác ngoài nhiệm vụ và truy vết','Kiểm soát hoạt động có trách nhiệm','Quyền được cấu hình, rà soát định kỳ','Kiểm tra quyền và thử tình huống truy cập','Có tính năng bảo mật không đồng nghĩa không còn rủi ro.']]],
['manufacture','Sản xuất & thiết bị','Thiết bị cho xưởng',[
['Bảo trì thiết bị','Quản đốc / kỹ thuật viên','Cảm biến và thông báo theo ngưỡng','Phát hiện bất thường để kiểm tra sớm','Chủ động duy trì sản xuất','Ngưỡng phù hợp và có quy trình phản ứng','Lịch sự cố, dừng máy và công việc bảo trì','Không hứa không bao giờ dừng máy.'],
['Thay đổi khuôn','Người vận hành','Cơ cấu thay khuôn có hướng dẫn','Giảm thao tác chuyển đổi giữa lô','Linh hoạt đáp ứng đơn hàng','Đào tạo, an toàn và loại khuôn tương thích','Thời gian đổi khuôn trước/sau và lỗi','Tốc độ không được đánh đổi an toàn.']]],
['education','Giáo dục & đào tạo','Chương trình học ứng dụng',[
['Workshop CEO','Học viên / người mua chương trình','Bài tập doanh nghiệp và phản biện theo rubric','Nhận diện lỗ hổng trong bản thiết kế','Tự chủ ra quyết định có căn cứ hơn','Dữ kiện thực và thời gian thực hành','Bản trước/sau, bài giải và phản hồi','Hài lòng sau lớp chưa chứng minh năng lực tăng.'],
['Học ngoại ngữ','Người học / phụ huynh','Luyện hội thoại và phản hồi từng lượt','Nhận biết lỗi và luyện sửa theo tình huống','Tự tin giao tiếp trong bối cảnh mục tiêu','Mức đầu vào, tần suất luyện và giáo viên','Bài nói cùng rubric qua thời gian','Số buổi học không đồng nghĩa đạt trình độ.']]],
['health','Y tế & chăm sóc','Dịch vụ chăm sóc',[
['Nhắc lịch tái khám','Người bệnh / người chăm sóc','Nhắc lịch và hướng dẫn chuẩn bị đã được duyệt','Dễ nhớ lịch và chuẩn bị đúng','Chủ động theo dõi chăm sóc','Đồng ý nhận tin và nội dung chuyên môn được duyệt','Tỷ lệ nhận tin, đúng hẹn và phản hồi','Không suy ra hiệu quả điều trị từ việc đến đúng hẹn.'],
['Hướng dẫn sau dịch vụ','Người sử dụng','Hướng dẫn dễ đọc, đầu mối hỏi đáp','Dễ biết việc cần làm và nơi cần hỏi','An tâm hơn trong quá trình chăm sóc','Năng lực chuyên môn, giới hạn và chuyển tuyến','Phản hồi hiểu hướng dẫn, câu hỏi phát sinh','Không hứa chữa khỏi; tuân thủ quy định chuyên ngành.']]],
['logistics','Logistics & vận tải','Giao nhận hàng',[
['Theo dõi giao hàng','Người gửi / người nhận','Cập nhật trạng thái và thông báo ngoại lệ','Giảm thời gian hỏi và chủ động nhận hàng','Kiểm soát kế hoạch giao nhận','Dữ liệu hành trình cập nhật và phương án xử lý','Độ trễ cập nhật, cuộc gọi hỏi và phản hồi','Bản đồ hành trình không chứng minh giao đúng hạn.'],
['Vận chuyển hàng lạnh','Chủ hàng','Ghi nhiệt độ theo hành trình','Phát hiện lệch điều kiện bảo quản','Có căn cứ kiểm soát chất lượng vận chuyển','Thiết bị hiệu chuẩn và quy trình xử lý lệch','Nhật ký nhiệt độ và kiểm tra hàng','Có nhật ký không tự chứng minh hàng đạt chất lượng.']]],
['hospitality','Du lịch & lưu trú','Dịch vụ lưu trú',[
['Nhận phòng','Khách / người đặt','Khai báo trước và hướng dẫn đến nơi','Giảm thao tác lúc nhận phòng','Bắt đầu kỳ nghỉ thuận tiện hơn','Dữ liệu đúng, phòng sẵn sàng, hỗ trợ ngoại lệ','Thời gian chờ và phản hồi khách','Thao tác nhanh chưa đồng nghĩa cảm thấy được chào đón.'],
['Tour gia đình','Người lớn / trẻ em','Lịch có khoảng nghỉ và lựa chọn hoạt động','Dễ điều chỉnh theo sức khỏe, sở thích','Cùng tận hưởng chuyến đi phù hợp','Năng lực hướng dẫn và điều kiện điểm đến','Mức tham gia, thay đổi lịch và phản hồi','Không lấy ý kiến người đặt thay mọi thành viên.']]],
['retail','Bán lẻ & thương mại','Cửa hàng đa kênh',[
['Tra tồn trước khi đến','Người mua','Hiển thị tồn và giữ hàng có thời hạn','Giảm chuyến đi khi không có sản phẩm','Mua sắm chủ động','Tồn đồng bộ và điều khoản giữ rõ','Sai lệch tồn, đơn giữ và phản hồi','Số lượt xem không chứng minh tiện lợi.'],
['Đổi trả rõ điều kiện','Người mua / người dùng','Công bố điều kiện và quy trình đổi trả','Dễ biết quyền lợi và bước cần thực hiện','An tâm cân nhắc lựa chọn','Nhân viên thực hiện đúng và không phí ẩn','Thời gian xử lý, khiếu nại và phản hồi','Chính sách trên giấy chưa chứng minh trải nghiệm thực tế.']]],
['construction','Xây dựng & nội thất','Thiết kế và thi công',[
['Phê duyệt vật liệu','Chủ nhà / người dùng','Mẫu vật liệu và hồ sơ duyệt trước thi công','Giảm hiểu khác nhau về hoàn thiện','Chủ động kiểm soát không gian mong muốn','Mẫu đại diện, dung sai và nguồn cung','Biên bản duyệt, sai lệch, phản hồi','Bản phối cảnh không bảo đảm thi công giống tuyệt đối.'],
['Bảo trì công trình','Ban quản lý','Hồ sơ thiết bị, lịch bảo trì và đầu mối','Dễ tìm thông tin xử lý sự cố','Duy trì sử dụng công trình có kế hoạch','Hồ sơ đầy đủ và đơn vị tiếp nhận','Thời gian tìm hồ sơ, xử lý, tình trạng thiết bị','Bàn giao hồ sơ không chứng minh bảo trì đã thực hiện.']]],
['professional','Tư vấn & dịch vụ B2B','Dịch vụ chuyên môn',[
['Tư vấn quy trình','Chủ doanh nghiệp / nhân viên','Sơ đồ quy trình, trách nhiệm và buổi thử','Dễ nhận biết bàn giao và việc tồn đọng','Điều hành minh bạch hơn','Người thực hiện tham gia và áp dụng','Lỗi bàn giao, việc tồn, phản hồi đội ngũ','Báo cáo đẹp không đồng nghĩa tổ chức đã thay đổi.'],
['Dịch vụ kế toán','Chủ doanh nghiệp / kế toán','Checklist hồ sơ và lịch đối soát','Phát hiện hồ sơ thiếu sớm','Chủ động kiểm soát thông tin tài chính','Chứng từ đúng và chuyên môn phù hợp','Lịch đối soát, sai lệch và thời gian bổ sung','Không hứa loại bỏ mọi rủi ro pháp lý.']]],
['agriculture','Nông nghiệp & môi trường','Giải pháp canh tác',[
['Tưới theo dữ liệu','Chủ vườn / người vận hành','Cảm biến ẩm và lịch tưới điều chỉnh','Theo dõi nhu cầu tưới cụ thể hơn','Chủ động sử dụng nước','Hiệu chuẩn, loại đất, cây và thời tiết','Lượng nước, độ ẩm và nhật ký canh tác','Không suy tăng năng suất chỉ từ cảm biến.'],
['Truy xuất lô','Hợp tác xã / người mua','Mã lô gắn nhật ký nguồn và xử lý','Dễ tìm lại thông tin khi có vấn đề','Minh bạch chuỗi cung ứng','Nhật ký trung thực và kiểm tra định kỳ','Thử truy xuất, độ đầy đủ và phản hồi','Có mã QR không chứng minh chất lượng sản phẩm.']]],
['creative','Sáng tạo & truyền thông','Dịch vụ nội dung',[
['Bộ nhận diện','Chủ brand / đội triển khai','Hướng dẫn sử dụng và bộ mẫu','Giảm cách thể hiện không nhất quán','Thể hiện thương hiệu nhất quán hơn','Đội sử dụng hiểu và áp dụng','Kiểm tra mẫu sử dụng và phản hồi','Nhận diện đẹp không tự tạo nhận biết thương hiệu.'],
['Nội dung hướng dẫn','Người dùng sản phẩm','Video từng bước có phụ đề','Dễ theo dõi và làm thử thao tác','Tự chủ sử dụng sản phẩm','Nội dung đúng phiên bản và có hỗ trợ','Hoàn thành tác vụ và phản hồi người dùng','Lượt xem chưa chứng minh hiểu hoặc làm được.']]]
];

export const OPTIONS: Record<NodeType, string[]> = {V:['Chủ động và tự chủ','An tâm có căn cứ','Hiệu quả kinh tế','Duy trì hoạt động ổn định','Phát triển năng lực','Kết nối và thuộc về','Thể hiện bản sắc','Minh bạch và trách nhiệm','Linh hoạt thích ứng','Thuận tiện trong cuộc sống'],B:['Giảm thời gian thực hiện','Giảm công sức thao tác','Phát hiện vấn đề sớm','Giảm sai sót','Dễ theo dõi tiến độ','Dễ sử dụng','Dễ phối hợp','Giảm lãng phí','Dễ lựa chọn phù hợp','Tăng khả năng tiếp cận'],F:['Chức năng sản phẩm','Thành phần / vật liệu','Thông số / cấu tạo','Quy trình cung cấp','Hướng dẫn sử dụng','Khả năng tùy chỉnh','Cơ chế thông báo','Tích hợp dữ liệu','Điều khoản dịch vụ','Năng lực thực hiện']};
