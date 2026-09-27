import { getSession } from "@/lib/auth";
import { CourseMap } from "@/components/learning/CourseMap";
import { learningState } from "@/lib/access";
import { notFound } from "next/navigation";
import { canSee } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";
import { cmsBlock } from "@/lib/cms";
import { isVabixCourse, VABIX_COURSE } from "@/lib/vabix-applier";

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSession();
  if (!user) return null;
  if (!(await canSee(user, "map"))) redirect("/learn/profile");
  const state = await learningState(user.id);
  const course = state.course;
  if (slug !== course.slug) notFound();
  const locale = await getLocale();
  const t = messages(locale);
  const vabix = isVabixCourse(course.slug, state.lessons[0]?.storage_key);
  return (
    <main className="page">
      <div className="eyebrow">{course.code}</div>
      <h1 className="serif" style={{ fontSize: "clamp(36px, 5vw, 56px)" }}>{vabix ? course.title : t.mapTitle}</h1>
      <p className="lede">{vabix ? VABIX_COURSE.mapLede[locale] : await cmsBlock("map.lede", locale, t.mapLede)}</p>
      <CourseMap userId={user.id} locale={locale} />
    </main>
  );
}
