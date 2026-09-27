import { courseManagementCode } from "@/convex/codes";
import { api, q } from "@/lib/convex";
import { addCourseLesson, cloneCourse, moveCourseLesson, saveCourse, updateCourseLesson } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const error = (await searchParams).error;
  const data = await q((convex, secret) => convex.query(api.reads.cohortsView, { secret }));
  const courses = data.courses;
  const lessons = data.lessons;
  return (
    <main>
      <h1 className="serif">Khoá học</h1>
      <p className="muted">Mỗi khoá giữ phần giới thiệu và danh mục buổi. Lớp học chọn tập con buổi đó, không chép nội dung.</p>
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
        <p className="muted">Khoá mới nhận toàn bộ buổi đang có của khoá nguồn. Bài làm học viên không đi theo. Sau đó tạo lớp và chọn buổi cho lớp đó.</p>
        <div className="field">
          <label htmlFor="sourceCourseId">Khoá nguồn</label>
          <select id="sourceCourseId" name="sourceCourseId" required defaultValue={courses[0]?.id}>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title} · {lessons.filter((lesson) => lesson.course_id === course.id).length} buổi</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="clone-code">Mã khoá mới</label><input id="clone-code" name="code" required placeholder="BMDO K04" /></div>
        <div className="field"><label htmlFor="clone-title">Tên khoá</label><input id="clone-title" name="title" required /></div>
        <div className="field"><label htmlFor="clone-tagline">Dòng giới thiệu</label><input id="clone-tagline" name="tagline" placeholder="Để trống nếu dùng dòng của khoá nguồn" /></div>
        <button className="btn dark" type="submit">Sao chép khoá</button>
      </form>
      {courses.map((course) => {
        const rows = lessons.filter((lesson) => lesson.course_id === course.id);
        const suggested = course.management_code || courseManagementCode(course.code);
        return (
          <section key={course.id} style={{ marginTop: 18 }}>
            <div className="eyebrow">{suggested}</div>
            <h2 className="serif">{course.title}</h2>
            <form action={saveCourse} className="card">
              <input type="hidden" name="courseId" value={course.id} />
              <div className="field"><label>Mã khoá</label><input name="code" required defaultValue={course.code} /></div>
              <div className="field"><label>Mã quản trị</label><input name="managementCode" defaultValue={suggested} /></div>
              <div className="field"><label>Tên khoá</label><input name="title" required defaultValue={course.title} /></div>
              <div className="field"><label>Dòng giới thiệu</label><input name="tagline" defaultValue={course.tagline} /></div>
              <div className="field"><label>Giới thiệu</label><textarea name="intro" rows={4} defaultValue={course.intro} /></div>
              <button className="btn dark" type="submit">Lưu khoá</button>
            </form>
            <p className="muted" style={{ marginTop: 12 }}>{rows.length} buổi trong danh mục</p>
            {rows.map((lesson, index) => (
              <form key={lesson.id} action={updateCourseLesson} className="card" style={{ marginTop: 10 }}>
                <input type="hidden" name="lessonId" value={lesson.id} />
                <div className="user-line">
                  <strong>Buổi {String(lesson.number).padStart(2, "0")}</strong>
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
                  <div className="field"><label>Tên buổi</label><input name="title" required defaultValue={lesson.title} /></div>
                  <div className="field"><label>Framework</label><input name="framework" defaultValue={lesson.framework} /></div>
                  <div className="field"><label>Nhóm</label><input name="groupName" defaultValue={lesson.group_name} /></div>
                  <div className="field"><label>Tóm tắt</label><textarea name="summary" rows={2} defaultValue={lesson.summary} /></div>
                </div>
                <label className="muted"><input type="checkbox" name="archived" defaultChecked={lesson.archived === 1} /> Lưu trữ (giữ đường dẫn buổi đã có)</label>
                <div className="row-actions" style={{ marginTop: 8 }}>
                  <button className="btn dark" type="submit">Lưu buổi</button>
                </div>
              </form>
            ))}
            <form action={addCourseLesson} className="card" style={{ marginTop: 10 }}>
              <h3>Thêm buổi</h3>
              <input type="hidden" name="courseId" value={course.id} />
              <div className="grid-2">
                <div className="field"><label>Tên buổi</label><input name="title" required /></div>
                <div className="field"><label>Framework</label><input name="framework" /></div>
                <div className="field"><label>Nhóm</label><input name="groupName" placeholder="CATALOG" /></div>
                <div className="field"><label>Tóm tắt</label><textarea name="summary" rows={2} /></div>
              </div>
              <button className="btn" type="submit">Thêm vào danh mục</button>
            </form>
          </section>
        );
      })}
    </main>
  );
}
