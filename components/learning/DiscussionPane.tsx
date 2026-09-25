"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

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

function SendButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <button className="btn gold" type="submit" disabled={pending}>{pending ? pendingLabel : label}</button>;
}

export function DiscussionComposer({
  channelId,
  placeholder,
  send,
  pendingLabel,
  action,
}: {
  channelId: number;
  placeholder: string;
  send: string;
  pendingLabel: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  return (
    <form action={action}>
      <input type="hidden" name="channelId" value={channelId} />
      <div className="field">
        <label htmlFor={`message-${channelId}`} className="sr-only">{placeholder}</label>
        <textarea
          id={`message-${channelId}`}
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={placeholder}
          maxLength={2000}
          required
        />
      </div>
      <SendButton label={send} pendingLabel={pendingLabel} />
    </form>
  );
}
