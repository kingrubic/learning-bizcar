import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { cmsAnnouncements, cmsBlocks, cmsLessons } from "@/lib/cms";
import { saveAnnouncement, saveCmsBlocks, saveCmsLesson, setAnnouncementPublished } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  "dashboard.lede": "Lời dẫn bảng điều khiển",
  "login.story": "Đoạn mở trang đăng nhập",
  "login.tagline": "Câu tagline",
  "map.lede": "Lời dẫn bản đồ học",
};

export default async function CmsPage() {
  const actor = await getSession();
  if (!actor || actor.role !== "admin") redirect("/admin/learning");
  const blocks = await cmsBlocks();
  const news = await cmsAnnouncements("vi", true);
  const lessons = await cmsLessons();
  return (
    <main>
      <div className="eyebrow">CMS</div>
      <h1 className="serif">Nội dung hệ thống</h1>
      <p className="lede">Sửa chữ hai ngôn ngữ, đăng thông báo, và chỉnh tên từng buổi. Học viên thấy bản đã lưu ngay sau khi bấm lưu.</p>

      <section className="card" style={{ marginTop: 18 }}>
        <h2 className="serif">Trang</h2>
        <form action={saveCmsBlocks}>
          {blocks.map((block) => (
            <div className="field" key={`${block.key}-${block.locale}`}>
              <label>{labels[block.key] ?? block.key} · {block.locale === "vi" ? "Tiếng Việt" : "English"}</label>
              <input type="hidden" name="key" value={block.key} />
              <input type="hidden" name="locale" value={block.locale} />
              <textarea name="body" defaultValue={block.body} rows={3} />
            </div>
          ))}
          <button className="btn dark" type="submit">Lưu trang</button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2 className="serif">Thông báo</h2>
        <form action={saveAnnouncement} className="grid-2">
          <div className="field"><label htmlFor="title">Tiêu đề</label><input id="title" name="title" required /></div>
          <div className="field">
            <label htmlFor="locale">Ngôn ngữ</label>
            <select id="locale" name="locale"><option value="vi">Tiếng Việt</option><option value="en">English</option></select>
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="body">Nội dung</label><textarea id="body" name="body" rows={3} /></div>
          <button className="btn dark" type="submit">Đăng thông báo</button>
        </form>
        <div style={{ marginTop: 16 }}>
          {news.length === 0 && <p className="muted">Chưa có thông báo.</p>}
          {news.map((item) => (
            <form key={item.id} action={setAnnouncementPublished.bind(null, item.id, item.published !== 1)} className="user-line" style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
              <div>
                <strong>{item.title}</strong>
                <p className="muted" style={{ margin: "4px 0 0" }}>{item.locale === "vi" ? "Tiếng Việt" : "English"} · {item.published ? "Đang hiện" : "Đang ẩn"}</p>
              </div>
              <button className="btn" type="submit">{item.published ? "Ẩn" : "Hiện"}</button>
            </form>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        <h2 className="serif">Buổi học</h2>
        {lessons.map((lesson) => (
          <form key={lesson.number} action={saveCmsLesson} className="card" style={{ marginTop: 12 }}>
            <input type="hidden" name="number" value={lesson.number} />
            <div className="user-line">
              <h3 className="serif" style={{ margin: 0 }}>Buổi {String(lesson.number).padStart(2, "0")}</h3>
              <label className="muted"><input type="checkbox" name="published" defaultChecked={lesson.published === 1} /> Hiện trên bản đồ</label>
            </div>
            <div className="grid-2">
              <div className="field"><label>Tên tiếng Việt</label><input name="titleVi" defaultValue={lesson.title_vi} required /></div>
              <div className="field"><label>English title</label><input name="titleEn" defaultValue={lesson.title_en} required /></div>
              <div className="field"><label>Tóm tắt tiếng Việt</label><textarea name="summaryVi" defaultValue={lesson.summary_vi} rows={2} /></div>
              <div className="field"><label>English summary</label><textarea name="summaryEn" defaultValue={lesson.summary_en} rows={2} /></div>
            </div>
            <button className="btn dark" type="submit">Lưu buổi</button>
          </form>
        ))}
      </section>
    </main>
  );
}
