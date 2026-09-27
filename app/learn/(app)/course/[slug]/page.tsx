import { getSession } from "@/lib/auth";
import { CourseMap } from "@/components/learning/CourseMap";
import { learningState } from "@/lib/access";
import { notFound } from "next/navigation";
import { canSee } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";
import { cmsBlock } from "@/lib/cms";
import { BABOSORA_COURSE, isBabosoraCourse } from "@/lib/babosora-applier";
import { isVabixCourse, VABIX_COURSE } from "@/lib/vabix-applier";
import { BMDO_SLUG } from "@/convex/codes";

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSession();
  if (!user) return null;
  if (!(await canSee(user, "map"))) redirect("/learn/profile");
  const state = await learningState(user.id, slug);
  if (!state || state.course.slug !== slug) notFound();
  const course = state.course;
  const enrolledHere = Boolean(state.enrollment) || (state.enrollments.length === 0 && slug === BMDO_SLUG);
  if (!enrolledHere) notFound();
  const locale = await getLocale();
  const t = messages(locale);
  const vabix = isVabixCourse(course.slug, state.lessons[0]?.storage_key);
  const babosora = isBabosoraCourse(course.slug, state.lessons[0]?.storage_key);
  const lede = vabix
    ? VABIX_COURSE.mapLede[locale]
    : babosora
      ? BABOSORA_COURSE.mapLede[locale]
      : course.slug === BMDO_SLUG
        ? await cmsBlock("map.lede", locale, t.mapLede)
        : (course.intro || course.tagline);
  return (
    <main className="page">
      <div className="eyebrow">{course.management_code || course.code}</div>
      <h1 className="serif" style={{ fontSize: "clamp(36px, 5vw, 56px)" }}>{vabix || babosora || course.slug !== BMDO_SLUG ? course.title : t.mapTitle}</h1>
      <p className="lede">{lede}</p>
      <CourseMap userId={user.id} locale={locale} courseSlug={course.slug} />
    </main>
  );
}
