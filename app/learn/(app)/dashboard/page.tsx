import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { answersFor, courseProgress, enrollmentFor, lessonRows } from "@/lib/access";
import { COURSE } from "@/lib/course";
import { canSee } from "@/lib/permissions";
import { CourseMap } from "@/components/learning/CourseMap";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";
import { cmsAnnouncements, cmsBlock, cmsLesson } from "@/lib/cms";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) return null;
  if (!(await canSee(user, "dashboard"))) redirect("/learn/profile");
  const enrollment = await enrollmentFor(user.id);
  const progress = await courseProgress(user.id);
  const lessons = await lessonRows();
  const answers = await answersFor(user.id);
  const byId = new Map(answers.map((row) => [row.lesson_id, row]));
  const recent = [...answers].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))[0];
  const recentLesson = lessons.find((lesson) => lesson.id === recent?.lesson_id);
  const continueLesson = recentLesson ?? lessons[0];
  const locale = await getLocale();
  const t = messages(locale);
  const hour = new Date().getHours();
  const greet = hour < 11 ? t.greeting.morning : hour < 18 ? t.greeting.afternoon : t.greeting.evening;
  const continueCopy = continueLesson ? await cmsLesson(continueLesson.number) : undefined;
  const recentCopy = recentLesson ? await cmsLesson(recentLesson.number) : undefined;
  const notices = await cmsAnnouncements(locale);

  return (
    <main className="page">
      <div className="eyebrow">{COURSE.code} · {t.executive}</div>
      <h1 className="serif display">{greet}, {user.displayName.split(" ").slice(-1)}</h1>
      <p className="lede">{await cmsBlock("dashboard.lede", locale, t.lede)}</p>
      {notices.map((item) => (
        <p className="notice" key={item.id}><strong>{item.title}</strong><span>{item.body}</span></p>
      ))}
      {!enrollment && <p className="notice"><strong>{t.notEnrolled}</strong><span>{t.notEnrolledHint}</span></p>}
      <div className="grid-2" style={{ marginTop: 22 }}>
        <article className="card">
          <div className="eyebrow">{t.continue}</div>
          <h2 className="serif" style={{ fontSize: 32 }}>{continueLesson ? `${t.lesson} ${String(continueLesson.number).padStart(2, "0")} · ${continueLesson.framework}` : "BizCar"}</h2>
          <p className="muted">{(locale === "en" ? continueCopy?.summary_en : continueCopy?.summary_vi) ?? continueLesson?.summary}</p>
          <p>{progress.completed}/{progress.total} {t.doneOf} · {progress.percent}%</p>
          {continueLesson && <Link className="btn gold" href={`/learn/course/bmdo-k03/lesson/${String(continueLesson.number).padStart(2, "0")}`}>{t.continueDesign}</Link>}
        </article>
        <article className="card">
          <div className="eyebrow">{t.recent}</div>
          <h3>{recentLesson ? (locale === "en" ? recentCopy?.title_en ?? recentLesson.title : recentCopy?.title_vi ?? recentLesson.title) : t.noneOpened}</h3>
          <p className="muted">{recent ? new Date(recent.updated_at + "Z").toLocaleString(locale === "en" ? "en-GB" : "vi-VN") : t.noSaved}</p>
          <div className="row-actions">
            <Link className="btn" href="/learn/workbook">{t.workbook}</Link>
            <Link className="btn" href="/learn/portfolio">{t.portfolio}</Link>
          </div>
        </article>
      </div>
      <CourseMap userId={user.id} locale={locale} />
    </main>
  );
}
