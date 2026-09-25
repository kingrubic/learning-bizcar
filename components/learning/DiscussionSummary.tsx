"use client";

import { useState } from "react";
import Link from "next/link";
import { draftFromMessages } from "@/convex/discussionAccess";
import { saveDiscussionSummary } from "@/lib/discussion-actions";

type RecentLine = { authorName: string; body: string; fileCount: number };

export function DiscussionSummaryEditor({
  channelId,
  title,
  points,
  conclusion,
  notes,
  recent,
  labels,
}: {
  channelId: number;
  title: string;
  points: string;
  conclusion: string;
  notes: string;
  recent: RecentLine[];
  labels: {
    title: string;
    points: string;
    conclusion: string;
    notes: string;
    save: string;
    suggest: string;
    draftHint: string;
    noDraft: string;
    fileLine: string;
  };
}) {
  const [draft, setDraft] = useState({ title, points, conclusion, notes });
  const [hint, setHint] = useState("");
  function suggest() {
    const next = draftFromMessages(recent, (count) => labels.fileLine.replace("{count}", String(count)));
    if (!next) {
      setHint(labels.noDraft);
      return;
    }
    setDraft((current) => ({ ...current, points: next }));
    setHint(labels.draftHint);
  }
  function set(key: "title" | "points" | "conclusion" | "notes", value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  return (
    <form action={saveDiscussionSummary}>
      <input type="hidden" name="channelId" value={channelId} />
      <label className="field">
        <span>{labels.title}</span>
        <input name="title" value={draft.title} onChange={(event) => set("title", event.target.value)} maxLength={120} />
      </label>
      <label className="field">
        <span>{labels.points}</span>
        <textarea name="points" value={draft.points} onChange={(event) => set("points", event.target.value)} rows={8} />
      </label>
      <label className="field">
        <span>{labels.conclusion}</span>
        <textarea name="conclusion" value={draft.conclusion} onChange={(event) => set("conclusion", event.target.value)} rows={4} />
      </label>
      <label className="field">
        <span>{labels.notes}</span>
        <textarea name="notes" value={draft.notes} onChange={(event) => set("notes", event.target.value)} rows={3} />
      </label>
      <div className="row-actions">
        <button className="btn" type="button" onClick={suggest}>{labels.suggest}</button>
        <button className="btn gold" type="submit">{labels.save}</button>
      </div>
      {hint ? <p className="muted">{hint}</p> : null}
    </form>
  );
}

export function PresentFrame({
  exitHref,
  exit,
  notes,
  notesLabel,
  showNotes,
  hideNotes,
  children,
}: {
  exitHref: string;
  exit: string;
  notes: string;
  notesLabel: string;
  showNotes: string;
  hideNotes: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <main className="present-screen">
      <div className="present-bar">
        <Link className="btn dark" href={exitHref}>{exit}</Link>
        {notes ? <button className="btn" type="button" onClick={() => setOpen((value) => !value)}>{open ? hideNotes : showNotes}</button> : <span />}
      </div>
      {children}
      {open && notes ? (
        <aside className="present-notes">
          <div className="eyebrow">{notesLabel}</div>
          <p>{notes}</p>
        </aside>
      ) : null}
    </main>
  );
}
