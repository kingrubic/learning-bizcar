import Link from "next/link";
import { api, q } from "@/lib/convex";
import { enrollLearner, setLessonUnlock, setUnlockMode, unenrollLearner } from "@/lib/admin-actions";
import { getSession } from "@/lib/auth";
import { learningState } from "@/lib/access";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";
import { SelfEnroll } from "@/components/admin/SelfEnroll";
import { CohortForm } from "@/components/admin/CohortForm";

export const dynamic = "force-dynamic";

export default async function CohortsPage({ searchParams }: { searchParams: Promise<{ error?: string; enroll?: string }> }) {
  const params = await searchParams;
  const error = params.error;
  const t = messages(await getLocale());
  const data = await q((convex, secret) => convex.query(api.reads.cohortsView, { secret }));
  const cohorts = data.cohorts;
  const lessons = data.lessons;
  const courses = data.courses;
  const users = data.users;
  const roster = data.enrollments;
  const user = await getSession();
  const state = user?.role === "admin" ? await learningState(user.id) : null;
  const enrolledIds = new Set((state?.enrollments ?? []).map((seat) => seat.cohort_id));
  const enrollNote = params.enroll === "enrolled" ? t.enrolledOk : params.enroll === "already" ? t.alreadyInCohort : params.enroll === "error" ? t.enrollFailed : params.enroll === "invalid" ? t.enrollInvalid : null;
  return (
    <main>
      <h1 className="serif">Lớp học</h1>
      <p className="muted">Mỗi lớp thuộc một khoá, một giảng viên và một mã lớp. Buổi học của lớp là tập con bài học của khoá, cùng lịch mở buổi.</p>
      <p className="row-actions"><Link className="btn dark" href="/admin/learning/discussion">{t.menu["admin-discussion"]}</Link></p>
      {error && <p className="notice"><strong>{error}</strong></p>}
      {enrollNote && <p className="notice"><strong>{enrollNote}</strong></p>}
      <CohortForm courses={courses} lessons={lessons} instructors={users} />
      {cohorts.map((cohort) => {
        const course = courses.find((item) => item.id === cohort.course_id);
        const courseLessons = lessons.filter((lesson) => lesson.course_id === cohort.course_id && (cohort.lesson_ids.includes(lesson.id) || lesson.archived !== 1));
        const members = roster.filter((row) => row.cohort_id === cohort.id);
        const instructor = users.find((item) => item.id === cohort.instructor_id);
        const openUsers = users.filter((item) => !members.some((member) => member.user_id === item.id));
        return (
          <section key={cohort.id} style={{ marginTop: 18 }}>
            <div className="eyebrow">{cohort.code || "Chưa có mã"} · {course?.code ?? "Khoá"} · {instructor ? instructor.display_name : "Chưa gán giảng viên"}</div>
            <CohortForm
              courses={courses}
              lessons={lessons}
              instructors={users}
              defaults={{
                id: cohort.id,
                name: cohort.name,
                course_id: cohort.course_id,
                code: cohort.code,
                unlock_mode: cohort.unlock_mode,
                instructor_id: cohort.instructor_id,
                lesson_ids: cohort.lesson_ids,
              }}
            />
            <div className="card" style={{ marginTop: 12 }}>
              <p className="muted">{cohort.org} · Review {cohort.review_enabled ? "bật" : "tắt"} · {cohort.lesson_ids.length} buổi học</p>
              <h3>Lịch mở buổi</h3>
              <form className="row-actions" action={async (formData) => {
                "use server";
                await setUnlockMode(Number(formData.get("cohortId")), String(formData.get("mode")));
              }}>
                <input type="hidden" name="cohortId" value={cohort.id} />
                <select name="mode" defaultValue={cohort.unlock_mode} aria-label="Chế độ mở buổi">
                  <option value="all_open">Mở tất cả buổi</option>
                  <option value="sequential">Tuần tự</option>
                  <option value="scheduled">Theo lịch</option>
                </select>
                <button className="btn dark" type="submit">Lưu chế độ</button>
              </form>
              <form className="row-actions" style={{ marginTop: 10 }} action={async (formData) => {
                "use server";
                await setLessonUnlock(Number(formData.get("cohortId")), Number(formData.get("lessonId")), String(formData.get("unlockAt") || ""));
              }}>
                <input type="hidden" name="cohortId" value={cohort.id} />
                <select name="lessonId" aria-label="Buổi học">{courseLessons.filter((lesson) => cohort.lesson_ids.includes(lesson.id)).map((lesson) => <option key={lesson.id} value={lesson.id}>Bài {String(lesson.number).padStart(2, "0")} · {lesson.title}</option>)}</select>
                <input name="unlockAt" type="datetime-local" aria-label="Thời điểm mở buổi" />
                <button className="btn" type="submit">Đặt lịch mở buổi</button>
              </form>
              <h3>Học viên của lớp</h3>
              {members.length === 0 && <p className="muted">Chưa có học viên.</p>}
              {members.map((member) => (
                <form key={member.user_id} action={unenrollLearner} className="user-line" style={{ marginTop: 8 }}>
                  <span>{member.display_name} · @{member.username} · {member.management_code || "chưa có mã"}</span>
                  <input type="hidden" name="cohortId" value={cohort.id} />
                  <input type="hidden" name="userId" value={member.user_id} />
                  <button className="btn" type="submit">Gỡ khỏi lớp</button>
                </form>
              ))}
              {openUsers.length > 0 && (
                <form action={enrollLearner} className="row-actions" style={{ marginTop: 12 }}>
                  <input type="hidden" name="cohortId" value={cohort.id} />
                  <select name="userId" aria-label="Học viên" defaultValue={openUsers[0]?.id}>
                    {openUsers.map((item) => <option key={item.id} value={item.id}>{item.display_name} · @{item.username}</option>)}
                  </select>
                  <button className="btn dark" type="submit">Ghi danh</button>
                </form>
              )}
              {user?.role === "admin" && (
                <SelfEnroll
                  cohortId={cohort.id}
                  cohortName={cohort.name}
                  enrolled={enrolledIds.has(cohort.id)}
                  nextPath="/admin/learning/cohorts"
                  variant="inline"
                />
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}
