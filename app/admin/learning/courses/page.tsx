import Link from "next/link";
import { courseManagementCode } from "@/convex/codes";
import { api, q } from "@/lib/convex";
import { cloneCourse, saveCourse } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const error = (await searchParams).error;
  const data = await q((convex, secret) => convex.query(api.reads.cohortsView, { secret }));
  const courses = data.courses;
  const lessons = data.lessons;
  return (
    <main>
      <h1 className="serif">Khoá học</h1>
      <p className="muted">Danh sách khoá. Bài học thuộc từng khoá — mở Chi tiết khoá học để tạo, sửa, sắp xếp hoặc lưu trữ. Lớp không sửa danh mục này; buổi của lớp chỉ trỏ tới các bài.</p>
      {error && <p className="notice"><strong>{error}</strong></p>}
      <form action={saveCourse} className="card" style={{ marginTop: 12 }}>
        <h2>Tạo khoá</h2>
        <div className="field"><label htmlFor="code">Mã khoá</label><input id="code" name="code" required placeholder="BMDO K04" /></div>
        <div className="field"><label htmlFor="managementCode">Mã quản trị</label><input id="managementCode" name="managementCode" placeholder="Để trống để tạo KH-…" /></div>
        <div className="field"><label htmlFor="title">Tên khoá</label><input id="title" name="title" required placeholder="BizCar Management Design" /></div>
        <div className="field"><label htmlFor="tagline">Dòng giới thiệu</label><input id="tagline" name="tagline" /></div>
        <div className="field"><label htmlFor="intro">Giới thiệu</label><textarea id="intro" name="intro" rows={4} /></div>
        <button className="btn dark" type="submit">Tạo khoá</button>
      </form>
      <form action={cloneCourse} className="card" style={{ marginTop: 12 }}>
        <h2>Sao chép danh mục từ khoá có sẵn</h2>
        <p className="muted">Khoá mới nhận toàn bộ bài học đang có của khoá nguồn. Bài làm học viên không đi theo. Sau đó tạo lớp và xếp những bài đó vào từng buổi.</p>
        <div className="field">
          <label htmlFor="sourceCourseId">Khoá nguồn</label>
          <select id="sourceCourseId" name="sourceCourseId" required defaultValue={courses[0]?.id}>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title} · {lessons.filter((lesson) => lesson.course_id === course.id && lesson.archived !== 1).length} bài học</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="clone-code">Mã khoá mới</label><input id="clone-code" name="code" required placeholder="BMDO K04" /></div>
        <div className="field"><label htmlFor="clone-title">Tên khoá</label><input id="clone-title" name="title" required /></div>
        <div className="field"><label htmlFor="clone-tagline">Dòng giới thiệu</label><input id="clone-tagline" name="tagline" placeholder="Để trống nếu dùng dòng của khoá nguồn" /></div>
        <button className="btn dark" type="submit">Sao chép khoá</button>
      </form>
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
              <Link className="btn dark" href={`/admin/learning/courses/${course.id}`}>Chi tiết khoá học</Link>
            </p>
          </section>
        );
      })}
    </main>
  );
}
