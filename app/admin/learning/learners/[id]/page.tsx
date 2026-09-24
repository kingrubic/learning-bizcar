import { notFound, redirect } from "next/navigation";
import { api, q } from "@/lib/convex";
import { getSession } from "@/lib/auth";
import { canCoachSee } from "@/lib/access";
import { WORKBOOK, readPath } from "@/lib/course";

export const dynamic = "force-dynamic";

export default async function LearnerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getSession();
  if (!actor) redirect("/learn/login");
  const learnerId = Number(id);
  if (!canCoachSee(actor, learnerId) || actor.role === "user") notFound();
  const detail = await q((convex, secret) => convex.query(api.reads.learnerDetail, { secret, id: learnerId }));
  if (!detail || detail.learner.role !== "user") notFound();
  const learner = detail.learner;
  const answers = detail.answers;
  const logs = detail.logs;
  return (
    <main>
      <div className="eyebrow">@{learner.username} · {learner.active ? "active" : "inactive"}</div>
      <h1 className="serif">{learner.display_name}</h1>
      <h2>Dòng thời gian</h2>
      <ul>{logs.map((log) => <li key={log.created_at + log.action}>{log.created_at} · {log.action} {log.detail ?? ""}</li>)}</ul>
      {answers.map((answer) => {
        const data = JSON.parse(answer.answers_json) as unknown;
        const fields = (WORKBOOK[answer.number] ?? []).map((field) => ({ ...field, value: readPath(data, field.path) })).filter((field) => field.value);
        return (
          <section className="card" key={answer.number} style={{ marginTop: 12 }}>
            <h3>Buổi {String(answer.number).padStart(2, "0")} · {answer.framework} · {answer.status} · {answer.progress_percent}% · {answer.current_phase}</h3>
            <p className="muted">Cập nhật {answer.updated_at}</p>
            {fields.map((field) => <p key={field.path}><strong>{field.label}.</strong> {field.value}</p>)}
          </section>
        );
      })}
    </main>
  );
}
