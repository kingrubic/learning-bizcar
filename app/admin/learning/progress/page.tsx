import Link from "next/link";
import { api, q } from "@/lib/convex";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const rows = await q((convex, secret) => convex.query(api.reads.progressRows, { secret }));
  return (
    <main>
      <h1 className="serif">Tiến độ bài học</h1>
      <div className="table-wrap card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Học viên</th><th>Bài</th><th>Pha</th><th>Tiến độ</th><th>Trạng thái</th><th>Cập nhật</th></tr></thead>
          <tbody>
            {rows.filter((row) => row.number).map((row) => (
              <tr key={`${row.id}-${row.number}`}>
                <td><Link href={`/admin/learning/learners/${row.id}`}>{row.display_name}</Link></td>
                <td>{String(row.number).padStart(2, "0")} · {row.title}</td>
                <td>{row.current_phase}</td>
                <td>{row.progress_percent}%</td>
                <td>{row.status}</td>
                <td>{row.updated_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
