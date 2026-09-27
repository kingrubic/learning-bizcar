import Link from "next/link";
import { getSession } from "@/lib/auth";
import { answersFor, learningState } from "@/lib/access";
import { WORKBOOK, readPath } from "@/lib/course";
import { BABOSORA_COURSE, babosoraDisplay, babosoraFields, isBabosoraCourse } from "@/lib/babosora-applier";
import { isVabixCourse, vabixDisplay, vabixFields, VABIX_COURSE } from "@/lib/vabix-applier";
import { canSee } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";
import { lessonEn } from "@/lib/lesson-locale";

export const dynamic = "force-dynamic";

export default async function WorkbookPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const user = await getSession();
  if (!user) return null;
  if (!(await canSee(user, "workbook"))) redirect("/learn/profile");
  const locale = await getLocale();
  const t = messages(locale);
  const requested = (await searchParams).course;
  const state = await learningState(user.id, requested);
  if (!state) return null;
  const course = state.course;
  const lessons = state.lessons;
  const vabix = isVabixCourse(course.slug, lessons[0]?.storage_key);
  const babosora = isBabosoraCourse(course.slug, lessons[0]?.storage_key);
  const answers = new Map((await answersFor(user.id, course.slug)).map((row) => [row.lesson_id, JSON.parse(row.answers_json) as unknown]));
  const courses = [...new Map(state.enrollments.map((seat) => [seat.course_slug, seat])).values()];
  return (
    <main className="page">
      <div className="eyebrow">{course.code}</div>
      <h1 className="serif" style={{ fontSize: "clamp(36px, 5vw, 56px)" }}>{vabix || babosora ? course.title : t.workbook}</h1>
      <p className="lede">{vabix ? VABIX_COURSE.mapLede[locale] : babosora ? BABOSORA_COURSE.mapLede[locale] : t.workbookLede}</p>
      {courses.length > 1 && (
        <p className="row-actions">
          {courses.map((seat) => <Link key={seat.course_slug} className="btn" href={`/learn/workbook?course=${seat.course_slug}`}>{seat.course_code}</Link>)}
        </p>
      )}
      {lessons.map((lesson) => {
        const data = answers.get(lesson.id) ?? {};
        const vabixLocal = vabixDisplay(lesson.storage_key, lesson.number, locale);
        const babosoraLocal = babosoraDisplay(lesson.storage_key, lesson.number, locale);
        const local = vabixLocal ?? babosoraLocal;
        const fields = vabixLocal ? vabixFields(lesson.number) : babosoraLocal ? babosoraFields(lesson.number) : (WORKBOOK[lesson.number] ?? []);
        const filled = fields.map((field) => ({ ...field, value: readPath(data, field.path) })).filter((field) => field.value);
        const code = String(lesson.number).padStart(2, "0");
        return (
          <section className="card" key={lesson.id} style={{ marginTop: 14 }}>
            <div className="user-line">
              <div>
                <div className="eyebrow">{t.lesson} {code} · {lesson.framework}</div>
                <h2 className="serif" style={{ fontSize: 28 }}>{local?.title ?? (locale === "en" ? lessonEn[lesson.number]?.title ?? lesson.title : lesson.title)}</h2>
              </div>
              <Link className="btn" href={`/learn/course/${course.slug}/lesson/${code}`}>{t.reopen}</Link>
            </div>
            {filled.length === 0 && <p className="muted">{t.emptyOutputs}</p>}
            {filled.map((field) => (
              <p key={field.path}><strong>{field.label}.</strong> {field.value}</p>
            ))}
          </section>
        );
      })}
    </main>
  );
}
