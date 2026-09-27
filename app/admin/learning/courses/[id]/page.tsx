import Link from "next/link";
import { notFound } from "next/navigation";
import { courseManagementCode } from "@/convex/codes";
import { api, q } from "@/lib/convex";
import { addCourseLesson, moveCourseLesson, saveCourse, updateCourseLesson } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isInteger(courseId) || courseId <= 0) notFound();
  const error = (await searchParams).error;
  const data = await q((convex, secret) => convex.query(api.reads.cohortsView, { secret }));
  const course = data.courses.find((item) => item.id === courseId);
  if (!course) notFound();
  const rows = data.lessons.filter((lesson) => lesson.course_id === course.id);
  const suggested = course.management_code || courseManagementCode(course.code);
  const live = rows.filter((lesson) => lesson.archived !== 1).length;
  return (
    <main>
      <p className="row-actions"><Link className="btn" href="/admin/learning/courses">Danh sách khoá</Link></p>
      <div className="eyebrow">{course.code} · {suggested}</div>
      <h1 className="serif">{course.title}</h1>
      <p className="muted">Giới thiệu của khoá và danh mục bài học. Lớp không thêm, xoá hay sửa danh mục này. Mỗi buổi của lớp trỏ tới nhiều bài ở đây.</p>
      {error && <p className="notice"><strong>{error}</strong></p>}
      <form action={saveCourse} className="card" style={{ marginTop: 12 }}>
        <h2>Giới thiệu khoá</h2>
        <input type="hidden" name="courseId" value={course.id} />
        <div className="field"><label htmlFor="code">Mã khoá</label><input id="code" name="code" required defaultValue={course.code} /></div>
        <div className="field"><label htmlFor="managementCode">Mã quản trị</label><input id="managementCode" name="managementCode" defaultValue={suggested} /></div>
        <div className="field"><label htmlFor="title">Tên khoá</label><input id="title" name="title" required defaultValue={course.title} /></div>
        <div className="field"><label htmlFor="tagline">Dòng giới thiệu</label><input id="tagline" name="tagline" defaultValue={course.tagline} /></div>
        <div className="field"><label htmlFor="intro">Giới thiệu</label><textarea id="intro" name="intro" rows={4} defaultValue={course.intro} /></div>
        <button className="btn dark" type="submit">Lưu khoá</button>
      </form>
      <h2 className="serif" style={{ marginTop: 18 }}>Danh sách bài học</h2>
      <p className="muted">{live} bài học đang dùng{rows.length !== live ? ` · ${rows.length - live} đã lưu trữ` : ""}</p>
      {rows.length === 0 && <p className="muted">Chưa có bài học.</p>}
      {rows.map((lesson, index) => (
        <form key={lesson.id} action={updateCourseLesson} className="card" style={{ marginTop: 10 }}>
          <input type="hidden" name="courseId" value={course.id} />
          <input type="hidden" name="lessonId" value={lesson.id} />
          <div className="user-line">
            <strong>Bài học {String(lesson.number).padStart(2, "0")}{lesson.archived === 1 ? " · đã lưu trữ" : ""}</strong>
            <span className="row-actions">
              {index > 0 && (
                <button className="btn" type="submit" formAction={moveCourseLesson} name="direction" value="up">Lên</button>
              )}
              {index < rows.length - 1 && (
                <button className="btn" type="submit" formAction={moveCourseLesson} name="direction" value="down">Xuống</button>
              )}
            </span>
          </div>
          <div className="grid-2">
            <div className="field"><label>Tên bài học</label><input name="title" required defaultValue={lesson.title} /></div>
            <div className="field"><label>Framework</label><input name="framework" defaultValue={lesson.framework} /></div>
            <div className="field"><label>Nhóm</label><input name="groupName" defaultValue={lesson.group_name} /></div>
            <div className="field"><label>Tóm tắt</label><textarea name="summary" rows={2} defaultValue={lesson.summary} /></div>
          </div>
          <label className="muted"><input type="checkbox" name="archived" defaultChecked={lesson.archived === 1} /> Lưu trữ (giữ đường dẫn bài học đã có)</label>
          <div className="row-actions" style={{ marginTop: 8 }}>
            <button className="btn dark" type="submit">Lưu bài học</button>
          </div>
        </form>
      ))}
      <form action={addCourseLesson} className="card" style={{ marginTop: 10 }}>
        <h3>Thêm bài học</h3>
        <input type="hidden" name="courseId" value={course.id} />
        <div className="grid-2">
          <div className="field"><label>Tên bài học</label><input name="title" required /></div>
          <div className="field"><label>Framework</label><input name="framework" /></div>
          <div className="field"><label>Nhóm</label><input name="groupName" placeholder="CATALOG" /></div>
          <div className="field"><label>Tóm tắt</label><textarea name="summary" rows={2} /></div>
        </div>
        <button className="btn" type="submit">Thêm vào danh mục</button>
      </form>
    </main>
  );
}
