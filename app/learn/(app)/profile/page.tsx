import { getSession } from "@/lib/auth";
import { learningState } from "@/lib/access";
import { PasswordForm } from "@/components/learning/PasswordForm";
import { LogoutButton } from "@/components/learning/LogoutButton";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";

export default async function ProfilePage() {
  const user = await getSession();
  if (!user) return null;
  const locale = await getLocale();
  const t = messages(locale);
  const seats = (await learningState(user.id))?.enrollments ?? [];
  const classLabel = seats.length ? seats.map((seat) => `${seat.cohort_name}${seat.cohort_code ? ` (${seat.cohort_code})` : ""}`).join(" · ") : t.noCohort;
  return (
    <main className="page">
      <div className="user-line">
        <div>
          <div className="eyebrow">{t.profile}</div>
          <h1 className="serif" style={{ fontSize: 46, margin: "6px 0" }}>{user.displayName}</h1>
          <p className="muted">@{user.username} · {t.brandRole[user.role]} · {classLabel}</p>
        </div>
        <LogoutButton label={t.logout} />
      </div>
      <PasswordForm locale={locale} />
    </main>
  );
}
