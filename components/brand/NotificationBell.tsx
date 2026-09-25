"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { loadNotifications, markNotificationsRead } from "@/lib/notification-actions";

type Feed = Awaited<ReturnType<typeof loadNotifications>>;

export function NotificationBell({
  initial,
  locale,
  labels,
}: {
  initial?: Feed;
  locale: Locale;
  labels: {
    label: string;
    empty: string;
    posted: string;
    files: string;
    classChannel: string;
  };
}) {
  const [feed, setFeed] = useState<Feed>(initial ?? { unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initial) setFeed(initial);
  }, [initial]);

  useEffect(() => {
    let stop = false;
    async function pull() {
      const next = await loadNotifications();
      if (!stop) setFeed(next);
    }
    if (!initial) void pull();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void pull();
    }, 20000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [initial]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setBox({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) });
    setOpen(true);
    if (feed.unread > 0) {
      setFeed((current) => ({ unread: 0, items: current.items.map((item) => ({ ...item, read: true })) }));
      await markNotificationsRead();
    }
  }

  const count = feed.unread > 99 ? "99+" : String(feed.unread);
  return (
    <div className="bell">
      <button
        ref={buttonRef}
        type="button"
        className="bell-button"
        aria-label={feed.unread > 0 ? `${labels.label} (${count})` : labels.label}
        aria-expanded={open}
        onClick={() => void toggle()}
      >
        <BellIcon />
        {feed.unread > 0 && <span className="bell-badge" aria-hidden="true">{count}</span>}
      </button>
      {open && box && (
        <div ref={panelRef} className="bell-panel" style={{ top: box.top, right: box.right }} role="dialog" aria-label={labels.label}>
          <p className="bell-title">{labels.label}</p>
          {feed.items.length === 0 && <p className="muted">{labels.empty}</p>}
          <ul>
            {feed.items.map((item) => {
              const channel = item.channelKind === "class" ? labels.classChannel : item.channelName;
              const title = labels.posted.replace("{author}", item.authorName).replace("{channel}", channel);
              const when = new Date(item.createdAt).toLocaleString(locale === "en" ? "en-GB" : "vi-VN", { dateStyle: "medium", timeStyle: "short" });
              return (
                <li key={item.id}>
                  <Link href={item.href} onClick={() => setOpen(false)}>
                    <strong>{title}</strong>
                    {item.snippet ? <span>{item.snippet}</span> : null}
                    {item.fileCount > 0 && <span className="muted">{labels.files.replace("{count}", String(item.fileCount))}</span>}
                    <time className="muted">{when}</time>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path fill="currentColor" d="M12 2.8a1.2 1.2 0 0 1 1.2 1.2v.5a6 6 0 0 1 4.8 5.9v2.3c0 .7.3 1.4.8 1.9l.7.7a1.2 1.2 0 0 1-.8 2H5.3a1.2 1.2 0 0 1-.8-2l.7-.7c.5-.5.8-1.2.8-1.9V10.4a6 6 0 0 1 4.8-5.9v-.5A1.2 1.2 0 0 1 12 2.8Zm0 18.4a2.4 2.4 0 0 0 2.3-1.8H9.7A2.4 2.4 0 0 0 12 21.2Z" />
    </svg>
  );
}
