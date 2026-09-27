import { notFound, redirect } from "next/navigation";
import { classPickerLabel } from "@/convex/codes";
import { api, q } from "@/lib/convex";
import { getSession } from "@/lib/auth";
import { canCoachSee, learningState } from "@/lib/access";
import { setManagementCode } from "@/lib/admin-actions";
import { WORKBOOK, readPath } from "@/lib/course";
import { isVabixStorageKey, vabixFields } from "@/lib/vabix-applier";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function LearnerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const error = (await searchParams).error;
  const actor = await getSession();
  if (!actor) redirect("/learn/login");
  const learnerId = Number(id);
  if (!canCoachSee(actor, learnerId) || actor.role === "user") notFound();
  const detail = await q((convex, secret) => convex.query(api.reads.learnerDetail, { secret, id: learnerId }));
  if (!detail) notFound();
  if (detail.learner.role !== "user") {
    const state = await learningState(learnerId);
    if (!state?.enrollments.length) notFound();
  }
  const learner = detail.learner;
  const answers = detail.answers;
  const logs = detail.logs;
  const t = messages(await getLocale());
  return (
    <main>
      <div className="eyebrow">@{learner.username} · {learner.management_code || "chưa có mã"} · {learner.active ? "active" : "inactive"} · {t.brandRole[learner.role]}</div>
      <h1 className="serif">{learner.display_name}</h1>
      {error && <p className="notice"><strong>{error}</strong></p>}
      {detail.classes.length > 0 && <p className="muted">{detail.classes.map((item) => classPickerLabel({ name: item.cohort_name, code: item.cohort_code, courseCode: item.course_code })).join(", ")}</p>}
      <form action={setManagementCode} className="row-actions">
        <input type="hidden" name="userId" value={learner.id} />
        <input name="code" aria-label="Mã học viên" defaultValue={learner.management_code} placeholder="HV-0001" />
        <button className="btn" type="submit">Lưu mã</button>
      </form>
      {learner.role !== "user" && <p className="muted">{t.staffLearnerNote}</p>}
      <h2>Dòng thời gian</h2>
      <ul>{logs.map((log) => <li key={log.created_at + log.action}>{log.created_at} · {log.action} {log.detail ?? ""}</li>)}</ul>
      {answers.map((answer) => {
        const data = JSON.parse(answer.answers_json) as unknown;
        const fields = (isVabixStorageKey(answer.storage_key) ? vabixFields(answer.number) : (WORKBOOK[answer.number] ?? [])).map((field) => ({ ...field, value: readPath(data, field.path) })).filter((field) => field.value);
        return (
          <section className="card" key={answer.number} style={{ marginTop: 12 }}>
            <h3>Bài học {String(answer.number).padStart(2, "0")} · {answer.framework} · {answer.status} · {answer.progress_percent}% · {answer.current_phase}</h3>
            <p className="muted">Cập nhật {answer.updated_at}</p>
            {fields.map((field) => <p key={field.path}><strong>{field.label}.</strong> {field.value}</p>)}
          </section>
        );
      })}
    </main>
  );
}
