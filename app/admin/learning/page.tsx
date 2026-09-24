import Link from "next/link";
import { api, q } from "@/lib/convex";
import { LESSONS } from "@/lib/course";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";

const LESSON_TOTAL = LESSONS.length;

export const dynamic = "force-dynamic";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ cohort?: string; status?: string }> }) {
  const filters = await searchParams;
  const cohort = filters.cohort ? Number(filters.cohort) : null;
  const status = filters.status || "";
  const data = await q((convex, secret) => convex.query(api.reads.adminHome, { secret, cohortId: cohort, status }));
  const rows = data.rows;
  const cohorts = data.cohorts;
  return (
    <main>
      <h1 className="serif" style={{ fontSize: 42 }}>{messages(await getLocale()).adminDesk}</h1>
      <p className="muted">Theo dõi học viên, cohort và tiến độ. Không có bảng xếp hạng.</p>
      <form className="row-actions" method="get">
        <select name="cohort" defaultValue={filters.cohort || ""} aria-label="Cohort">
          <option value="">Mọi cohort</option>
          {cohorts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select name="status" defaultValue={status} aria-label="Trạng thái">
          <option value="">Mọi trạng thái</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="submitted">Submitted</option>
          <option value="reviewed">Reviewed</option>
        </select>
        <button className="btn dark" type="submit">Lọc</button>
      </form>
      <div className="table-wrap card" style={{ marginTop: 16, padding: 0 }}>
        <table>
          <thead><tr><th>Học viên</th><th>Tổ chức</th><th>Cohort</th><th>Hoàn thành</th><th>Hoạt động</th><th></th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.display_name}<div className="muted">@{row.username} · {row.active ? "active" : "inactive"}</div></td>
                <td>{row.org}</td>
                <td>{row.cohort}</td>
                <td>{row.done}/{LESSON_TOTAL}</td>
                <td>{row.last_activity ?? "—"}</td>
                <td><Link href={`/admin/learning/learners/${row.id}`}>Hồ sơ</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
