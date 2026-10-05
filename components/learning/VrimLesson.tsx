"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { PhaseId } from "@/lib/course";
import type { SaveState } from "./LessonStage";
import {
  LIBRARY,
  NAMES,
  OPTIONS,
  QUIZ,
  addExample,
  assess,
  deleteNode,
  importProfile,
  isStudioDocument,
  legacyCacheKey,
  legacyFromCache,
  legacyLines,
  node,
  openStudio,
  progressOf,
  sampleState,
  setLink,
  studioCacheKey,
  summary,
  withOutline,
  type NodeType,
  type VrimNode,
  type VrimState,
} from "@/lib/vrim-lesson";
import "./vrim-lesson.css";

const PHASES: PhaseId[] = ["overview", "activate", "paradigm", "practice", "lens", "improve", "extract", "resolve"];
const MODELS = ["Sản phẩm", "Dịch vụ", "Thuê bao", "Dự án", "Nền tảng", "Kết hợp"];
const ADDRESSES: [string, string][] = [["AH", "AH · Hộ gia đình"], ["AR", "AR · Bán lẻ / bán lại"], ["AC", "AC · Doanh nghiệp"], ["other", "Loại khác / cần định nghĩa"]];

type Props = {
  initialAnswers: Record<string, unknown>;
  initialPhase: string;
  userId: number;
  serverUpdatedAt: string | null;
  courseSlug: string;
  lessonNumber: number;
  onPhase: (phase: PhaseId, done: PhaseId[], progress: number) => void;
  onSaveState: (state: SaveState, savedAt?: string) => void;
};

function esc(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}

