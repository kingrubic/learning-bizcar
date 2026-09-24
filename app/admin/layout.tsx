import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { BrandMark } from "@/components/brand/BrandMark";
import { menusFor } from "@/lib/permissions";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";
import { LocaleSwitch } from "@/components/brand/LocaleSwitch";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/learn/login");
  if (user.mustChangePassword) redirect("/learn/password");
  const locale = await getLocale();
  const t = messages(locale);
  const links = (await menusFor(user)).filter((item) => item.area === "admin");
  if (links.length === 0) redirect("/learn/dashboard");
  return (
    <div>
      <header className="page-top">
        <div className="brand" style={{ border: 0, padding: 0 }}>
          <BrandMark size={40} />
          <span><strong>VABIX</strong><small>{t.brandRole[user.role]}</small></span>
        </div>
        <nav className="row-actions" aria-label={t.navAdmin}>
          {links.map((item) => <Link key={item.key} className="btn" href={item.href}>{t.menu[item.key as keyof typeof t.menu]}</Link>)}
          <LocaleSwitch locale={locale} />
          <Link className="btn dark" href="/learn/dashboard">{t.backToClass}</Link>
        </nav>
      </header>
      <div className="page">{children}</div>
    </div>
  );
}
