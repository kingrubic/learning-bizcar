import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PasswordForm } from "@/components/learning/PasswordForm";
import { getLocale } from "@/lib/locale";
import { LocaleSwitch } from "@/components/brand/LocaleSwitch";
import { postLoginPath, requiresPasswordChange } from "@/lib/password-gate";

export default async function PasswordPage() {
  const user = await getSession();
  if (!user) redirect("/learn/login");
  if (!requiresPasswordChange(user.mustChangePassword)) redirect(postLoginPath(user.role));
  const locale = await getLocale();
  return (
    <main className="page">
      <div className="no-print" style={{ marginBottom: 16 }}><LocaleSwitch locale={locale} tone="paper" /></div>
      <PasswordForm forced locale={locale} />
    </main>
  );
}
