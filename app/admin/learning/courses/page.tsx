import Link from "next/link";
import { courseManagementCode } from "@/convex/codes";
import { api, q } from "@/lib/convex";

export const dynamic = "force-dynamic";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const error = (await searchParams).error;
  const data = await q((convex, secret) => convex.query(api.reads.cohortsView, { secret }));
  const courses = data.courses;
  const lessons = data.lessons;
  return (
    <main>
      <h1 className="serif">Khoá học</h1>
      <p className="muted">Danh sách khoá. Bài học thuộc từng khoá — mở chi tiết để tạo, sửa, sắp xếp hoặc lưu trữ. Lớp không sửa danh mục này; buổi của lớp chỉ trỏ tới các bài.</p>
      <p className="row-actions" style={{ marginTop: 12 }}>
        <Link className="btn dark" href="/admin/learning/courses/new">Tạo mới</Link>
      </p>
      {error && <p className="notice"><strong>{error}</strong></p>}
      {courses.length === 0 && <p className="muted" style={{ marginTop: 18 }}>Chưa có khoá.</p>}
      {courses.map((course) => {
        const rows = lessons.filter((lesson) => lesson.course_id === course.id);
        const live = rows.filter((lesson) => lesson.archived !== 1).length;
        const archived = rows.length - live;
        const suggested = course.management_code || courseManagementCode(course.code);
        return (
          <section className="card" key={course.id} style={{ marginTop: 12 }}>
            <div className="eyebrow">{suggested}</div>
            <h2 className="serif">{course.code} · {course.title}</h2>
            <p className="muted">{course.tagline || "Chưa có dòng giới thiệu"} · {live} bài học{archived > 0 ? ` · ${archived} đã lưu trữ` : ""}</p>
            <p className="row-actions">
              <Link className="btn dark" href={`/admin/learning/courses/${course.id}`}>Xem chi tiết</Link>
            </p>
          </section>
        );
      })}
    </main>
  );
}
