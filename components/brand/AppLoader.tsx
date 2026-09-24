"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const MAIN = new Set(["/learn/login", "/learn/dashboard", "/learn/course/bmdo-k03", "/admin/learning"]);

function isMain(pathname: string) {
  return MAIN.has(pathname);
}

function destination(href: string) {
  try {
    return new URL(href, window.location.origin).pathname;
  } catch {
    return "";
  }
}

export function AppLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(() => isMain(pathname));
  const [pct, setPct] = useState(0);
  const value = useRef(0);
  const timer = useRef<number | null>(null);
  const seen = useRef<string | null>(null);

  function clearTimer() {
    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = null;
  }

  function climb() {
    clearTimer();
    timer.current = window.setInterval(() => {
      const step = Math.max(0.6, (92 - value.current) * 0.08);
      value.current = Math.min(92, value.current + step);
      setPct(Math.round(value.current));
    }, 70);
  }

  function begin() {
    value.current = 6;
    setPct(6);
    setVisible(true);
    climb();
  }

  function finish() {
    clearTimer();
    value.current = 100;
    setPct(100);
    window.setTimeout(() => setVisible(false), 340);
  }

  useEffect(() => {
    if (seen.current === null) {
      seen.current = pathname;
      if (!isMain(pathname)) {
        setVisible(false);
        return;
      }
      begin();
      const done = window.setTimeout(finish, 900);
      return () => window.clearTimeout(done);
    }
    if (seen.current === pathname) return;
    seen.current = pathname;
    if (!isMain(pathname)) {
      clearTimer();
      setVisible(false);
      return;
    }
    const done = window.setTimeout(finish, 280);
    return () => window.clearTimeout(done);
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (/^https?:/i.test(href) && !href.startsWith(window.location.origin)) return;
      const next = destination(href);
      if (!isMain(next) || next === pathname) return;
      begin();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  useEffect(() => clearTimer, []);

  if (!visible) return null;

  return (
    <div className="boot" role="status" aria-live="polite" aria-label="Đang mở trang">
      <div className="boot-glow" />
      <img src="/brand/vabix-logo.png" alt="" width={168} height={168} className="boot-mark" />
      <p className="boot-kicker">VABIX</p>
      <p className="boot-name">BizCar Learning</p>
      <div className="boot-track" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="boot-pct">{pct}%</p>
    </div>
  );
}
