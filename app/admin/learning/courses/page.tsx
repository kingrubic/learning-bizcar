import { api, q } from "@/lib/convex";
import { cloneCourse } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const error = (await searchParams).error;
  const data = await q((convex, secret) => convex.query(api.reads.cohortsView, { secret }));
  const courses = data.courses;
  const lessons = data.lessons;
  return (
    <main>
      <h1 className="serif">Chương trình</h1>
      <p className="muted">Khoá mới nhận bản sao 27 bài từ khoá nguồn: cùng nội dung tương tác, bài làm học viên không đi theo. Sau đó tạo lớp cho khoá mới ở mục Lớp học.</p>
      {error && <p className="notice"><strong>{error}</strong></p>}
      <form action={cloneCourse} className="card" style={{ marginTop: 12 }}>
        <h2>Tạo khoá từ khoá có sẵn</h2>
        <div className="field">
          <label htmlFor="sourceCourseId">Khoá nguồn</label>
          <select id="sourceCourseId" name="sourceCourseId" required defaultValue={courses[0]?.id}>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="code">Mã khoá mới</label><input id="code" name="code" required placeholder="BMDO K04" /></div>
        <div className="field"><label htmlFor="title">Tên khoá</label><input id="title" name="title" required placeholder="BizCar Management Design" /></div>
        <div className="field"><label htmlFor="tagline">Mô tả ngắn</label><input id="tagline" name="tagline" placeholder="Để trống nếu dùng mô tả của khoá nguồn" /></div>
        <button className="btn dark" type="submit">Tạo khoá</button>
      </form>
      {courses.map((course) => {
        const rows = lessons.filter((lesson) => lesson.course_id === course.id);
        return (
          <section key={course.id} style={{ marginTop: 18 }}>
            <div className="eyebrow">{course.code}</div>
            <h2 className="serif">{course.title}</h2>
            <p className="muted">{course.tagline} · {rows.length} bài</p>
            <div className="table-wrap card" style={{ padding: 0 }}>
              <table>
                <thead><tr><th>#</th><th>Framework</th><th>Bài</th><th>Nhóm</th><th>Content</th><th>Schema</th><th>Report</th></tr></thead>
                <tbody>
                  {rows.map((lesson) => (
                    <tr key={lesson.id}>
                      <td>{String(lesson.number).padStart(2, "0")}</td>
                      <td>{lesson.framework}</td>
                      <td>{lesson.title}</td>
                      <td>{lesson.group_name}</td>
                      <td>{lesson.content_version}</td>
                      <td>{lesson.schema_version}</td>
                      <td>{lesson.has_report ? "Có" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </main>
  );
}
