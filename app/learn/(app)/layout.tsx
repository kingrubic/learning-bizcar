import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { BrandMark } from "@/components/brand/BrandMark";
import { canSee, menusFor } from "@/lib/permissions";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";
import { LocaleSwitch } from "@/components/brand/LocaleSwitch";
import { NotificationBell } from "@/components/brand/NotificationBell";
import { api, q } from "@/lib/convex";

export default async function LearnAppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/learn/login");
  if (user.mustChangePassword) redirect("/learn/password");
  const locale = await getLocale();
  const t = messages(locale);
  const menus = await menusFor(user);
  const links = menus.filter((item) => item.area === "learn");
  const admin = menus.some((item) => item.area === "admin");
  return (
    <div>
      <header className="page-top no-print">
        <Link href={links[0]?.href || "/learn/profile"} className="brand" style={{ border: 0, padding: 0 }}>
          <BrandMark />
          <span><strong>VABIX</strong><small>{t.brandRole[user.role]}</small></span>
        </Link>
        <nav className="row-actions" aria-label={t.navLearn}>
          {links.map((item) => <Link key={item.key} className="btn" href={item.href}>{t.menu[item.key as keyof typeof t.menu]}</Link>)}
          <Link className="btn" href="/learn/profile">{user.displayName}</Link>
          <NotificationBell
            initial={await q((convex, secret) => convex.query(api.notifications.feed, { secret, userId: user.id }))}
            locale={locale}
            labels={{
              label: t.notificationsLabel,
              empty: t.notificationsEmpty,
              posted: t.notificationPosted,
              files: t.notificationFiles,
              classChannel: t.discussionClass,
            }}
          />
          <LocaleSwitch locale={locale} />
          {admin && (await canSee(user, "admin-home")) && <Link className="btn dark" href="/admin/learning">{t.navAdmin}</Link>}
          {admin && !(await canSee(user, "admin-home")) && <Link className="btn dark" href={menus.find((item) => item.area === "admin")!.href}>{t.navAdmin}</Link>}
        </nav>
      </header>
      {children}
    </div>
  );
}
