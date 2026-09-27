import Link from "next/link";
import { getSession } from "@/lib/auth";
import { answersFor, learningState } from "@/lib/access";
import { WORKBOOK, readPath } from "@/lib/course";
import { isVabixCourse, vabixDisplay, vabixFields, VABIX_COURSE } from "@/lib/vabix-applier";
import { canSee } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";
import { lessonEn } from "@/lib/lesson-locale";

export const dynamic = "force-dynamic";

export default async function WorkbookPage() {
  const user = await getSession();
  if (!user) return null;
  if (!(await canSee(user, "workbook"))) redirect("/learn/profile");
  const locale = await getLocale();
  const t = messages(locale);
  const state = await learningState(user.id);
  const course = state.course;
  const lessons = state.lessons;
  const vabix = isVabixCourse(course.slug, lessons[0]?.storage_key);
  const answers = new Map((await answersFor(user.id)).map((row) => [row.lesson_id, JSON.parse(row.answers_json) as unknown]));
  return (
    <main className="page">
      <div className="eyebrow">{course.code}</div>
      <h1 className="serif" style={{ fontSize: "clamp(36px, 5vw, 56px)" }}>{vabix ? course.title : t.workbook}</h1>
      <p className="lede">{vabix ? VABIX_COURSE.mapLede[locale] : t.workbookLede}</p>
      {lessons.map((lesson) => {
        const data = answers.get(lesson.id) ?? {};
        const local = vabixDisplay(lesson.storage_key, lesson.number, locale);
        const fields = local ? vabixFields(lesson.number) : (WORKBOOK[lesson.number] ?? []);
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
