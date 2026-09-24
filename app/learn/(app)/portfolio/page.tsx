import { getSession } from "@/lib/auth";
import { answersFor, learningState } from "@/lib/access";
import { PORTFOLIO, readPath } from "@/lib/course";
import { PrintButton } from "@/components/learning/PrintButton";
import { canSee } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await getSession();
  if (!user) return null;
  if (!(await canSee(user, "portfolio"))) redirect("/learn/profile");
  const t = messages(await getLocale());
  const course = (await learningState(user.id)).course;
  const lessons = (await learningState(user.id)).lessons;
  const answers = new Map((await answersFor(user.id)).map((row) => [row.lesson_id, JSON.parse(row.answers_json) as unknown]));
  return (
    <main className="page portfolio">
      <div className="no-print" style={{ textAlign: "right" }}><PrintButton label={t.print} /></div>
      <header>
        <div className="eyebrow">VABIX · {course.code}</div>
        <h1 className="serif" style={{ fontSize: "clamp(36px, 5vw, 58px)", marginBottom: 0 }}>My BizCar</h1>
        <p className="lede">{t.portfolioLede} {user.displayName}.</p>
      </header>
      {lessons.map((lesson) => {
        const block = PORTFOLIO[lesson.number];
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

