import Link from "next/link";
import { answersFor, isLessonUnlocked, learningState } from "@/lib/access";
import { BMDO_SLUG } from "@/convex/codes";
import { GROUPS, LESSONS } from "@/lib/course";
import { messages, type Locale } from "@/lib/i18n";
import { cmsLessons } from "@/lib/cms";
import { babosoraDisplay } from "@/lib/babosora-applier";
import { vabixDisplay } from "@/lib/vabix-applier";

export async function CourseMap({ userId, locale, courseSlug }: { userId: number; locale: Locale; courseSlug?: string }) {
  const t = messages(locale);
  const state = await learningState(userId, courseSlug);
  if (!state) return null;
  const course = state.course;
  const lessons = state.lessons;
  const useCms = course.slug === BMDO_SLUG;
  const copies = useCms ? new Map((await cmsLessons()).map((item) => [item.number, item])) : new Map();
  const answers = new Map((await answersFor(userId, course.slug)).map((row) => [row.lesson_id, row]));
  const unlockedByNumber = new Map(await Promise.all(lessons.map(async (lesson) => [lesson.number, await isLessonUnlocked(userId, lesson.number, course.slug)] as const)));
  const groups = useCms ? [...GROUPS] : [...new Set(lessons.map((lesson) => lesson.group_name))];
  return (
    <div>
      {groups.map((group) => {
        const rows = lessons.filter((lesson) => lesson.group_name === group && (vabixDisplay(lesson.storage_key, lesson.number, locale) || babosoraDisplay(lesson.storage_key, lesson.number, locale) || !useCms || copies.get(lesson.number)?.published !== 0));
        if (rows.length === 0) return null;
        return (
        <section className="group" key={group}>
          <h2>{t.group[group as keyof typeof t.group] ?? group}</h2>
          <div className="map-grid">
            {rows.map((lesson) => {
              const answer = answers.get(lesson.id);
              const status = answer?.status ?? "not_started";
              const unlocked = unlockedByNumber.get(lesson.number) ?? false;
              const meta = LESSONS.find((item) => item.number === lesson.number);
              const local = vabixDisplay(lesson.storage_key, lesson.number, locale) ?? babosoraDisplay(lesson.storage_key, lesson.number, locale);
              const copy = local ? undefined : copies.get(lesson.number);
              const code = String(lesson.number).padStart(2, "0");
              return (
                <article className="card map-card" key={lesson.id}>
                  <div className="user-line">
                    <span className="num">{code}</span>
                    <span className={`badge st-${status}`}><i /> {t.status[status as keyof typeof t.status] ?? status}</span>
                  </div>
                  <strong>{lesson.framework}</strong>
                  <h3 className="serif" style={{ fontSize: 26, margin: 0 }}>{local?.title ?? (locale === "en" ? copy?.title_en ?? lesson.title : copy?.title_vi ?? lesson.title)}</h3>
                  <p className="muted" style={{ flex: 1 }}>{local?.summary ?? (locale === "en" ? copy?.summary_en ?? meta?.summary : copy?.summary_vi ?? meta?.summary)}</p>
                  <div className="p-track" style={{ background: "var(--soft)" }}><div style={{ width: `${answer?.progress_percent ?? 0}%`, background: "var(--gold)" }} /></div>
                  {unlocked ? <Link className="btn dark" href={`/learn/course/${course.slug}/lesson/${code}`}>{status === "not_started" ? t.openLesson : t.resume}</Link> : <span className="muted">{t.locked}</span>}
                </article>
              );
            })}
          </div>
        </section>
        );
      })}
    </div>
  );
}
