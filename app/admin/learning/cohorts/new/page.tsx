import Link from "next/link";
import { api, q } from "@/lib/convex";
import { CohortForm } from "@/components/admin/CohortForm";

export const dynamic = "force-dynamic";

export default async function NewCohortPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const error = (await searchParams).error;
  const data = await q((convex, secret) => convex.query(api.reads.cohortsView, { secret }));
  return (
    <main>
      <p className="row-actions"><Link className="btn" href="/admin/learning/cohorts">Danh sách lớp</Link></p>
      <h1 className="serif">Tạo lớp</h1>
      <p className="muted">Mỗi lớp thuộc một khoá và một giảng viên. Buổi học là lịch của lớp: mỗi buổi có ngày và gồm nhiều bài học của khoá. Tạo lớp không đổi danh mục bài.</p>
      {error && <p className="notice"><strong>{error}</strong></p>}
      <CohortForm courses={data.courses} lessons={data.lessons} instructors={data.instructors} />
    </main>
  );
}
