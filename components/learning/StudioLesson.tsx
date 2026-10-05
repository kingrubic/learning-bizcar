"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PhaseId } from "@/lib/course";
import type { SaveState } from "./LessonStage";
import { mountStudio, type StudioHost } from "@/lib/studios/host";
import { STUDIO_STEPS, emptyEnvelope, isEnvelope, studioProgress, type StudioConfig, type StudioEnvelope } from "@/lib/studios/registry";
import { studioDocError, validateEnvelope } from "@/lib/studios/validate";
import { legacyRows } from "@/lib/studios/legacy";
import type { StudioSource } from "@/lib/studios/source";
import "./studio-lesson.css";

type Props = {
  config: StudioConfig;
  source: StudioSource;
  /** New-version record (config.answerKey). The only record this component writes. */
  initialAnswers: Record<string, unknown>;
  /** Old record (config.oldKey). Read-only. */
  legacyAnswers: unknown;
  initialPhase: string;
  userId: number;
  serverUpdatedAt: string | null;
  courseSlug: string;
  lessonNumber: number;
  hasReport: boolean;
  onPhase: (phase: PhaseId, done: PhaseId[], progress: number) => void;
  onSaveState: (state: SaveState, savedAt?: string) => void;
};

function cacheKey(userId: number, answerKey: string) {
  return `vabix-cache:${userId}:${answerKey}`;
}

/** Server copy, unless it cannot be read: then it is kept aside (`broken`) and never overwritten. */
function openEnvelope(config: StudioConfig, saved: unknown): { envelope: StudioEnvelope; broken: unknown } {
  const hasSaved = saved && typeof saved === "object" && Object.keys(saved).length > 0;
  if (!hasSaved) return { envelope: emptyEnvelope(config.id), broken: null };
  try {
    return { envelope: validateEnvelope(config, saved), broken: null };
  } catch {
    return { envelope: emptyEnvelope(config.id), broken: saved };
  }
}

