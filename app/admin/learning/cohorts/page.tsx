import { api, q } from "@/lib/convex";
import { setLessonUnlock, setUnlockMode } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function CohortsPage() {
  const data = await q((convex, secret) => convex.query(api.reads.cohortsView, { secret }));
  const cohorts = data.cohorts;
  const lessons = data.lessons;
  return (
    <main>
      <h1 className="serif">Cohort và cách mở bài</h1>
      <p className="muted">All open: mọi bài mở. Sequential: xong bài trước mới mở bài sau. Scheduled: mở theo thời điểm admin đặt.</p>
      {cohorts.map((cohort) => (
        <section className="card" key={cohort.id} style={{ marginTop: 12 }}>
          <h2>{cohort.name}</h2>
          <p className="muted">{cohort.org} · Review {cohort.review_enabled ? "bật" : "tắt"} · Hiện tại: {cohort.unlock_mode}</p>
          <form className="row-actions" action={async (formData) => {
            "use server";
            await setUnlockMode(Number(formData.get("cohortId")), String(formData.get("mode")));
          }}>
            <input type="hidden" name="cohortId" value={cohort.id} />
            <select name="mode" defaultValue={cohort.unlock_mode} aria-label="Chế độ mở bài">
              <option value="all_open">All open</option>
              <option value="sequential">Sequential</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <button className="btn dark" type="submit">Lưu chế độ</button>
          </form>
          <form className="row-actions" style={{ marginTop: 10 }} action={async (formData) => {
            "use server";
            await setLessonUnlock(Number(formData.get("cohortId")), Number(formData.get("lessonId")), String(formData.get("unlockAt") || ""));
          }}>
            <input type="hidden" name="cohortId" value={cohort.id} />
            <select name="lessonId" aria-label="Bài học">{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{String(lesson.number).padStart(2, "0")} · {lesson.title}</option>)}</select>
            <input name="unlockAt" type="datetime-local" aria-label="Thời điểm mở" />
            <button className="btn" type="submit">Đặt lịch mở</button>
          </form>
        </section>
      ))}
    </main>
  );
}
