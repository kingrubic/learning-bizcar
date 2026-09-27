import Link from "next/link";
import { api, q } from "@/lib/convex";
import { cloneCourse, saveCourse } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function NewCoursePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const error = (await searchParams).error;
  const data = await q((convex, secret) => convex.query(api.reads.cohortsView, { secret }));
  const courses = data.courses;
  const lessons = data.lessons;
  return (
    <main>
      <p className="row-actions"><Link className="btn" href="/admin/learning/courses">Danh sách khoá</Link></p>
      <h1 className="serif">Tạo khoá</h1>
      <p className="muted">Tạo khoá trống, hoặc sao chép toàn bộ bài học đang có từ một khoá nguồn. Bài làm học viên không đi theo.</p>
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
      {courses.length > 0 && (
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
      )}
    </main>
  );
}
