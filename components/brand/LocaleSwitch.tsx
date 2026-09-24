"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

export function LocaleSwitch({ locale, tone = "header" }: { locale: Locale; tone?: "header" | "paper" }) {
  const router = useRouter();

  async function choose(next: Locale) {
    if (next === locale) return;
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    router.refresh();
  }

  return (
    <div className={`lang-switch${tone === "paper" ? " on-paper" : ""}`} role="group" aria-label={locale === "vi" ? "Ngôn ngữ" : "Language"}>
      <button type="button" className={locale === "vi" ? "on" : ""} onClick={() => choose("vi")} aria-pressed={locale === "vi"}>
        <FlagVI /> VI
      </button>
      <button type="button" className={locale === "en" ? "on" : ""} onClick={() => choose("en")} aria-pressed={locale === "en"}>
        <FlagEN /> EN
      </button>
    </div>
  );
}

function FlagVI() {
  return (
    <svg viewBox="0 0 18 12" aria-hidden="true">
      <rect width="18" height="12" fill="#da251d" />
      <polygon fill="#ff0" points="9,2.1 10.1,5.2 13.4,5.2 10.7,7.1 11.7,10.2 9,8.3 6.3,10.2 7.3,7.1 4.6,5.2 7.9,5.2" />
    </svg>
  );
}

function FlagEN() {
  return (
    <svg viewBox="0 0 18 12" aria-hidden="true">
      <rect width="18" height="12" fill="#012169" />
      <path d="M0,0 L18,12 M18,0 L0,12" stroke="#fff" strokeWidth="2.4" />
      <path d="M0,0 L18,12 M18,0 L0,12" stroke="#c8102e" strokeWidth="1.1" />
      <path d="M9,0 V12 M0,6 H18" stroke="#fff" strokeWidth="3.6" />
      <path d="M9,0 V12 M0,6 H18" stroke="#c8102e" strokeWidth="2" />
    </svg>
  );
}
