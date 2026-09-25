"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { phasesFor, type LessonMeta, type PhaseId } from "@/lib/course";
import { LessonStage, type SaveState } from "./LessonStage";
import { BrandMark } from "@/components/brand/BrandMark";
import { LocaleSwitch } from "@/components/brand/LocaleSwitch";
import { NotificationBell } from "@/components/brand/NotificationBell";
import { messages, type Locale } from "@/lib/i18n";

type LessonLink = { number: number; code: string; title: string; framework: string; status: string; unlocked: boolean };

export function LessonExperience({
  lesson,
  lessons,
  source,
  initialAnswers,
  initialPhase,
  initialDone,
  initialProgress,
  userId,
  serverUpdatedAt,
  reviewEnabled,
  status,
  locale,
  courseSlug,
  courseCode,
}: {
  lesson: LessonMeta;
  lessons: LessonLink[];
  source: { css: string; html: string; script: string };
  initialAnswers: Record<string, unknown>;
  initialPhase: string;
  initialDone: string[];
  initialProgress: number;
  userId: number;
  serverUpdatedAt: string | null;
  reviewEnabled: boolean;
  status: string;
  locale: Locale;
  courseSlug: string;
  courseCode: string;
}) {
  const t = messages(locale);
  const router = useRouter();
  const phases = phasesFor(lesson);
  const [phase, setPhase] = useState<PhaseId>((initialPhase as PhaseId) || "overview");
  const [done, setDone] = useState<string[]>(initialDone);
  const [progress, setProgress] = useState(initialProgress);
  const [save, setSave] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState("");
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState("");

  function go(next: PhaseId) {
    setPhase(next);
    if (typeof window.__bizcarShow === "function") window.__bizcarShow(next);
    else if (typeof window.show === "function") window.show(next);
    setMenu(false);
  }

  async function post(url: string) {
    setBusy(url);
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonNumber: lesson.number }) });
    setBusy("");
    if (response.ok) router.refresh();
  }

  const saveLabel = save === "saving" ? t.savingNow
    : save === "saved" ? `${t.savedAt} ${savedAt}`
    : save === "offline" ? t.offline
    : save === "preview" ? t.preview
    : t.synced;

  return (
    <div className={`shell ${menu ? "menu-open" : ""}`}>
      <button className="backdrop" type="button" aria-label="Đóng menu" onClick={() => setMenu(false)} />
      <aside className="shell-side">
        <Link href="/learn/dashboard" className="brand">
          <BrandMark />
          <span><strong>VABIX</strong><small>BizCar Learning</small></span>
        </Link>
        <p className="side-kicker">{lesson.code} · {lesson.framework}</p>
        <nav className="phase-nav" aria-label={t.phaseNav}>
          {phases.map((item) => {
            const state = item.id === phase ? "current" : done.includes(item.id) ? "done" : "todo";
            return (
              <button key={item.id} type="button" className={`phase-link ${state}`} onClick={() => go(item.id)} aria-current={item.id === phase ? "step" : undefined}>
                <span className="letter">{item.letter}</span>
                <span>{t.phases[item.id]}</span>
                <span className="status-dot" data-state={state} />
              </button>
            );
          })}
        </nav>
        <div className="side-progress">
          <div className="p-label"><span>{t.progress}</span><b>{progress}%</b></div>
          <div className="p-track"><div style={{ width: `${progress}%` }} /></div>
        </div>
        <p className="side-kicker">{t.lessonList}</p>
        <nav className="lesson-nav" aria-label={t.lessonList}>
          {lessons.map((item) => (
            item.unlocked ? (
              <Link key={item.number} href={`/learn/course/${courseSlug}/lesson/${item.code}`} className={item.number === lesson.number ? "active" : ""}>
                <span>{item.code}</span> {item.framework}
              </Link>
            ) : (
              <span key={item.number} className="locked">{item.code} · {t.locked}</span>
            )
          ))}
        </nav>
      </aside>
      <div className="shell-main">
        <header className="shell-top">
          <div className="crumb">
            <button type="button" className="btn menu-btn" onClick={() => setMenu(true)} aria-label={t.openNav}>☰</button>
            <Link href={`/learn/course/${courseSlug}`}>{courseCode}</Link>
            <span>/</span>
            <b>{t.lesson} {lesson.code} · {t.phases[phase]}</b>
          </div>
          <div className="top-meta">
            <span className={`save-pill ${save}`}>{saveLabel}</span>
            <span className="save-pill">{labelStatus(status, locale)}</span>
            <button type="button" className="btn" disabled={busy !== ""} onClick={() => post("/api/learn/complete")}>{busy ? t.writing : t.complete}</button>
            {reviewEnabled && <button type="button" className="btn dark" disabled={busy !== ""} onClick={() => post("/api/learn/submit")}>{t.submit}</button>}
            <NotificationBell
              locale={locale}
              labels={{
                label: t.notificationsLabel,
                empty: t.notificationsEmpty,
                posted: t.notificationPosted,
                files: t.notificationFiles,
                classChannel: t.discussionClass,
              }}
            />
            <LocaleSwitch locale={locale} />
            <button type="button" className="btn" onClick={() => window.print()}>{t.print}</button>
          </div>
        </header>
        <div className="phase-scroll" aria-label="Pha học tập">
          {phases.map((item) => (
            <button key={item.id} type="button" className={item.id === phase ? "on" : done.includes(item.id) ? "did" : ""} onClick={() => go(item.id)}>
              {t.phases[item.id]}
            </button>
          ))}
        </div>
        <div className="shell-content">
          <LessonStage
            lessonNumber={lesson.number}
            storageKey={lesson.storageKey}
            css={source.css}
            html={source.html}
            script={source.script}
            initialAnswers={initialAnswers}
            initialPhase={initialPhase}
            userId={userId}
            serverUpdatedAt={serverUpdatedAt}
            onPhase={(next, phasesDone, percent) => { setPhase(next); setDone(phasesDone); setProgress(percent); }}
            onSaveState={(state, at) => { setSave(state); if (at) setSavedAt(at); }}
            sampleLabel={t.sample}
          />
        </div>
      </div>
    </div>
  );
}

function labelStatus(status: string, locale: Locale) {
  const t = messages(locale);
  if (status in t.status) return t.status[status as keyof typeof t.status];
  return t.status.not_started;
}
