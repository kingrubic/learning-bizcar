import Link from "next/link";
import { api, q } from "@/lib/convex";
import { createCohort, setLessonUnlock, setUnlockMode } from "@/lib/admin-actions";
import { getSession } from "@/lib/auth";
import { enrollmentFor } from "@/lib/access";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";
import { SelfEnroll } from "@/components/admin/SelfEnroll";

export const dynamic = "force-dynamic";

export default async function CohortsPage({ searchParams }: { searchParams: Promise<{ error?: string; enroll?: string }> }) {
  const params = await searchParams;
  const error = params.error;
  const t = messages(await getLocale());
  const data = await q((convex, secret) => convex.query(api.reads.cohortsView, { secret }));
  const cohorts = data.cohorts;
  const lessons = data.lessons;
  const courses = data.courses;
  const user = await getSession();
  const enrollment = user?.role === "admin" ? await enrollmentFor(user.id) : undefined;
  const enrollNote = params.enroll === "enrolled" ? t.enrolledOk : params.enroll === "error" ? t.enrollFailed : params.enroll === "invalid" ? t.enrollInvalid : null;
  return (
    <main>
      <h1 className="serif">Lớp học</h1>
      <p className="muted">Lớp mới dùng chung bài của khoá đã chọn. Bài làm của học viên lớp cũ không được chép sang.</p>
      <p className="row-actions"><Link className="btn dark" href="/admin/learning/discussion">{t.menu["admin-discussion"]}</Link></p>
      {error && <p className="notice"><strong>{error}</strong></p>}
      {enrollNote && <p className="notice"><strong>{enrollNote}</strong></p>}
      {user?.role === "admin" && enrollment?.member_role === "learner" && (
        <p className="notice">
          <strong>{t.alreadyInCohort}</strong>
          <span>{enrollment.cohort_name}</span>
          <Link className="btn gold" href="/learn/dashboard">{t.openLearner}</Link>
        </p>
      )}
      {user?.role === "admin" && !enrollment && <p className="muted">{t.joinCohortHint}</p>}
      <form action={createCohort} className="card" style={{ marginTop: 12 }}>
        <h2>Tạo lớp mới</h2>
        <div className="field"><label htmlFor="name">Tên lớp</label><input id="name" name="name" required placeholder="BMDO K04 · Cohort 01" /></div>
        <div className="field">
          <label htmlFor="courseId">Khoá</label>
          <select id="courseId" name="courseId" required defaultValue={courses[0]?.id}>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="mode">Cách mở bài</label>
          <select id="mode" name="mode" defaultValue="sequential">
            <option value="all_open">All open — mọi bài mở</option>
            <option value="sequential">Sequential — xong bài trước mới mở bài sau</option>
            <option value="scheduled">Scheduled — mở theo thời điểm admin đặt</option>
          </select>
        </div>
        <button className="btn dark" type="submit">Tạo lớp</button>
      </form>
      {cohorts.map((cohort) => {
        const course = courses.find((item) => item.id === cohort.course_id);
        const courseLessons = lessons.filter((lesson) => lesson.course_id === cohort.course_id);
        return (
          <section className="card" key={cohort.id} style={{ marginTop: 12 }}>
            <h2>{cohort.name}</h2>
            <p className="muted">{course?.code ?? "Khoá"} · {cohort.org} · Review {cohort.review_enabled ? "bật" : "tắt"} · Hiện tại: {cohort.unlock_mode}</p>
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
              <select name="lessonId" aria-label="Bài học">{courseLessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{String(lesson.number).padStart(2, "0")} · {lesson.title}</option>)}</select>
              <input name="unlockAt" type="datetime-local" aria-label="Thời điểm mở" />
              <button className="btn" type="submit">Đặt lịch mở</button>
            </form>
            {user?.role === "admin" && (
              <SelfEnroll
                cohortId={cohort.id}
                cohortName={cohort.name}
                enrollment={enrollment ?? null}
                nextPath="/admin/learning/cohorts"
                variant="inline"
              />
            )}
          </section>
        );
      })}
    </main>
  );
}