export function VrimLesson(props: Props) {
  const [state, setState] = useState(() => openStudio(props.initialAnswers));
  const [phase, setPhase] = useState<PhaseId>(PHASES.includes(props.initialPhase as PhaseId) ? props.initialPhase as PhaseId : "overview");
  const [preview, setPreview] = useState(false);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("all");
  const [filter, setFilter] = useState<"all" | NodeType>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [optionType, setOptionType] = useState<NodeType>("V");
  const [optionText, setOptionText] = useState(OPTIONS.V[0]);
  const dirty = useRef(false);
  const wasDirty = useRef(false);
  const previewRef = useRef(false);
  const saveTail = useRef(Promise.resolve());
  const snapshot = useRef<VrimState | null>(null);
  const stateRef = useRef(state);
  const propsRef = useRef(props);
  stateRef.current = state;
  propsRef.current = props;

  function ping(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 4200);
  }

  function edit(recipe: (draft: VrimState) => void) {
    if (previewRef.current) {
      setState((current) => {
        const next = structuredClone(current);
        recipe(next);
        return next;
      });
      props.onSaveState("preview");
      return;
    }
    dirty.current = true;
    props.onSaveState("saving");
    setState((current) => {
      const next = structuredClone(current);
      recipe(next);
      return next;
    });
  }

  function go(next: PhaseId) {
    setPhase(next);
    edit((draft) => { draft.ui.section = next; });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    window.__bizcarShow = (id: string) => {
      const next = PHASES.includes(id as PhaseId) ? id as PhaseId : "overview";
      setPhase(next);
      if (previewRef.current) return;
      dirty.current = true;
      propsRef.current.onSaveState("saving");
      setState((current) => ({ ...current, ui: { section: next } }));
    };
    return () => { delete window.__bizcarShow; };
  }, []);

  useEffect(() => {
    if (dirty.current || previewRef.current) return;
    let next = stateRef.current;
    let retry = false;
    try {
      const raw = window.localStorage.getItem(studioCacheKey(props.userId));
      if (raw) {
        const parsed = JSON.parse(raw) as { dirty?: boolean; updatedAt?: string; answers?: unknown };
        const serverTime = props.serverUpdatedAt ? Date.parse(props.serverUpdatedAt) : 0;
        const cacheTime = parsed.updatedAt ? Date.parse(parsed.updatedAt) : 0;
        if (parsed.dirty && cacheTime > serverTime && isStudioDocument(parsed.answers)) {
          next = openStudio(parsed.answers);
          retry = true;
        }
      }
    } catch { /* keep the server copy */ }
    if (!next.legacy) {
      const older = legacyFromCache(window.localStorage.getItem(legacyCacheKey(props.userId)));
      if (older) next = { ...next, legacy: older };
    }
    if (next !== stateRef.current) {
      dirty.current = retry;
      setState(next);
    }
  }, [props.serverUpdatedAt, props.userId]);

  const report = useMemo(() => ({ phase, ...progressOf(state) }), [phase, state]);
  useEffect(() => {
    propsRef.current.onPhase(report.phase, report.done, report.progress);
  }, [report]);

  useEffect(() => {
    if (!dirty.current || previewRef.current) return;
    const handle = window.setTimeout(() => { void flush(); }, 700);
    return () => window.clearTimeout(handle);
  }, [state]);

  useEffect(() => () => {
    if (dirty.current && !previewRef.current) void flush();
  }, []);

  function flush() {
    const run = saveTail.current.then(writeSave);
    saveTail.current = run.then(() => undefined, () => undefined);
    return run;
  }

  async function writeSave() {
    if (!dirty.current || previewRef.current) return;
    const current = propsRef.current;
    dirty.current = false;
    const payload = withOutline(stateRef.current);
    const reading = progressOf(payload);
    window.localStorage.setItem(studioCacheKey(current.userId), JSON.stringify({
      dirty: true, updatedAt: new Date().toISOString(), answers: payload,
    }));
    try {
      const response = await fetch("/api/learn/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonNumber: current.lessonNumber,
          courseSlug: current.courseSlug,
          answers: payload,
          phase: payload.ui.section || "overview",
          phasesDone: reading.done,
          progressPercent: reading.progress,
        }),
      });
      if (!response.ok) throw new Error("save failed");
      const body = await response.json() as { updatedAt?: string };
      if (!dirty.current) {
        window.localStorage.setItem(studioCacheKey(current.userId), JSON.stringify({
          dirty: false, updatedAt: body.updatedAt ?? new Date().toISOString(), answers: payload,
        }));
        current.onSaveState("saved", new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
      } else {
        void flush();
      }
    } catch {
      dirty.current = true;
      current.onSaveState("offline");
    }
  }

  function openSample() {
    wasDirty.current = dirty.current;
    snapshot.current = stateRef.current;
    previewRef.current = true;
    setPreview(true);
    setState(sampleState(stateRef.current.legacy));
    props.onSaveState("preview");
    setPhase("overview");
  }

  function closeSample() {
    previewRef.current = false;
    setPreview(false);
    if (snapshot.current) setState(snapshot.current);
    dirty.current = wasDirty.current;
    if (wasDirty.current) props.onSaveState("saving");
  }

  async function takeSample() {
    if (!window.confirm("Chèn bài mẫu sẽ thay thế nội dung bạn đang viết trong bản mới. Bài làm phiên bản cũ được giữ. Tiếp tục?")) return;
    previewRef.current = false;
    setPreview(false);
    dirty.current = true;
    props.onSaveState("saving");
    await flush();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(withOutline(state), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MyBizCar-VRIM-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printReport() {
    const popup = window.open("", "_blank");
    if (!popup) {
      ping("Trình duyệt chặn cửa sổ in. Dùng nút In / PDF trên thanh bài học.");
      return;
    }
    const review = assess(state);
    popup.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Hồ sơ V-RIM</title><style>body{font:12pt Arial,sans-serif;line-height:1.5;margin:2cm;color:#173e35}pre{white-space:pre-wrap;font:inherit}h1{font-size:22pt}li{margin:8px 0}@media print{button{display:none}}</style></head><body><button onclick="print()">In / lưu PDF</button><h1>MyBizCar · Hồ sơ V-RIM</h1><p>Bản thiết kế do người học khai báo. Không phải chứng nhận giá trị thị trường.</p><pre>${esc(summary(state))}</pre><h2>Cần rà soát</h2><ul>${review.issues.map((issue) => `<li>${esc(issue.text)}</li>`).join("")}</ul><h2>Lăng kính</h2><pre>${esc(JSON.stringify(state.lens, null, 2))}</pre><h2>Cải tiến và cam kết</h2><pre>${esc(JSON.stringify({ ...state.improve, ...state.workbook.resolve }, null, 2))}</pre></body></html>`);
    popup.document.close();
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 3_000_000) throw new Error("Hồ sơ vượt giới hạn 3 MB.");
      const next = importProfile(JSON.parse(await file.text()), stateRef.current);
      if (!window.confirm("Thay bản thiết kế đang mở bằng hồ sơ nhập? Bài làm phiên bản cũ được giữ.")) return;
      dirty.current = true;
      props.onSaveState("saving");
      setState(next);
      ping("Đã nhập và kiểm tra cấu trúc hồ sơ.");
    } catch (error) {
      ping(`Không nhập: ${error instanceof Error ? error.message : "tệp không hợp lệ"}`);
    }
  }

  function useExample(key: string) {
    try {
      const next = addExample(state, key);
      if (next === state) return;
      next.ui = { section: "practice" };
      const added = next.nodes[next.nodes.length - 3];
      if (!previewRef.current) {
        dirty.current = true;
        props.onSaveState("saving");
      }
      setState(next);
      setSelected(added?.id ?? null);
      setFilter("all");
      setPhase("practice");
      ping("Đã thêm 3 giả thuyết; giữ nguyên nội dung cũ. Hãy sửa theo doanh nghiệp.");
    } catch (error) {
      ping(error instanceof Error ? error.message : "Không thêm được.");
    }
  }

  const lines = legacyLines(state.legacy);
  const review = assess(state);
  const shown = state.nodes.filter((item) => item.text.trim()).slice(0, 18);
  const examples = LIBRARY.filter((row) => industry === "all" || row[0] === industry).flatMap((row) => row[3].map((example, index) => ({ row, example, index }))).filter(({ row, example }) => `${row[1]} ${example.join(" ")}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")));

  return (
    <div className="vrim-lesson">
      {preview && (
        <div className="sample-banner no-print" role="status">
          <div>
            <strong>Bài mẫu — chỉ để xem</strong>
            <span>Nội dung này chưa ghi vào workbook của bạn.</span>
          </div>
          <div className="row-actions">
            <button type="button" className="btn" onClick={closeSample}>Đóng bài mẫu</button>
            <button type="button" className="btn gold" onClick={() => { void takeSample(); }}>Chèn vào bài của tôi</button>
          </div>
        </div>
      )}
      <div className="lesson-tools no-print">
        <button type="button" className="btn" onClick={openSample}>Xem bài mẫu</button>
        <button type="button" className="btn" onClick={exportJson}>Xuất JSON</button>
        <label className="btn">Nhập JSON<input className="sr-only" type="file" accept="application/json" onChange={(event) => { void onImport(event.target.files?.[0]); event.target.value = ""; }} /></label>
        <button type="button" className="btn" onClick={printReport}>In hồ sơ</button>
      </div>
      {lines.length > 0 && (
        <details className="vl-legacy">
          <summary>Bài làm phiên bản cũ</summary>
          <p className="vl-lead">Chỉ để xem. Bản V-RIM mới bắt đầu trống. Bài cũ vẫn nằm trong hồ sơ và không bị xóa.</p>
          {lines.map((line) => <p key={`${line.label}:${line.value.slice(0, 24)}`}><strong>{line.label}.</strong> {line.value}</p>)}
        </details>
      )}

      <section className={`vl-panel ${phase === "overview" ? "on" : ""}`} id="overview">
        <div className="vl-hero">
          <div>
            <div className="vl-kicker">Buổi 04 · V-Rim / VBF</div>
            <h1>Từ điều sản phẩm có đến điều khách hàng cần.</h1>
            <p className="vl-lead">Thiết kế một dòng sản phẩm hoặc dịch vụ: bối cảnh, mô thức, mâm xe V/B/F, lăng kính, cải tiến và cam kết. Hồ sơ lưu vào bài học, đồng bộ giữa các thiết bị.</p>
            <div className="vl-actions"><button type="button" className="btn gold" onClick={() => go("activate")}>Bắt đầu từ bối cảnh</button></div>
          </div>
          <Wheel nodes={[]} selected={null} decorative onPick={() => {}} />
        </div>
        <div className="vl-grid-3">
          {[["V", "Giá trị", "Vì sao sự thay đổi này có ý nghĩa với khách?"], ["B", "Lợi ích", "Khách nhận được cải thiện cụ thể nào?"], ["F", "Tính năng", "Sản phẩm có gì, làm được gì hoặc cung cấp ra sao?"]].map(([letter, title, body]) => (
            <article key={letter} className={`vl-card vl-def ${letter.toLowerCase()}`}><span>{letter}</span><h3>{title}</h3><p>{body}</p></article>
          ))}
        </div>
        <div className="vl-card">
          <h2>Người thực hành</h2>
          <div className="vl-grid">
            <Field label="Họ và tên" value={state.workbook.name} onChange={(value) => edit((draft) => { draft.workbook.name = value; })} />
            <Field label="Ngày thực hành" type="date" value={state.workbook.date} onChange={(value) => edit((draft) => { draft.workbook.date = value; })} />
          </div>
          <p className="vl-lead">Sau buổi học: một chuỗi F → B → V có điều kiện, một mốc trước khi sửa, và một việc kiểm chứng có người chịu trách nhiệm.</p>
        </div>
      </section>

      <section className={`vl-panel ${phase === "activate" ? "on" : ""}`} id="activate">
        <header><div className="vl-kicker">A · Bối cảnh</div><h1>Bắt đầu từ doanh nghiệp của bạn.</h1><p className="vl-lead">Một bản thiết kế cho một dòng sản phẩm hoặc dịch vụ và một bối cảnh. Gọi tên lực cản, lực đẩy trước khi đưa giải pháp.</p></header>
        <div className="vl-card"><div className="vl-grid">
          <Field label="Tên doanh nghiệp" value={state.context.company} placeholder="Ví dụ: Magic Oven Foods" onChange={(value) => edit((draft) => { draft.context.company = value; })} />
          <Field label="Dòng sản phẩm / dịch vụ" value={state.context.product} placeholder="Ví dụ: Suất ăn sáng văn phòng" onChange={(value) => edit((draft) => { draft.context.product = value; })} />
          <label className="vl-field">Ngành tham khảo<select value={state.context.industry} onChange={(event) => edit((draft) => { draft.context.industry = event.target.value; })}>{LIBRARY.map((row) => <option key={row[0]} value={row[0]}>{row[1]}</option>)}<option value="other">Ngành khác / kết hợp</option></select></label>
          <label className="vl-field">Mô hình cung cấp<select value={state.context.model} onChange={(event) => edit((draft) => { draft.context.model = event.target.value; })}>{MODELS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="vl-field">Address trọng tâm<select value={state.context.address} onChange={(event) => edit((draft) => { draft.context.address = event.target.value; })}>{ADDRESSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <Field label="UC cụ thể: người mua, dùng, quyết định…" value={state.context.uc} placeholder="Không đồng nhất người mua với người dùng" onChange={(value) => edit((draft) => { draft.context.uc = value; })} />
          <Field long label="Bối cảnh / việc khách muốn giải quyết" value={state.context.situation} placeholder="Khi nào, ở đâu, để làm gì?" onChange={(value) => edit((draft) => { draft.context.situation = value; })} />
          <Field long label="Hiện trạng và cách khách đang làm" value={state.context.baseline} placeholder="Phương án hiện có, vấn đề, nguồn thông tin" onChange={(value) => edit((draft) => { draft.context.baseline = value; })} />
        </div></div>
        <div className="vl-grid">
          <SignalCard title="03 lực cản" hint="Tín hiệu thực tế, chưa phải giải pháp." rows={state.workbook.barriers} signal="Tín hiệu đang cản" onChange={(index, key, value) => edit((draft) => { draft.workbook.barriers[index][key] = value; })} />
          <SignalCard title="03 lực đẩy" hint="Điều đang kéo khách hoặc doanh nghiệp đi tiếp." rows={state.workbook.drivers} signal="Tín hiệu đang đẩy" onChange={(index, key, value) => edit((draft) => { draft.workbook.drivers[index][key] = value; })} />
        </div>
        <div className="vl-card">
          <Field long label="Vấn đề ưu tiên cần soi bằng VBF" value={state.workbook.priority} onChange={(value) => edit((draft) => { draft.workbook.priority = value; })} />
          <Field long label="Vì sao việc này, lúc này?" value={state.workbook.why} onChange={(value) => edit((draft) => { draft.workbook.why = value; })} />
        </div>
        <div className="vl-callout">Ngành chỉ để gợi mở, không quyết định giá trị thay khách hàng. Có thể sửa toàn bộ mẫu.</div>
        <div className="vl-next"><span>Chưa đưa giải pháp khi chưa gọi đúng UC.</span><button type="button" className="btn dark" onClick={() => go("paradigm")}>Tiếp: Mô thức →</button></div>
      </section>

      <section className={`vl-panel ${phase === "paradigm" ? "on" : ""}`} id="paradigm">
        <header><div className="vl-kicker">P · Mô thức thực chiến</div><h1>24 tình huống. 12 nhóm ngành.</h1><p className="vl-lead">Thiết kế từ Giá trị, truy nguyên bằng Lợi ích và Tính năng. Mẫu chỉ thêm ba giả thuyết, không thay dữ liệu đã có.</p></header>
        <div className="vl-flow vl-card"><b>Thiết kế: V → B → F</b><span>↔</span><b>Kiểm tra: F → B → V</b><span>Một–nhiều và nhiều–một. Không phải ba danh sách đứng riêng.</span></div>
        <div className="vl-card">
          <h2>Phân biệt trước khi lấy mẫu</h2>
          {QUIZ.map((item, index) => (
            <div key={item.prompt}>
              <p><strong>{index + 1}. {item.prompt}</strong></p>
              <div className="vl-actions">
                {item.choices.map(([value, label]) => (
                  <button key={value} type="button" className={`vl-choice ${state.workbook.quiz[index] ? (value === item.answer ? "ok" : value === state.workbook.quiz[index] ? "no" : "") : ""}`} onClick={() => edit((draft) => { draft.workbook.quiz[index] = value; })}>{label}</button>
                ))}
              </div>
              {state.workbook.quiz[index] && <p className="vl-lead">{state.workbook.quiz[index] === item.answer ? "Đúng. " : "Chưa đúng. "}{item.why}</p>}
            </div>
          ))}
        </div>
        <div className="vl-card">
          <div className="vl-grid">
            <Field label="Tìm tình huống" value={query} placeholder="Tồn kho, an tâm, giao hàng…" onChange={setQuery} />
            <label className="vl-field">Nhóm ngành<select value={industry} onChange={(event) => setIndustry(event.target.value)}><option value="all">Tất cả ngành</option>{LIBRARY.map((row) => <option key={row[0]} value={row[0]}>{row[1]}</option>)}</select></label>
          </div>
          <p className="vl-lead">{examples.length} tình huống giả lập · không phải bằng chứng doanh nghiệp.</p>
        </div>
        <div className="vl-examples">
          {examples.map(({ row, example, index }) => (
            <article key={`${row[0]}:${index}`} className="vl-card">
              <div className="vl-kicker">{row[1]} · {String(LIBRARY.indexOf(row) * 2 + index + 1).padStart(2, "0")}</div>
              <h3>{example[0]}</h3>
              <p className="vl-lead">{example[1]}</p>
              <div className="vl-chain">{[["F", example[2]], ["B", example[3]], ["V", example[4]]].map(([letter, text]) => <div key={letter}><b className={`vl-pill ${letter.toLowerCase()}`}>{letter}</b><p>{text}</p></div>)}</div>
              <details><summary>Điều kiện, bằng chứng và điểm dễ nhầm</summary><p><strong>Điều kiện:</strong> {example[5]}</p><p><strong>Cần thu:</strong> {example[6]}</p><p className="vl-warn">{example[7]}</p></details>
              <button type="button" className="btn" onClick={() => useExample(`${row[0]}:${index}`)}>＋ Thêm làm giả thuyết của tôi</button>
            </article>
          ))}
        </div>
        {examples.length === 0 && <div className="vl-card">Không có tình huống khớp. Thử từ khóa khác hoặc tạo nội dung riêng ở Thực hành.</div>}
        <div className="vl-next"><span>“Chất lượng cao” chưa đủ cụ thể. “Tăng doanh thu 30%” là lời hứa, chưa phải giá trị đã xác nhận.</span><button type="button" className="btn dark" onClick={() => go("practice")}>Tiếp: Mâm xe →</button></div>
      </section>

      <section className={`vl-panel ${phase === "practice" ? "on" : ""}`} id="practice">
        <header><div className="vl-kicker">P · Thực hành thiết kế</div><h1>Mâm xe mang cấu trúc của bạn.</h1><p className="vl-lead">Thêm V, B, F riêng. Nối F với nhiều B, B với nhiều V. Core/Open nằm ở từng tính năng. MTUA và giới hạn lời hứa ở cấp hồ sơ.</p></header>
        <div className="vl-card vl-actions"><div><b>{state.context.company || "Chưa đặt tên doanh nghiệp"}</b><p className="vl-lead">{state.context.product || "Chưa xác định sản phẩm"} · {state.context.uc || "Chưa xác định UC"}</p></div><button type="button" className="btn" onClick={() => go("activate")}>Sửa bối cảnh</button></div>
        <div className="vl-split">
          <div className="vl-card">
            <div className="vl-kicker">Bản đồ cấu trúc VBF</div>
            <Wheel nodes={shown} selected={selected} onPick={setSelected} />
            <p className="vl-lead">Hình minh họa, không phải thang sức khỏe. Nét đứt: giả thuyết. Bấm một điểm để thấy liên kết trực tiếp. Mâm hiển thị tối đa 18 điểm; danh sách giữ toàn bộ.</p>
            <div className="vl-stats"><div><b>{state.nodes.length}</b><span>thành phần</span></div><div><b>{review.planned}</b><span>giả thuyết</span></div><div><b>{review.issues.length}</b><span>mục cần rà</span></div></div>
          </div>
          <div className="vl-card">
            <div className="vl-actions">
              <h2>Thành phần</h2>
              <div className="vl-seg">{(["all", "V", "B", "F"] as const).map((item) => <button key={item} type="button" className={filter === item ? "on" : ""} onClick={() => setFilter(item)}>{item === "all" ? "Tất cả" : item}</button>)}</div>
            </div>
            <div className="vl-add vl-actions">
              {(["V", "B", "F"] as const).map((type) => <button key={type} type="button" className="btn" onClick={() => {
                if (state.nodes.length >= 500) { ping("Một hồ sơ hỗ trợ tối đa 500 thành phần."); return; }
                const created = node(type);
                edit((draft) => { draft.nodes.push(created); });
                setSelected(created.id);
                setFilter("all");
              }}>＋ {type} · {NAMES[type]}</button>)}
            </div>
            <div className="vl-grid">
              <label className="vl-field">Gợi mở theo thành phần<select value={optionType} onChange={(event) => { const type = event.target.value as NodeType; setOptionType(type); setOptionText(OPTIONS[type][0]); }}>{(["V", "B", "F"] as const).map((type) => <option key={type}>{type}</option>)}</select></label>
              <label className="vl-field">Chọn ý để cụ thể hóa<select value={optionText} onChange={(event) => setOptionText(event.target.value)}>{OPTIONS[optionType].map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
            <button type="button" className="btn" onClick={() => {
              if (state.nodes.length >= 500) { ping("Một hồ sơ hỗ trợ tối đa 500 thành phần."); return; }
              const created = node(optionType);
              created.text = optionText;
              edit((draft) => { draft.nodes.push(created); });
              setSelected(created.id);
            }}>Thêm ý</button>
            <p className="vl-lead">Ý gợi mở chưa phải tuyên bố hoàn chỉnh. Hãy sửa theo khách hàng và dữ kiện của bạn.</p>
          </div>
        </div>
        {state.nodes.filter((item) => filter === "all" || item.type === filter).map((item) => (
          <NodeCard key={item.id} item={item} nodes={state.nodes} selected={selected === item.id} onSelect={() => setSelected(item.id)} onChange={(key, value) => edit((draft) => { const row = draft.nodes.find((entry) => entry.id === item.id); if (row) (row as unknown as Record<string, string>)[key] = value; })} onToggle={(target, on) => { const next = setLink(state, item.id, target, on); setState(next); if (!previewRef.current) { dirty.current = true; props.onSaveState("saving"); } }} onDelete={() => {
            if (!window.confirm("Xóa thành phần và các liên kết đến nó? Các thành phần khác được giữ nguyên.")) return;
            setState(deleteNode(state, item.id));
            if (!previewRef.current) { dirty.current = true; props.onSaveState("saving"); }
            setSelected(null);
          }} />
        ))}
        {state.nodes.length === 0 && <div className="vl-card"><h2>Bắt đầu mâm xe</h2><p>Thêm V, B, F riêng hoặc lấy một tình huống ở Mô thức.</p></div>}
        <div className="vl-card">
          <h2>Điều kiện của cả bản thiết kế</h2>
          <Field long label="Giới hạn lời hứa với khách" value={state.context.limit} placeholder="Điều chưa thể cam kết, điều kiện hoặc ngoại lệ" onChange={(value) => edit((draft) => { draft.context.limit = value; })} />
          <Field long label="Giả thuyết thị trường cần kiểm chứng" value={state.context.market} placeholder="Address/UC nào cần giá trị này? Nguồn nào sẽ kiểm tra?" onChange={(value) => edit((draft) => { draft.context.market = value; })} />
          <details>
            <summary>Đối chiếu Strategic Fit với MTUA</summary>
            <div className="vl-grid">
              {([["mission", "Meaningful Mission"], ["aspiration", "Targeted Aspiration"], ["commitment", "Unwavering Commitment"], ["values", "Anchoring Values"]] as const).map(([key, label]) => (
                <Field key={key} long label={label} value={state.context[key]} placeholder="Giải thích mối liên hệ, không tự chấm đạt" onChange={(value) => edit((draft) => { draft.context[key] = value; })} />
              ))}
            </div>
          </details>
        </div>
        <div className="vl-next"><span>Value ở đây là giá trị với khách hàng, không tự đồng nhất với giá trị neo trong MTUA.</span><button type="button" className="btn dark" onClick={() => go("lens")}>Tiếp: Lăng kính →</button></div>
      </section>

      <section className={`vl-panel ${phase === "lens" ? "on" : ""}`} id="lens">
        <header><div className="vl-kicker">L · Lăng kính</div><h1>Ba góc nhìn. Những câu hỏi cần thiết.</h1><p className="vl-lead">Kiểm tra cấu trúc, không chấm điểm thành công. Điền đủ không chứng minh khách hàng đã nhận giá trị.</p></header>
        <div className="vl-grid-3">
          {([
            ["customer", "Khách hàng", "UC có cần giá trị này? Ai hưởng lợi, ai chịu thêm chi phí? Value có quan trọng với khách dự kiến?"],
            ["operation", "Khả năng thực hiện", "Tính năng và điều kiện có đủ để tạo lợi ích? Core/Open có người chịu trách nhiệm? Đội ngũ làm được lời hứa?"],
            ["evidence", "Bằng chứng", "Nguồn nào hỗ trợ? Điều gì vẫn là giả thuyết? Có phản hồi trái chiều không?"],
          ] as const).map(([key, title, body]) => (
            <article key={key} className="vl-card"><h3>{title}</h3><p className="vl-lead">{body}</p><Field long label="Ghi nhận phản biện" value={state.lens[key]} placeholder="Ý của CEO, học viên hoặc giảng viên" onChange={(value) => edit((draft) => { draft.lens[key] = value; })} /></article>
          ))}
        </div>
        <div className="vl-card">
          <h2>{review.issues.length ? "Các điểm cần rà soát" : "Chưa phát hiện thiếu trường theo bộ quy tắc"}</h2>
          <p className="vl-lead">Kiểm tra này chỉ thấy thiếu dữ kiện và liên kết. “Có bằng chứng” là lời khai: hệ thống kiểm tra có nguồn và ngày, không xác minh nguồn hay suy ra nhân quả.</p>
          {review.issues.map((issue) => (
            <div key={`${issue.code}:${issue.id ?? issue.text}`} className="vl-issue">
              <p>{issue.text}</p>
              <button type="button" className="btn" onClick={() => issue.id ? (setSelected(issue.id), setFilter("all"), go("practice")) : go(issue.code === "CONTEXT" || issue.code === "UC" ? "activate" : "practice")}>Mở</button>
            </div>
          ))}
        </div>
        <div className="vl-next"><span>Đặt câu hỏi trước khi khuyên. CEO MyBizCar là người quyết định.</span><button type="button" className="btn dark" onClick={() => go("improve")}>Tiếp: Cải tiến →</button></div>
      </section>

      <section className={`vl-panel ${phase === "improve" ? "on" : ""}`} id="improve">
        <header><div className="vl-kicker">I · Cải tiến</div><h1>Chọn một thay đổi có ý nghĩa.</h1><p className="vl-lead">Lưu mốc trước khi sửa. Sửa nội dung ở Thực hành; ghi lý do và cách kiểm chứng ở đây.</p></header>
        <div className="vl-card">
          <div className="vl-actions"><h2>Mốc bản thiết kế</h2><button type="button" className="btn" onClick={() => edit((draft) => { draft.snapshots.push({ date: new Date().toLocaleString("vi-VN"), text: summary(draft) }); draft.snapshots = draft.snapshots.slice(-20); })}>Lưu bản trước cải tiến</button></div>
          <p className="vl-lead">Giữ tối đa 20 mốc trong hồ sơ. Xuất JSON nếu cần bản sao dài hơn.</p>
          {state.snapshots.length === 0 && <p>Chưa có mốc nào.</p>}
          {state.snapshots.map((item, index) => <details key={`${item.date}:${index}`}><summary>Mốc {index + 1} · {item.date}</summary><pre>{item.text}</pre></details>)}
        </div>
        <div className="vl-card">
          <Field long label="Thay đổi ưu tiên và lý do" value={state.improve.action} placeholder="Sửa một liên kết, giảm lời hứa hoặc bổ sung điều kiện…" onChange={(value) => edit((draft) => { draft.improve.action = value; })} />
          <Field long label="Bằng chứng sẽ dùng để kiểm tra cải tiến" value={state.improve.proof} placeholder="Thu gì, từ ai, trong phạm vi nào?" onChange={(value) => edit((draft) => { draft.improve.proof = value; })} />
          <button type="button" className="btn" onClick={() => go("practice")}>Quay lại sửa bản thiết kế</button>
        </div>
        <div className="vl-next"><span>Không chỉ thêm tính năng. Hãy giảm lời hứa vượt khả năng.</span><button type="button" className="btn dark" onClick={() => go("extract")}>Tiếp: Đúc kết →</button></div>
      </section>

      <section className={`vl-panel ${phase === "extract" ? "on" : ""}`} id="extract">
        <header><div className="vl-kicker">E · Đúc kết</div><h1>Ba bài học tôi mang theo.</h1><p className="vl-lead">Không nhắc lại thuật ngữ. Đúc kết nguyên lý dùng được cho một sản phẩm khác.</p></header>
        <div className="vl-grid-3">
          <article className="vl-card"><div className="vl-kicker">01 · Nhìn rõ</div><Field long label="Điều tôi đã nhìn rõ" value={state.workbook.extract.clear} onChange={(value) => edit((draft) => { draft.workbook.extract.clear = value; })} /></article>
          <article className="vl-card"><div className="vl-kicker">02 · Đổi góc nhìn</div><Field long label="Điều làm thay đổi góc nhìn" value={state.workbook.extract.shift} onChange={(value) => edit((draft) => { draft.workbook.extract.shift = value; })} /></article>
          <article className="vl-card"><div className="vl-kicker">03 · Nguyên lý</div><Field long label="Nguyên lý tôi sẽ áp dụng" value={state.workbook.extract.principle} onChange={(value) => edit((draft) => { draft.workbook.extract.principle = value; draft.improve.lesson = value; })} /></article>
        </div>
        <div className="vl-callout"><b>Từ hôm nay, tôi sẽ không còn giới thiệu tính năng trước khi làm rõ…</b><Field long label="Hoàn thành câu" value={state.workbook.extract.sentence} onChange={(value) => edit((draft) => { draft.workbook.extract.sentence = value; })} /></div>
        <div className="vl-next"><span>Bài học tốt phải đổi một quyết định hoặc một câu giới thiệu.</span><button type="button" className="btn dark" onClick={() => go("resolve")}>Tiếp: Cam kết →</button></div>
      </section>

      <section className={`vl-panel ${phase === "resolve" ? "on" : ""}`} id="resolve">
        <header><div className="vl-kicker">R · Cam kết</div><h1>Mang thiết kế vào bảy ngày tới.</h1><p className="vl-lead">Một hành động, một người chịu trách nhiệm, một thời hạn và bằng chứng để xem lại. Không gắn nhãn hoàn thành chỉ vì đã điền đủ.</p></header>
        <div className="vl-card"><div className="vl-grid">
          <Field long label="Một hành động ưu tiên" value={state.workbook.resolve.action} onChange={(value) => edit((draft) => { draft.workbook.resolve.action = value; })} />
          <Field long label="Giả thuyết cần kiểm chứng" value={state.workbook.resolve.hypothesis} onChange={(value) => edit((draft) => { draft.workbook.resolve.hypothesis = value; })} />
          <Field long label="Việc đầu tiên trong 24 giờ" value={state.workbook.resolve.first24} onChange={(value) => edit((draft) => { draft.workbook.resolve.first24 = value; })} />
          <Field label="Người cần phối hợp" value={state.workbook.resolve.people} onChange={(value) => edit((draft) => { draft.workbook.resolve.people = value; })} />
          <Field long label="Kết quả cần thấy sau 7 ngày" value={state.workbook.resolve.result} onChange={(value) => edit((draft) => { draft.workbook.resolve.result = value; })} />
          <Field long label="Bằng chứng sẽ mang đến lớp" value={state.workbook.resolve.evidence} onChange={(value) => edit((draft) => { draft.workbook.resolve.evidence = value; })} />
          <Field label="Người chịu trách nhiệm" value={state.improve.owner} onChange={(value) => edit((draft) => { draft.improve.owner = value; })} />
          <Field label="Ngày xem xét lại" type="date" value={state.improve.due} onChange={(value) => edit((draft) => { draft.improve.due = value; })} />
          <label className="vl-field">Quyết định hiện tại<select value={state.improve.decision} onChange={(event) => edit((draft) => { draft.improve.decision = event.target.value; })}>
            <option value="">Chưa quyết định</option>
            {["Thử nghiệm", "Cải tiến", "Tạm dừng", "Giữ trong phạm vi đã kiểm chứng"].map((item) => <option key={item}>{item}</option>)}
          </select></label>
        </div></div>
        <div className="vl-card">
          <h2>Bản tóm tắt</h2>
          <pre>{summary(state)}</pre>
          <div className="vl-actions no-print">
            <button type="button" className="btn gold" onClick={exportJson}>Xuất toàn bộ hồ sơ</button>
            <button type="button" className="btn" onClick={printReport}>In / lưu PDF</button>
          </div>
        </div>
      </section>
      {toast && <div className="vl-toast no-print" role="status">{toast}</div>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, long, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; long?: boolean; type?: string }) {
  return (
    <label className="vl-field">{label}{long
      ? <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      : <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}</label>
  );
}

function SignalCard({ title, hint, rows, signal, onChange }: { title: string; hint: string; rows: { signal: string; evidence: string }[]; signal: string; onChange: (index: number, key: "signal" | "evidence", value: string) => void }) {
  return (
    <article className="vl-card">
      <h2>{title}</h2>
      <p className="vl-lead">{hint}</p>
      {rows.map((row, index) => (
        <div key={title + index} className="vl-grid">
          <Field label={`${index + 1}. ${signal}`} value={row.signal} onChange={(value) => onChange(index, "signal", value)} />
          <Field label="Dữ kiện quan sát" value={row.evidence} onChange={(value) => onChange(index, "evidence", value)} />
        </div>
      ))}
    </article>
  );
}

function NodeCard({ item, nodes, selected, onSelect, onChange, onToggle, onDelete }: {
  item: VrimNode;
  nodes: VrimNode[];
  selected: boolean;
  onSelect: () => void;
  onChange: (key: keyof VrimNode, value: string) => void;
  onToggle: (target: string, on: boolean) => void;
  onDelete: () => void;
}) {
  const next = item.type === "F" ? "B" : "V";
  const order = nodes.filter((row) => row.type === item.type).findIndex((row) => row.id === item.id) + 1;
  const candidates = nodes.filter((row) => row.type === next);
  return (
    <article className={`vl-card vl-node ${item.type.toLowerCase()}`} id={`node-${item.id}`}>
      <div className="vl-actions">
        <button type="button" className="btn" onClick={onSelect}><span className={`vl-pill ${item.type.toLowerCase()}`}>{item.type}{order}</span> {NAMES[item.type]}{selected ? " · đang chọn" : ""}</button>
        <button type="button" className="btn" onClick={onDelete}>Xóa</button>
      </div>
      <Field long label="Nội dung cụ thể" value={item.text} placeholder={item.type === "V" ? "Ý nghĩa với khách, không chỉ khẩu hiệu" : item.type === "B" ? "Cải thiện cụ thể khách nhận được" : "Thuộc tính, chức năng hoặc cách cung cấp quan sát được"} onChange={(value) => onChange("text", value)} />
      <div className="vl-grid">
        <Field label="Cho UC nào?" value={item.audience} placeholder="Người dùng / người mua / người quyết định" onChange={(value) => onChange("audience", value)} />
        <label className="vl-field">Trạng thái dữ kiện<select value={item.status} onChange={(event) => onChange("status", event.target.value)}>
          <option value="planned">Dự kiến / giả thuyết</option>
          <option value="internal">Đang có · khai báo nội bộ</option>
          <option value="observed">Có bằng chứng · cần đối chiếu</option>
        </select></label>
      </div>
      {item.type !== "V" && (
        <fieldset className="vl-checks">
          <legend>Nối với {next} · {NAMES[next]} (chọn nhiều)</legend>
          {candidates.length === 0 && <p>Thêm {next} trước, rồi quay lại liên kết.</p>}
          {candidates.map((candidate) => (
            <label key={candidate.id}><input type="checkbox" checked={item.links.includes(candidate.id)} onChange={(event) => onToggle(candidate.id, event.target.checked)} />{candidate.text || "(chưa đặt tên)"}</label>
          ))}
        </fieldset>
      )}
      <details>
        <summary>Điều kiện, kiểm chứng và trách nhiệm</summary>
        <Field long label="Điều kiện / giới hạn để mối liên hệ có hiệu lực" value={item.condition} onChange={(value) => onChange("condition", value)} />
        <div className="vl-grid">
          <Field long label="Nguồn bằng chứng hiện có" value={item.source} placeholder="Tên tài liệu hoặc phản hồi. Không nhập dữ liệu nhạy cảm." onChange={(value) => onChange("source", value)} />
          <Field label="Ngày của bằng chứng" type="date" value={item.date} onChange={(value) => onChange("date", value)} />
          <Field long label="Cách kiểm chứng / dữ liệu cần thu" value={item.measure} onChange={(value) => onChange("measure", value)} />
          <Field long label="Tiêu chí do doanh nghiệp đề xuất" value={item.target} placeholder="Chốt trước khi đo; không tự coi là chuẩn ngành" onChange={(value) => onChange("target", value)} />
          <Field label="Người chịu trách nhiệm" value={item.owner} onChange={(value) => onChange("owner", value)} />
          {item.type === "F" && (
            <label className="vl-field">Core / Open Rim<select value={item.control} onChange={(event) => onChange("control", event.target.value)}>
              <option value="core">Core · Phải kiểm soát</option>
              <option value="open">Open · Huy động bên ngoài</option>
            </select></label>
          )}
        </div>
      </details>
    </article>
  );
}

function Wheel({ nodes, selected, onPick, decorative = false }: { nodes: VrimNode[]; selected: string | null; onPick: (id: string) => void; decorative?: boolean }) {
  const stamp = useId().replace(/:/g, "");
  const metal = `vlm${stamp}`;
  const rim = `vlr${stamp}`;
  const spokes = Array.from({ length: 12 }, (_, index) => {
    const r = index * Math.PI / 6;
    const x = 220 + Math.sin(r) * 148;
    const y = 220 - Math.cos(r) * 148;
    return `M ${220 + Math.sin(r - 0.12) * 63} ${220 - Math.cos(r - 0.12) * 63} L ${x + Math.cos(r) * 12} ${y + Math.sin(r) * 12} L ${x - Math.cos(r) * 12} ${y - Math.sin(r) * 12} L ${220 + Math.sin(r + 0.12) * 63} ${220 - Math.cos(r + 0.12) * 63} Z`;
  });
  const picked = nodes.find((item) => item.id === selected);
  const linked = new Set<string>();
  if (picked) {
    linked.add(picked.id);
    picked.links.forEach((id) => linked.add(id));
    nodes.filter((item) => item.links.includes(picked.id)).forEach((item) => linked.add(item.id));
  }
  return (
    <svg className="vl-wheel" viewBox="0 0 440 440" role="img" aria-label="Mâm xe V-RIM minh họa cấu trúc, không biểu thị điểm chất lượng">
      <defs>
        <linearGradient id={metal} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff" /><stop offset=".4" stopColor="#c6d2d4" /><stop offset=".7" stopColor="#f7fafa" /><stop offset="1" stopColor="#889fa3" />
        </linearGradient>
        <radialGradient id={rim}><stop stopColor="#edf2ee" /><stop offset="1" stopColor="#dce5e2" /></radialGradient>
      </defs>
      <ellipse cx="220" cy="405" rx="137" ry="16" fill="#173e3520" />
      <circle cx="220" cy="220" r="196" fill="#16483f" />
      <circle cx="220" cy="220" r="187" fill={`url(#${metal})`} />
      <circle cx="220" cy="220" r="161" fill="#264f4a" />
      <circle cx="220" cy="220" r="151" fill={`url(#${rim})`} />
      {spokes.map((d) => <path key={d} d={d} fill={`url(#${metal})`} stroke="#a5b6ba" />)}
      <circle cx="220" cy="220" r="65" fill={`url(#${metal})`} stroke="#94a8a7" />
      <circle cx="220" cy="220" r="48" fill="#154c40" />
      <text x="220" y="217" textAnchor="middle" fill="white" fontSize="16" fontWeight="700">V-RIM</text>
      <text x="220" y="234" textAnchor="middle" fill="#b8d9c8" fontSize="9">MYBIZCAR</text>
      {decorative && <text x="220" y="79" fill="#16483f" fontSize="15" textAnchor="middle">V · B · F</text>}
      {nodes.map((item, index) => {
        const r = index * 2 * Math.PI / nodes.length;
        const x = 220 + Math.sin(r) * 178;
        const y = 220 - Math.cos(r) * 178;
        const fill = item.type === "V" ? "#167567" : item.type === "B" ? "#d49a36" : "#5467a6";
        const mark = nodes.filter((row) => row.type === item.type).indexOf(item) + 1;
        return (
          <g key={item.id} data-pick={item.id} tabIndex={0} role="button" aria-label={`${item.type} ${item.text}`} opacity={!selected || linked.has(item.id) ? 1 : 0.28} onClick={() => onPick(item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPick(item.id); } }}>
            <circle cx={x} cy={y} r="18" fill={fill} stroke="white" strokeWidth="3" strokeDasharray={item.status === "planned" ? "4 3" : undefined} />
            <text x={x} y={y + 5} textAnchor="middle" fill="white" fontSize="13" fontWeight="700">{item.type}{mark}</text>
          </g>
        );
      })}
    </svg>
  );
}
