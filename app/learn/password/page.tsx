import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PasswordForm } from "@/components/learning/PasswordForm";
import { getLocale } from "@/lib/locale";
import { LocaleSwitch } from "@/components/brand/LocaleSwitch";

export default async function PasswordPage() {
  const user = await getSession();
  if (!user) redirect("/learn/login");
  const locale = await getLocale();
  return (
    <main className="page">
      <div className="no-print" style={{ marginBottom: 16 }}><LocaleSwitch locale={locale} tone="paper" /></div>
      <PasswordForm forced={Boolean(user.mustChangePassword)} locale={locale} />
    </main>
  );
}
