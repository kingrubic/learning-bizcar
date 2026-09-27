import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { answersFor, learningState } from "@/lib/access";
import { canSee } from "@/lib/permissions";
import { CourseMap } from "@/components/learning/CourseMap";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";
import { cmsAnnouncements, cmsBlock, cmsLesson } from "@/lib/cms";
import { BABOSORA_COURSE, babosoraDisplay, isBabosoraCourse } from "@/lib/babosora-applier";
import { isVabixCourse, VABIX_COURSE, vabixDisplay } from "@/lib/vabix-applier";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) return null;
  if (!(await canSee(user, "dashboard"))) redirect("/learn/profile");
  const state = await learningState(user.id);
  if (!state) return null;
  const enrollment = state.enrollment;
  const course = state.course;
  const lessons = state.lessons;
  const answers = await answersFor(user.id, course.slug);
  const progress = state.enrollments.find((seat) => seat.cohort_id === enrollment?.cohort_id) ?? { completed: 0, total: lessons.length, percent: 0 };
  const byId = new Map(answers.map((row) => [row.lesson_id, row]));
  const recent = [...answers].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))[0];
  const recentLesson = lessons.find((lesson) => lesson.id === recent?.lesson_id);
  const continueLesson = recentLesson ?? lessons[0];
  const locale = await getLocale();
  const t = messages(locale);
  const hour = new Date().getHours();
  const greet = hour < 11 ? t.greeting.morning : hour < 18 ? t.greeting.afternoon : t.greeting.evening;
  const vabix = isVabixCourse(course.slug, lessons[0]?.storage_key);
  const babosora = isBabosoraCourse(course.slug, lessons[0]?.storage_key);
  const continueCopy = continueLesson && !vabix && !babosora ? await cmsLesson(continueLesson.number) : undefined;
  const recentCopy = recentLesson && !vabix && !babosora ? await cmsLesson(recentLesson.number) : undefined;
  const continueLocal = continueLesson ? vabixDisplay(continueLesson.storage_key, continueLesson.number, locale) ?? babosoraDisplay(continueLesson.storage_key, continueLesson.number, locale) : null;
  const recentLocal = recentLesson ? vabixDisplay(recentLesson.storage_key, recentLesson.number, locale) ?? babosoraDisplay(recentLesson.storage_key, recentLesson.number, locale) : null;
  const notices = await cmsAnnouncements(locale);

  return (
    <main className="page">
      <div className="eyebrow">{course.code} · {t.executive}</div>
      <h1 className="serif display">{greet}, {user.displayName.split(" ").slice(-1)}</h1>
      <p className="lede">{vabix ? VABIX_COURSE.mapLede[locale] : babosora ? BABOSORA_COURSE.mapLede[locale] : await cmsBlock("dashboard.lede", locale, t.lede)}</p>
      {notices.map((item) => (
        <p className="notice" key={item.id}><strong>{item.title}</strong><span>{item.body}</span></p>
      ))}
      {!enrollment && user.role === "admin" && (
        <p className="notice">
          <strong>{t.notEnrolled}</strong>
          <span>{t.notEnrolledAdmin}</span>
          <Link className="btn gold" href="/admin/learning">{t.adminDesk}</Link>
        </p>
      )}
      {!enrollment && user.role !== "admin" && <p className="notice"><strong>{t.notEnrolled}</strong><span>{t.notEnrolledHint}</span></p>}
      <article className="card" style={{ marginTop: 22 }}>
        <div className="eyebrow">{t.discussionEyebrow}</div>
        <h2 className="serif" style={{ fontSize: 32 }}>{t.discussionGroupCta}</h2>
        <p className="muted">{t.discussionGroupHint}</p>
        <Link className="btn gold" href="/learn/discussion">{t.discussionGroupCta}</Link>
      </article>
      <div className="grid-2" style={{ marginTop: 22 }}>
        <article className="card">
          <div className="eyebrow">{t.continue}</div>
          <h2 className="serif" style={{ fontSize: 32 }}>{continueLesson ? `${t.lesson} ${String(continueLesson.number).padStart(2, "0")} · ${continueLesson.framework}` : "BizCar"}</h2>
          <p className="muted">{continueLocal?.summary ?? (locale === "en" ? continueCopy?.summary_en : continueCopy?.summary_vi) ?? continueLesson?.summary}</p>
          <p>{progress.completed}/{progress.total} {t.doneOf} · {progress.percent}%</p>
          {continueLesson && <Link className="btn gold" href={`/learn/course/${course.slug}/lesson/${String(continueLesson.number).padStart(2, "0")}`}>{t.continueDesign}</Link>}
        </article>
        <article className="card">
          <div className="eyebrow">{t.recent}</div>
          <h3>{recentLesson ? (recentLocal?.title ?? (locale === "en" ? recentCopy?.title_en ?? recentLesson.title : recentCopy?.title_vi ?? recentLesson.title)) : t.noneOpened}</h3>
          <p className="muted">{recent ? new Date(recent.updated_at + "Z").toLocaleString(locale === "en" ? "en-GB" : "vi-VN") : t.noSaved}</p>
          <div className="row-actions">
            <Link className="btn" href="/learn/workbook">{t.workbook}</Link>
            <Link className="btn" href="/learn/portfolio">{t.portfolio}</Link>
          </div>
        </article>
      </div>
      {state.enrollments.length > 1 && (
        <div className="grid-2" style={{ marginTop: 22 }}>
          {state.enrollments.map((seat) => (
            <article className="card" key={seat.cohort_id}>
              <div className="eyebrow">{seat.course_code} · {seat.cohort_code}</div>
              <h2 className="serif" style={{ fontSize: 28 }}>{seat.cohort_name}</h2>
              <p>{seat.completed}/{seat.total} {t.doneOf} · {seat.percent}%</p>
              <Link className="btn" href={`/learn/course/${seat.course_slug}`}>{seat.course_title}</Link>
            </article>
          ))}
        </div>
      )}
      <CourseMap userId={user.id} locale={locale} courseSlug={course.slug} />
    </main>
  );
}
