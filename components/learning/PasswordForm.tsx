"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { messages, type Locale } from "@/lib/i18n";

export function PasswordForm({ forced, locale = "vi" }: { forced?: boolean; locale?: Locale }) {
  const t = messages(locale);
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current: form.get("current"), next: form.get("next"), confirm: form.get("confirm") }),
    });
    const payload = await response.json() as { error?: string };
    setPending(false);
    if (!response.ok) { setError(payload.error || t.passwordFail); return; }
    router.push("/learn/dashboard");
    router.refresh();
  }

  return (
    <form className="card" onSubmit={onSubmit} style={{ maxWidth: 480 }}>
      <div className="eyebrow">{forced ? t.firstLogin : t.security}</div>
      <h1 className="serif" style={{ fontSize: 36 }}>{forced ? t.changeTemp : t.changePassword}</h1>
      {forced && <p>{t.forcedHint}</p>}
      <div className="field"><label htmlFor="current">{t.currentPassword}</label><input id="current" name="current" type="password" required autoComplete="current-password" /></div>
      <div className="field"><label htmlFor="next">{t.newPassword}</label><input id="next" name="next" type="password" required minLength={8} autoComplete="new-password" /></div>
      <div className="field"><label htmlFor="confirm">{t.confirmPassword}</label><input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" /></div>
      {error && <p role="alert" style={{ color: "var(--red)" }}>{error}</p>}
      <button className="btn dark" disabled={pending} type="submit">{pending ? t.saving : t.savePassword}</button>
    </form>
  );
}
