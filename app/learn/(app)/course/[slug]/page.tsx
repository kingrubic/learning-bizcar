import { getSession } from "@/lib/auth";
import { CourseMap } from "@/components/learning/CourseMap";
import { COURSE } from "@/lib/course";
import { canSee } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";
import { cmsBlock } from "@/lib/cms";

export default async function CoursePage() {
  const user = await getSession();
  if (!user) return null;
  if (!(await canSee(user, "map"))) redirect("/learn/profile");
  const locale = await getLocale();
  const t = messages(locale);
  return (
    <main className="page">
      <div className="eyebrow">{COURSE.code}</div>
      <h1 className="serif" style={{ fontSize: "clamp(36px, 5vw, 56px)" }}>{t.mapTitle}</h1>
      <p className="lede">{await cmsBlock("map.lede", locale, t.mapLede)}</p>
      <CourseMap userId={user.id} locale={locale} />
    </main>
  );
}
