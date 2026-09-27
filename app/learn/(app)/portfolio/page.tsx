import Link from "next/link";
import { getSession } from "@/lib/auth";
import { answersFor, learningState } from "@/lib/access";
import { PORTFOLIO, readPath } from "@/lib/course";
import { isVabixCourse, vabixFields } from "@/lib/vabix-applier";
import { PrintButton } from "@/components/learning/PrintButton";
import { canSee } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const user = await getSession();
  if (!user) return null;
  if (!(await canSee(user, "portfolio"))) redirect("/learn/profile");
  const t = messages(await getLocale());
  const requested = (await searchParams).course;
  const state = await learningState(user.id, requested);
  if (!state) return null;
  const course = state.course;
  const lessons = state.lessons;
  const vabix = isVabixCourse(course.slug, lessons[0]?.storage_key);
  const answers = new Map((await answersFor(user.id, course.slug)).map((row) => [row.lesson_id, JSON.parse(row.answers_json) as unknown]));
  const courses = [...new Map(state.enrollments.map((seat) => [seat.course_slug, seat])).values()];
  return (
    <main className="page portfolio">
      <div className="no-print" style={{ textAlign: "right" }}><PrintButton label={t.print} /></div>
      <header>
        <div className="eyebrow">VABIX · {course.code}</div>
        <h1 className="serif" style={{ fontSize: "clamp(36px, 5vw, 58px)", marginBottom: 0 }}>{vabix ? course.title : "My BizCar"}</h1>
        <p className="lede">{t.portfolioLede} {user.displayName}.</p>
        {courses.length > 1 && (
          <p className="row-actions no-print">
            {courses.map((seat) => <Link key={seat.course_slug} className="btn" href={`/learn/portfolio?course=${seat.course_slug}`}>{seat.course_code}</Link>)}
          </p>
        )}
      </header>
      {lessons.map((lesson) => {
        const block = vabix
          ? { heading: `${lesson.title} · ${lesson.framework}`, paths: vabixFields(lesson.number) }
          : PORTFOLIO[lesson.number];
        const data = answers.get(lesson.id) ?? {};
        return (
          <section className="card" key={lesson.id}>
            <div className="eyebrow">{String(lesson.number).padStart(2, "0")} · {lesson.framework}</div>
            <h2 className="serif" style={{ fontSize: 30 }}>{block?.heading ?? lesson.title}</h2>
            {(block?.paths ?? []).map((field) => {
              const value = readPath(data, field.path);
              return <p key={field.path}><strong>{field.label}.</strong> {value || "Chưa hoàn thiện"}</p>;
            })}
          </section>
        );
      })}
    </main>
  );
}

