import Link from "next/link";
import { answersFor, isLessonUnlocked, learningState } from "@/lib/access";
import { GROUPS, LESSONS } from "@/lib/course";
import { messages, type Locale } from "@/lib/i18n";
import { cmsLessons } from "@/lib/cms";

export async function CourseMap({ userId, locale }: { userId: number; locale: Locale }) {
  const t = messages(locale);
  const course = (await learningState(userId)).course;
  const lessons = (await learningState(userId)).lessons;
  const copies = new Map((await cmsLessons()).map((item) => [item.number, item]));
  const answers = new Map((await answersFor(userId)).map((row) => [row.lesson_id, row]));
  const unlockedByNumber = new Map(await Promise.all(lessons.map(async (lesson) => [lesson.number, await isLessonUnlocked(userId, lesson.number)] as const)));
  return (
    <div>
      {GROUPS.map((group) => (
        <section className="group" key={group}>
          <h2>{t.group[group]}</h2>
          <div className="map-grid">
            {lessons.filter((lesson) => lesson.group_name === group && copies.get(lesson.number)?.published !== 0).map((lesson) => {
              const answer = answers.get(lesson.id);
              const status = answer?.status ?? "not_started";
              const unlocked = unlockedByNumber.get(lesson.number) ?? false;
              const meta = LESSONS.find((item) => item.number === lesson.number);
              const copy = copies.get(lesson.number);
              const code = String(lesson.number).padStart(2, "0");
              return (
                <article className="card map-card" key={lesson.id}>
                  <div className="user-line">
                    <span className="num">{code}</span>
                    <span className={`badge st-${status}`}><i /> {t.status[status as keyof typeof t.status] ?? status}</span>
                  </div>
                  <strong>{lesson.framework}</strong>
                  <h3 className="serif" style={{ fontSize: 26, margin: 0 }}>{locale === "en" ? copy?.title_en ?? lesson.title : copy?.title_vi ?? lesson.title}</h3>
                  <p className="muted" style={{ flex: 1 }}>{locale === "en" ? copy?.summary_en ?? meta?.summary : copy?.summary_vi ?? meta?.summary}</p>
                  <div className="p-track" style={{ background: "var(--soft)" }}><div style={{ width: `${answer?.progress_percent ?? 0}%`, background: "var(--gold)" }} /></div>
                  {unlocked ? <Link className="btn dark" href={`/learn/course/${course.slug}/lesson/${code}`}>{status === "not_started" ? t.openLesson : t.resume}</Link> : <span className="muted">{t.locked}</span>}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
