"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { COMPANY_FILE_BYTES, COMPANY_PROMPT_MAX, companyFileKind, type CompanyAssessment, type CompanyProfileView } from "@/convex/companyProfileAccess";
import { generateCompanyAssessment, saveCompanyProfile } from "@/lib/company-actions";
import type { Locale } from "@/lib/i18n";

type LessonCard = {
  number: number;
  code: string;
  title: string;
  framework: string;
  summary: string;
  group: string;
  href: string;
};

type Labels = {
  lesson: string;
  current: string;
  empty: string;
  file: string;
  paste: string;
  pasteHint: string;
  save: string;
  saving: string;
  updated: string;
  excerpt: string;
  truncated: string;
  fileHint: string;
  errorSize: string;
  errorType: string;
  errorEmpty: string;
  errorExtract: string;
  errorUpload: string;
  errorLong: string;
  noKey: string;
  assessTitle: string;
  assessLede: string;
  generate: string;
  regenerate: string;
  stale: string;
  working: string;
  batch: string;
  batchConfirm: string;
  batchDone: string;
  strengths: string;
  gaps: string;
  focus: string;
  openLesson: string;
  model: string;
  noText: string;
  errorLlm: string;
  errorStale: string;
  errorMissing: string;
  pasteName: string;
  chars: string;
  withPaste: string;
  promptNote: string;
  currentAll: string;
};

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / (1024 * 102.4)) / 10} MB`;
}

function stamp(iso: string, locale: Locale) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale === "en" ? "en-GB" : "vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

function PointList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="serif" style={{ fontSize: 18, margin: "14px 0 0" }}>{title}</h4>
      <ul className="summary-points">
        {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
      </ul>
    </div>
  );
}

export function CompanyProfilePanel({
  locale,
  readOnly,
  llmReady,
  profile: initialProfile,
  assessments: initialAssessments,
  lessons,
  groups,
  labels,
}: {
  locale: Locale;
  readOnly: boolean;
  llmReady: boolean;
  profile: CompanyProfileView | null;
  assessments: CompanyAssessment[];
  lessons: LessonCard[];
  groups: { id: string; label: string }[];
  labels: Labels;
}) {
  const router = useRouter();
  const profileStamp = `${initialProfile?.version ?? 0}:${initialProfile?.updatedAt ?? ""}`;
  const assessmentStamp = initialAssessments.map((row) => `${row.lessonNumber}:${row.status}:${row.updatedAt}`).join("|");
  const incoming = `${profileStamp}#${assessmentStamp}`;
  const [seen, setSeen] = useState(incoming);
  const [profile, setProfile] = useState(initialProfile);
  const [assessments, setAssessments] = useState(initialAssessments);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "save" | number>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  if (seen !== incoming) {
    setSeen(incoming);
    setProfile(initialProfile);
    setAssessments(initialAssessments);
  }
  useEffect(() => {
    if (error) alertRef.current?.scrollIntoView({ block: "nearest" });
  }, [error]);
  const byNumber = new Map(assessments.map((row) => [row.lessonNumber, row]));
  const pending = lessons.filter((lesson) => {
    const row = byNumber.get(lesson.number);
    return !row || row.status === "stale";
  });

  function saveMessage(code: "empty" | "size" | "type" | "extract" | "upload" | "long" | "missing") {
    if (code === "size") return labels.errorSize;
    if (code === "type") return labels.errorType;
    if (code === "empty") return labels.errorEmpty;
    if (code === "extract") return labels.errorExtract;
    if (code === "long") return labels.errorLong;
    return labels.errorUpload;
  }

  function assessMessage(code: "nokey" | "empty" | "llm" | "stale" | "missing" | "forbidden") {
    if (code === "nokey") return labels.noKey;
    if (code === "empty") return labels.noText;
    if (code === "stale") return labels.errorStale;
    if (code === "missing") return labels.errorMissing;
    return labels.errorLlm;
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const picked = form.elements.namedItem("file");
    const file = picked instanceof HTMLInputElement ? picked.files?.[0] : undefined;
    if (file && file.size > COMPANY_FILE_BYTES) {
      setError(labels.errorSize);
      return;
    }
    if (file && !companyFileKind(file.name)) {
      setError(labels.errorType);
      return;
    }
    if ((!file || file.size <= 0) && !paste.trim()) {
      setError(labels.errorEmpty);
      return;
    }
    setBusy("save");
    setError(null);
    setNote(null);
    const data = new FormData(form);
    try {
      const result = await saveCompanyProfile(data);
      if (!result.ok) {
        setError(saveMessage(result.error));
        return;
      }
      setProfile(result.profile);
      setAssessments((rows) => rows.map((row) => row.status === "current" ? { ...row, status: "stale" } : row));
      setPaste("");
      form.reset();
      router.refresh();
    } catch {
      setError(labels.errorUpload);
    } finally {
      setBusy(null);
    }
  }

  async function generate(numbers: number[]) {
    if (!profile) {
      setError(labels.noText);
      return;
    }
    setError(null);
    setNote(null);
    try {
      for (const lessonNumber of numbers) {
        setBusy(lessonNumber);
        const result = await generateCompanyAssessment(lessonNumber);
        if (!result.ok) {
          setError(assessMessage(result.error));
          return;
        }
        setAssessments((rows) => [...rows.filter((row) => row.lessonNumber !== lessonNumber), result.assessment]);
      }
      if (numbers.length > 1) setNote(labels.batchDone);
      router.refresh();
    } catch {
      setError(labels.errorLlm);
    } finally {
      setBusy(null);
    }
  }

  const fileName = profile ? (profile.source === "paste" ? labels.pasteName : profile.fileName) : "";

  return (
    <div>
      {error && <p ref={alertRef} className="discussion-error" role="alert">{error}</p>}
      <section className="card">
        <h2 className="serif">{labels.current}</h2>
        {profile ? (
          <>
            <p><strong>{fileName}</strong></p>
            <p className="muted">{labels.updated} {stamp(profile.updatedAt, locale)} · {formatSize(profile.size)} · {fill(labels.chars, { count: profile.textChars })}</p>
            {profile.source === "both" && <p className="muted">{labels.withPaste}</p>}
            {profile.truncated && <p className="muted">{labels.truncated}</p>}
            {profile.textChars > COMPANY_PROMPT_MAX && <p className="muted">{fill(labels.promptNote, { count: COMPANY_PROMPT_MAX })}</p>}
            <p className="eyebrow">{labels.excerpt}</p>
            <p className="company-copy">{profile.excerpt}</p>
          </>
        ) : <p className="muted">{labels.empty}</p>}
        {!readOnly && (
          <form onSubmit={(event) => void save(event)}>
            <div className="field">
              <label htmlFor="company-file">{labels.file}</label>
              <input id="company-file" name="file" type="file" accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown" disabled={busy !== null} />
              <span className="muted">{labels.fileHint}</span>
            </div>
            <div className="field">
              <label htmlFor="company-paste">{labels.paste}</label>
              <textarea id="company-paste" name="paste" value={paste} maxLength={20_000} disabled={busy !== null} onChange={(event) => setPaste(event.target.value)} />
              <span className="muted">{labels.pasteHint}</span>
            </div>
            <button className="btn dark" type="submit" disabled={busy !== null}>{busy === "save" ? labels.saving : labels.save}</button>
          </form>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 className="serif">{labels.assessTitle}</h2>
        <p className="lede">{labels.assessLede}</p>
        {!llmReady && <p className="muted">{labels.noKey}</p>}
        {!readOnly && llmReady && profile && pending.length > 0 && (
          <button
            className="btn"
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (!window.confirm(fill(labels.batchConfirm, { count: pending.length }))) return;
              void generate(pending.map((lesson) => lesson.number));
            }}
          >
            {labels.batch}
          </button>
        )}
        {!readOnly && llmReady && profile && pending.length === 0 && assessments.length > 0 && <p className="muted">{labels.currentAll}</p>}
        {note && <p className="muted">{note}</p>}
        {groups.map((group) => {
          const items = lessons.filter((lesson) => lesson.group === group.id);
          if (items.length === 0) return null;
          return (
            <div className="group" key={group.id}>
              <h2>{group.label}</h2>
              <div className="company-list">
                {items.map((lesson) => {
                  const row = byNumber.get(lesson.number);
                  return (
                    <article className="card" key={lesson.number}>
                      <div className="eyebrow">{labels.lesson} {lesson.code} · {lesson.framework}</div>
                      <h3 className="serif">{lesson.title}</h3>
                      <p className="muted">{lesson.summary}</p>
                      {row?.status === "stale" && <p className="company-stale">{labels.stale}</p>}
                      {row && (
                        <>
                          <p className="company-copy">{row.evaluation}</p>
                          <PointList title={labels.strengths} items={row.strengths} />
                          <PointList title={labels.gaps} items={row.gaps} />
                          <PointList title={labels.focus} items={row.focus} />
                          <p className="muted">{fill(labels.model, { model: row.model, version: row.promptVersion })} · {stamp(row.updatedAt, locale)}</p>
                        </>
                      )}
                      <div className="row-actions">
                        {!readOnly && (
                          <button className="btn dark" type="button" disabled={busy !== null || !llmReady || !profile} onClick={() => void generate([lesson.number])}>
                            {busy === lesson.number ? labels.working : row ? labels.regenerate : labels.generate}
                          </button>
                        )}
                        <Link className="btn" href={lesson.href}>{labels.openLesson}</Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
