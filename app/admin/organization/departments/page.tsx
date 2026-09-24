import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { api, q } from "@/lib/convex";
import { saveDepartment } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const actor = await getSession();
  if (!actor || actor.role !== "admin") redirect("/admin/learning");
  const rows = await q((convex, secret) => convex.query(api.reads.departmentsView, { secret }));
  return (
    <main className="grid-2">
      <form action={saveDepartment} className="card">
        <h1 className="serif">Phòng ban</h1>
        <div className="field"><label htmlFor="name">Tên phòng ban</label><input id="name" name="name" required /></div>
        <button className="btn dark" type="submit">Tạo phòng ban</button>
      </form>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Phòng ban</th><th>Thành viên</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.members}</td></tr>)}</tbody>
        </table>
      </div>
    </main>
  );
}
