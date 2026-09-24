import { getSession } from "@/lib/auth";
import { enrollmentFor } from "@/lib/access";
import { PasswordForm } from "@/components/learning/PasswordForm";
import { LogoutButton } from "@/components/learning/LogoutButton";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";

export default async function ProfilePage() {
  const user = await getSession();
  if (!user) return null;
  const locale = await getLocale();
  const t = messages(locale);
  const enrollment = await enrollmentFor(user.id);
  return (
    <main className="page">
      <div className="user-line">
        <div>
          <div className="eyebrow">{t.profile}</div>
          <h1 className="serif" style={{ fontSize: 46, margin: "6px 0" }}>{user.displayName}</h1>
          <p className="muted">@{user.username} · {t.brandRole[user.role]} · {enrollment?.cohort_name ?? t.noCohort}</p>
        </div>
        <LogoutButton label={t.logout} />
      </div>
      <PasswordForm locale={locale} />
    </main>
  );
}