function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StudioLesson(props: Props) {
  const { config } = props;
  const [opened] = useState(() => openEnvelope(config, props.initialAnswers));
  const broken = useRef(opened.broken);
  const envelope = useRef<StudioEnvelope>(opened.envelope);
  const startPhase = (["overview", ...STUDIO_STEPS, "report"] as string[]).includes(props.initialPhase) ? props.initialPhase as PhaseId : "overview";
  const [phase, setPhase] = useState<PhaseId>(startPhase === "report" && !props.hasReport ? "overview" : startPhase);
  const phaseRef = useRef(phase);
  const [actions, setActions] = useState<{ index: number; label: string }[]>([]);
  const [toast, setToast] = useState("");
  const [outline, setOutline] = useState(opened.envelope.outline);
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<StudioHost | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const saveTail = useRef(Promise.resolve());
  const legacy = useMemo(() => legacyRows(props.lessonNumber, props.legacyAnswers), [props.lessonNumber, props.legacyAnswers]);

  function ping(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 6000);
  }

  function report() {
    const reading = studioProgress(config, envelope.current);
    propsRef.current.onPhase(phaseRef.current, reading.done, reading.progress);
  }

  function writeCache(next: StudioEnvelope, isDirty: boolean, updatedAt = new Date().toISOString()) {
    try {
      window.localStorage.setItem(cacheKey(propsRef.current.userId, config.answerKey), JSON.stringify({ dirty: isDirty, updatedAt, answers: next }));
    } catch { /* storage full: the server copy still saves */ }
  }

  function schedule() {
    if (broken.current) {
      propsRef.current.onSaveState("offline");
      return;
    }
    dirty.current = true;
    propsRef.current.onSaveState("saving");
    writeCache(envelope.current, true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flush(); }, 700);
  }

  function flush() {
    const run = saveTail.current.then(writeSave);
    saveTail.current = run.then(() => undefined, () => undefined);
    return run;
  }

  async function writeSave() {
    if (!dirty.current || broken.current) return;
    const current = propsRef.current;
    const payload: StudioEnvelope = { ...envelope.current, outline: envelope.current.doc ? config.summary(envelope.current.doc) : "" };
    try {
      validateEnvelope(config, payload);
    } catch (error) {
      writeCache(payload, true);
      current.onSaveState("offline");
      ping(`Chưa lưu lên máy chủ: ${error instanceof Error ? error.message : "dữ liệu chưa hợp lệ"}. Bài vẫn giữ trên thiết bị này.`);
      return;
    }
    dirty.current = false;
    const reading = studioProgress(config, payload);
    try {
      const response = await fetch("/api/learn/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonNumber: current.lessonNumber,
          courseSlug: current.courseSlug,
          answers: payload,
          phase: phaseRef.current,
          phasesDone: reading.done,
          progressPercent: reading.progress,
        }),
      });
      if (!response.ok) throw new Error("save failed");
      const body = await response.json() as { updatedAt?: string };
      setOutline(payload.outline);
      if (!dirty.current) {
        writeCache(payload, false, body.updatedAt);
        current.onSaveState("saved", new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
      } else {
        void flush();
      }
    } catch {
      dirty.current = true;
      writeCache(payload, true);
      current.onSaveState("offline");
    }
  }

  function markVisited(next: PhaseId) {
    if (envelope.current.visited.includes(next)) return false;
    envelope.current = { ...envelope.current, visited: [...envelope.current.visited, next] };
    return true;
  }

  function show(next: PhaseId) {
    const target = next === "report" && !propsRef.current.hasReport ? "overview" : next;
    phaseRef.current = target;
    setPhase(target);
    const index = STUDIO_STEPS.indexOf(target);
    if (index >= 0 && hostRef.current && hostRef.current.step() !== index) hostRef.current.go(index);
    const added = markVisited(target);
    report();
    if (added) schedule();
  }

  // Mount the original studio once.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let start = envelope.current;
    // A newer unsaved copy on this device (e.g. offline edits) wins if it is still valid.
    try {
      const cached = JSON.parse(window.localStorage.getItem(cacheKey(props.userId, config.answerKey)) ?? "null") as { dirty?: boolean; updatedAt?: string; answers?: unknown } | null;
      const serverTime = props.serverUpdatedAt ? Date.parse(props.serverUpdatedAt) : 0;
      if (!broken.current && cached?.dirty && cached.updatedAt && Date.parse(cached.updatedAt) > serverTime && isEnvelope(cached.answers, config.id)) {
        start = validateEnvelope(config, cached.answers);
        envelope.current = start;
        dirty.current = true;
      }
    } catch { /* keep the server copy */ }
    const host = mountStudio({
      root,
      config,
      css: props.source.css,
      html: props.source.html,
      script: props.source.script,
      initialRaw: start.doc ? JSON.stringify(start.doc) : null,
      onSave: (raw) => {
        let doc: unknown;
        try { doc = JSON.parse(raw); } catch { doc = null; }
        const error = doc && typeof doc === "object" ? studioDocError(config, doc) : "Dữ liệu không đọc được.";
        if (error) {
          // Keep it on the device; never send a document the studio itself would refuse.
          writeCache({ ...envelope.current, doc: doc as Record<string, unknown> }, true);
          propsRef.current.onSaveState("offline");
          ping(`Chưa lưu lên máy chủ: ${error}. Bài vẫn giữ trên thiết bị này.`);
          return;
        }
        envelope.current = { ...envelope.current, doc: doc as Record<string, unknown> };
        report();
        schedule();
      },
      onStep: (index) => {
        const next = STUDIO_STEPS[index];
        if (!next || STUDIO_STEPS.indexOf(phaseRef.current) === index) return;
        if (phaseRef.current === "overview" || phaseRef.current === "report") return;
        phaseRef.current = next;
        setPhase(next);
        const added = markVisited(next);
        report();
        if (added) schedule();
      },
      onError: (message) => ping(`Studio gặp lỗi khi mở: ${message}`),
    });
    hostRef.current = host;
    setActions(host.actions());
    const index = STUDIO_STEPS.indexOf(phaseRef.current);
    if (index >= 0) host.go(index);
    window.__bizcarShow = (id: string) => show(id as PhaseId);
    report();
    if (dirty.current) schedule();
    return () => {
      delete window.__bizcarShow;
      window.clearTimeout(timer.current);
      if (dirty.current) void flush();
      host.destroy();
      hostRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id]);

  const inStudio = STUDIO_STEPS.includes(phase);
  const code = String(config.lesson).padStart(2, "0");

  return (
    <div className="studio-lesson">
      {opened.broken != null && (
        <div className="sample-banner no-print" role="alert">
          <div>
            <strong>Chưa mở được bài làm đã lưu trên máy chủ</strong>
            <span>Để không mất dữ liệu, tự động lưu đang tắt và bản lưu được giữ nguyên. Tải bản lưu gốc và gửi giảng viên hoặc bộ phận kỹ thuật.</span>
          </div>
          <div className="row-actions">
            <button type="button" className="btn gold" onClick={() => download(`MyBizCar-${config.title}-ban-luu.json`, broken.current)}>Tải bản lưu gốc</button>
          </div>
        </div>
      )}
      {toast && <div className="studio-toast no-print" role="status">{toast}</div>}

      {phase === "overview" && (
        <section className="studio-panel">
          <div className="studio-kicker">Buổi {code} · {config.title} / {config.framework} · APPLIER</div>
          <h1>{config.title} Studio</h1>
          {config.intro.map((item) => <p key={item.slice(0, 32)} className="studio-lead">{item}</p>)}
          <ol className="studio-steps">
            {["Activate · Cùng khởi động", "Paradigm · Mô thức thực chiến", "Practise · Thực hành thiết kế", "Lens · Lăng kính học viên", "Improve · Cải tiến MyBizCar", "Extract · Rút ra bài học mang theo", "Resolve · Cam kết hành động"].map((item, index) => (
              <li key={item}><button type="button" onClick={() => show(STUDIO_STEPS[index])}>{item}</button></li>
            ))}
          </ol>
          <div className="studio-note">
            <strong>Lưu bài.</strong> Bài làm tự động lưu vào tài khoản, đồng bộ giữa các thiết bị; giảng viên xem được như các buổi khác. «Xuất JSON» vẫn dùng để mang hồ sơ sang studio khác hoặc lưu dự phòng.
            {config.imports && <> Có thể nhập tay {config.imports}; không đồng bộ tự động.</>}
          </div>
          <button type="button" className="btn gold" onClick={() => show("activate")}>Bắt đầu · Activate</button>
          {legacy.length > 0 && (
            <details className="studio-legacy">
              <summary>Bài làm phiên bản cũ</summary>
              <p className="studio-lead">Chỉ để xem. Bản studio mới lưu riêng và bắt đầu trống. Bài cũ vẫn nằm nguyên trong hồ sơ, không bị sửa hay xóa.</p>
              {legacy.map((row, index) => <p key={`${index}:${row.label}`}><strong>{row.label}.</strong> {row.value}</p>)}
            </details>
          )}
        </section>
      )}

      {phase === "report" && (
        <section className="studio-panel">
          <div className="studio-kicker">Buổi {code} · Báo cáo</div>
          <h1>Báo cáo {config.title} / {config.framework}</h1>
          <p className="studio-lead">Báo cáo được nộp từ bài làm bản studio. Khi hoàn thiện, bấm «Nộp bài» trên thanh bài học để gửi giảng viên chấm và phản hồi. Sau khi nộp, bạn vẫn sửa tiếp được; bản đã nộp được giữ nguyên.</p>
          <pre className="studio-outline">{outline || "Chưa có nội dung. Hoàn thành các bước APPLIER trước."}</pre>
          <div className="row-actions">
            {actions.slice(2).map((action) => (
              <button key={action.index} type="button" className="btn" onClick={() => { show("resolve"); window.setTimeout(() => hostRef.current?.runAction(action.index), 0); }}>{action.label}</button>
            ))}
            {actions[0] && <button type="button" className="btn" onClick={() => hostRef.current?.runAction(actions[0].index)}>{actions[0].label}</button>}
          </div>
        </section>
      )}

      <div className="lesson-tools studio-tools no-print" hidden={!inStudio}>
        {actions.map((action) => (
          <button key={action.index} type="button" className="btn" onClick={() => hostRef.current?.runAction(action.index)}>{action.label}</button>
        ))}
      </div>
      <div ref={rootRef} className="bmdo-studio" hidden={!inStudio} />
    </div>
  );
}
