"use client";

import { useState } from "react";
import { messages, type Locale } from "@/lib/i18n";
import { LocaleSwitch } from "@/components/brand/LocaleSwitch";

export function LoginForm({ locale, story, tagline }: { locale: Locale; story: string; tagline: string }) {
  const t = messages(locale);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    const payload = await response.json().catch(() => null) as { error?: string; next?: string } | null;
    setPending(false);
    if (!response.ok || !payload?.next) { setError(payload?.error || t.loginFail); return; }
    window.location.assign(payload.next);
  }

  return (
    <div className="login-wrap">
      <section className="login-story">
        <div>
          <img className="login-logo" src="/brand/vabix-logo.png" alt="VABIX" />
          <div className="eyebrow" style={{ color: "var(--gold-2)" }}>VABIX · BMDO K03</div>
          <h1 className="serif" style={{ fontSize: "clamp(40px, 5vw, 68px)", lineHeight: 1.15 }}>BizCar Learning System</h1>
          <p style={{ maxWidth: 520, color: "#d5dee2", fontSize: 18, lineHeight: 1.65 }}>{story}</p>
        </div>
        <p style={{ color: "#aab7bd" }}>{tagline}</p>
      </section>
      <section className="login-panel">
        <form className="login-card card" onSubmit={onSubmit}>
          <LocaleSwitch locale={locale} tone="paper" />
          <div className="eyebrow">{t.loginEyebrow}</div>
          <h2 className="serif" style={{ fontSize: 34, marginTop: 6 }}>{t.loginTitle}</h2>
          <p className="muted">{t.loginHint}</p>
          <div className="field"><label htmlFor="username">{t.username}</label><input id="username" name="username" autoComplete="username" required /></div>
          <div className="field"><label htmlFor="password">{t.password}</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
          {error && <p role="alert" style={{ color: "var(--red)" }}>{error}</p>}
          <button className="btn dark" type="submit" disabled={pending}>{pending ? t.checking : t.login}</button>
          <p className="muted">{t.forgot}</p>
        </form>
      </section>
    </div>
  );
}
