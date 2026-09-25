"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DISCUSSION_FILE_BYTES, DISCUSSION_FILE_MAX } from "@/convex/discussionAccess";
import { discardDiscussionUploads, postDiscussionMessage, uploadDiscussionFile } from "@/lib/discussion-actions";
import type { Id } from "@/convex/_generated/dataModel";

export function DiscussionLive({ label }: { label: string }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15000);
    return () => clearInterval(id);
  }, [router]);
  return <button className="btn" type="button" onClick={() => router.refresh()}>{label}</button>;
}

export function DiscussionThread({ children, tail }: { children: React.ReactNode; tail: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || !stick.current) return;
    el.scrollTop = el.scrollHeight;
  }, [tail]);
  return (
    <div
      ref={ref}
      className="discussion-thread"
      onScroll={(event) => {
        const el = event.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
    >
      {children}
    </div>
  );
}

export function DiscussionComposer({
  channelId,
  placeholder,
  send,
  pendingLabel,
  attach,
  hint,
  remove,
  errors,
}: {
  channelId: number;
  placeholder: string;
  send: string;
  pendingLabel: string;
  attach: string;
  hint: string;
  remove: string;
  errors: { empty: string; size: string; files: string; upload: string };
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = [...(event.target.files ?? [])];
    event.target.value = "";
    if (picked.some((file) => file.size > DISCUSSION_FILE_BYTES)) {
      setError(errors.size);
      return;
    }
    if (picked.some((file) => file.size <= 0)) {
      setError(errors.upload);
      return;
    }
    const next = [...files, ...picked];
    if (next.length > DISCUSSION_FILE_MAX) {
      setError(errors.files);
      setFiles(next.slice(0, DISCUSSION_FILE_MAX));
      return;
    }
    setError(null);
    setFiles(next);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text && files.length === 0) {
      setError(errors.empty);
      return;
    }
    setPending(true);
    setError(null);
    const uploaded: { storageId: Id<"_storage">; fileName: string; contentType: string }[] = [];
    try {
      for (const file of files) {
        const data = new FormData();
        data.set("channelId", String(channelId));
        data.set("file", file);
        const result = await uploadDiscussionFile(data);
        if ("error" in result) {
          if (uploaded.length) await discardDiscussionUploads(uploaded.map((item) => item.storageId));
          setError(result.error === "size" ? errors.size : result.error === "empty" ? errors.empty : errors.upload);
          return;
        }
        uploaded.push(result);
      }
      const postData = new FormData();
      postData.set("channelId", String(channelId));
      postData.set("body", body);
      postData.set("attachments", JSON.stringify(uploaded));
      await postDiscussionMessage(postData);
    } catch (error) {
      const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: string }).digest) : "";
      if (digest.startsWith("NEXT_REDIRECT")) throw error;
      if (uploaded.length) await discardDiscussionUploads(uploaded.map((item) => item.storageId));
      setError(errors.upload);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <div className="field">
        <label htmlFor={`message-${channelId}`} className="sr-only">{placeholder}</label>
        <textarea
          id={`message-${channelId}`}
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={placeholder}
          maxLength={2000}
        />
      </div>
      {files.length > 0 && (
        <ul className="discussion-picks">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${index}`}>
              <span>{file.name}</span>
              <button type="button" className="btn" onClick={() => setFiles(files.filter((_, item) => item !== index))}>{remove}</button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="discussion-error">{error}</p>}
      <div className="row-actions">
        <input ref={inputRef} type="file" multiple hidden onChange={pick} />
        <button className="btn" type="button" onClick={() => inputRef.current?.click()} disabled={pending}>{attach}</button>
        <button className="btn gold" type="submit" disabled={pending}>{pending ? pendingLabel : send}</button>
      </div>
      <p className="muted">{hint}</p>
    </form>
  );
}
