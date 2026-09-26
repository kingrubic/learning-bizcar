import Link from "next/link";
import { api, q } from "@/lib/convex";
import { CreateLearnerForm } from "@/components/admin/CreateLearnerForm";
import { LearnerControls } from "@/components/admin/LearnerControls";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function LearnersPage() {
  const t = messages(await getLocale());
  const data = await q((convex, secret) => convex.query(api.reads.learnersView, { secret }));
  const cohorts = data.cohorts;
  const learners = data.learners;
  return (
    <main>
      <p className="row-actions" style={{ marginBottom: 16 }}>
        <Link className="btn gold" href="/admin/learning/discussion">{t.menu["admin-discussion"]}</Link>
      </p>
      <div className="grid-2">
        <CreateLearnerForm cohorts={cohorts} />
        <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Học viên</th><th>Cohort</th><th></th></tr></thead>
          <tbody>
            {learners.map((learner) => (
              <tr key={learner.id}>
                <td>{learner.display_name}<div className="muted">@{learner.username}</div></td>
                <td>{learner.cohort ?? "—"} · {learner.active ? "active" : "inactive"}</td>
                <td><LearnerControls id={learner.id} active={Boolean(learner.active)} role={learner.role} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </main>
  );
}
