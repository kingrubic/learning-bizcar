import Link from "next/link";
import { classPickerLabel } from "@/convex/codes";
import { api, q } from "@/lib/convex";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function CohortsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const error = (await searchParams).error;
  const t = messages(await getLocale());
  const data = await q((convex, secret) => convex.query(api.reads.cohortsView, { secret }));
  const cohorts = data.cohorts;
  const courses = data.courses;
  const roster = data.enrollments;
  return (
    <main>
      <h1 className="serif">Lớp học</h1>
      <p className="muted">Danh sách lớp. Mỗi lớp thuộc một khoá và một giảng viên. Mở chi tiết để sửa buổi học, giảng viên và học viên.</p>
      <p className="row-actions" style={{ marginTop: 12 }}>
        <Link className="btn dark" href="/admin/learning/cohorts/new">Tạo mới</Link>
        <Link className="btn" href="/admin/learning/discussion">{t.menu["admin-discussion"]}</Link>
      </p>
      {error && <p className="notice"><strong>{error}</strong></p>}
      {cohorts.length === 0 && <p className="muted" style={{ marginTop: 18 }}>Chưa có lớp.</p>}
      {cohorts.map((cohort) => {
        const course = courses.find((item) => item.id === cohort.course_id);
        const instructor = cohort.instructor;
        const members = roster.filter((row) => row.cohort_id === cohort.id).length;
        const lessonCount = new Set(cohort.sessions.flatMap((session) => session.lesson_ids)).size;
        return (
          <section className="card" key={cohort.id} style={{ marginTop: 12 }}>
            <div className="eyebrow">{instructor ? instructor.display_name : "Chưa gán giảng viên"}</div>
            <h2 className="serif">{classPickerLabel({ name: cohort.name, code: cohort.code, courseCode: course?.code })}</h2>
            <p className="muted">{cohort.org} · Review {cohort.review_enabled ? "bật" : "tắt"} · {cohort.sessions.length} buổi · {lessonCount} bài trong buổi · {members} học viên</p>
            <p className="row-actions">
              <Link className="btn dark" href={`/admin/learning/cohorts/${cohort.id}`}>Xem chi tiết</Link>
            </p>
          </section>
        );
      })}
    </main>
  );
}
