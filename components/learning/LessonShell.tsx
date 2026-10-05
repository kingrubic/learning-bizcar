"use client";

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LESSONS, type LessonMeta, type PhaseId } from "@/lib/course";
import type { Copy } from "@/lib/i18n";

/**
 * Standard BMDO-K03 lesson shell: one header for every lesson (session, wheel group, 7 APPLIER steps,
 * progress) and one toolbar (lesson tools, «Xuất JSON», «In / PDF»). Lesson bodies keep their own content
 * and handlers; they only hand their tools to the header through <LessonTools>.
 */

type ToolsSlot = { slot: HTMLElement | null; exportLabel: string; printLabel: string };

export const LessonToolsContext = createContext<ToolsSlot | null>(null);

/** The seven APPLIER steps, in order (Overview and Report sit around them). */
export const APPLIER_STEPS: PhaseId[] = ["activate", "paradigm", "practice", "lens", "improve", "extract", "resolve"];

export function LessonTools({ onExport, onPrint, children, fallback }: {
  onExport: () => void;
  onPrint: () => void;
  /** Lesson-specific tools shown before the standard ones (e.g. «Xem bài mẫu», «Nhập JSON»). */
  children?: ReactNode;
  /** Rendered in place when the lesson is not inside the standard shell (other courses). */
  fallback?: ReactNode;
}) {
  const shell = useContext(LessonToolsContext);
  if (!shell) return <>{fallback ?? null}</>;
  if (!shell.slot) return null;
  return createPortal(
    <>
      {children}
      <button type="button" className="btn" data-tool="export" onClick={onExport}>{shell.exportLabel}</button>
      <button type="button" className="btn" data-tool="print" onClick={onPrint}>{shell.printLabel}</button>
    </>,
    shell.slot,
  );
}

type LessonLink = { number: number; code: string; title: string; framework: string; unlocked: boolean };

export function LessonHeader({ lesson, lessons, courseSlug, phases, phase, done, progress, onGo, t, toolsRef }: {
  lesson: LessonMeta;
  lessons: LessonLink[];
  courseSlug: string;
  phases: { id: PhaseId; letter: string }[];
  phase: PhaseId;
  done: string[];
  progress: number;
  onGo: (phase: PhaseId) => void;
  t: Copy;
  toolsRef: (element: HTMLDivElement | null) => void;
}) {
  const group = t.group[lesson.group as keyof Copy["group"]] ?? lesson.group;
  const siblings = LESSONS.filter((row) => row.group === lesson.group);
  const stepIndex = APPLIER_STEPS.indexOf(phase);
  const where = stepIndex >= 0 ? `${t.shellStep} ${stepIndex + 1}/${APPLIER_STEPS.length} · ${t.phases[phase]}` : t.phases[phase];
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <section className="lesson-head" aria-label={`${t.shellSession} ${lesson.code}`} data-lesson-shell={lesson.code}>
      <div className="lh-row">
        <div className="lh-id">
          <p className="lh-kicker">{t.shellSession} {lesson.code} · {group}</p>
          <p className="lh-title">{lesson.title} <span>· {lesson.framework}</span></p>
        </div>
        <div className="lh-tools no-print" role="toolbar" aria-label={t.shellTools} ref={toolsRef} />
      </div>
      {siblings.length > 1 && (
        <nav className="lh-wheel no-print" aria-label={t.shellWheel}>
          <span className="lh-wheel-name">{group}</span>
          {siblings.map((row) => {
            const link = lessons.find((item) => item.number === row.number);
            const label = <><b>{row.code}</b> {row.title} · {row.framework}</>;
            if (row.number === lesson.number) return <span key={row.number} className="lh-chip on" aria-current="page">{label}</span>;
            return link?.unlocked
              ? <Link key={row.number} className="lh-chip" href={`/learn/course/${courseSlug}/lesson/${row.code}`}>{label}</Link>
              : <span key={row.number} className="lh-chip locked">{label}</span>;
          })}
        </nav>
      )}
      <ol className="lh-steps no-print" aria-label={t.phaseNav}>
        {phases.map((item) => {
          const state = item.id === phase ? "current" : done.includes(item.id) ? "done" : "todo";
          const number = APPLIER_STEPS.indexOf(item.id);
          return (
            <li key={item.id}>
              <button type="button" className={`lh-step ${state}`} onClick={() => onGo(item.id)} aria-current={item.id === phase ? "step" : undefined}>
                <span className="lh-letter">{number >= 0 ? item.letter : item.id === "report" ? "✎" : "●"}</span>
                <span className="lh-label">{t.phases[item.id]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="lh-progress">
        <span>{where}</span>
        <div className="lh-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t.progress}><div style={{ width: `${pct}%` }} /></div>
        <b>{pct}%</b>
      </div>
    </section>
  );
}
