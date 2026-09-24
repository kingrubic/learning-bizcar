import { api, q } from "@/lib/convex";
import { COURSE } from "@/lib/course";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const data = await q((convex, secret) => convex.query(api.reads.cohortsView, { secret }));
  const lessons = data.lessons;
  return (
    <main>
      <div className="eyebrow">{COURSE.code}</div>
      <h1 className="serif">{COURSE.title}</h1>
      <p className="muted">{COURSE.tagline} Nội dung học thuật lấy từ gói tương tác gốc, phiên bản được ghi trên từng bài.</p>
      <div className="table-wrap card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>#</th><th>Framework</th><th>Bài</th><th>Nhóm</th><th>Content</th><th>Schema</th><th>Report</th></tr></thead>
          <tbody>
            {lessons.map((lesson) => (
              <tr key={lesson.number}>
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
    </main>
  );
}
