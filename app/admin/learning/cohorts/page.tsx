import Link from "next/link";
import { api, q } from "@/lib/convex";
import { enrollLearner, unenrollLearner } from "@/lib/admin-actions";
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
  const instructors = data.instructors;
  const roster = data.enrollments;
  const user = await getSession();
  const state = user?.role === "admin" ? await learningState(user.id) : null;
  const enrolledIds = new Set((state?.enrollments ?? []).map((seat) => seat.cohort_id));
  const enrollNote = params.enroll === "enrolled" ? t.enrolledOk : params.enroll === "already" ? t.alreadyInCohort : params.enroll === "error" ? t.enrollFailed : params.enroll === "invalid" ? t.enrollInvalid : null;
  return (
    <main>
      <h1 className="serif">Lớp học</h1>
      <p className="muted">Mỗi lớp thuộc một khoá và một giảng viên. Buổi học là lịch của lớp: mỗi buổi có ngày và gồm nhiều bài học của khoá. Sửa lớp không đổi danh mục bài.</p>
      <p className="row-actions"><Link className="btn dark" href="/admin/learning/discussion">{t.menu["admin-discussion"]}</Link></p>
      {error && <p className="notice"><strong>{error}</strong></p>}
      {enrollNote && <p className="notice"><strong>{enrollNote}</strong></p>}
      <CohortForm courses={courses} lessons={lessons} instructors={instructors} />
      {cohorts.map((cohort) => {
        const course = courses.find((item) => item.id === cohort.course_id);
        const members = roster.filter((row) => row.cohort_id === cohort.id);
        const instructor = cohort.instructor;
        const openUsers = users.filter((item) => !members.some((member) => member.user_id === item.id));
        const lessonCount = new Set(cohort.sessions.flatMap((session) => session.lesson_ids)).size;
        return (
          <section key={cohort.id} style={{ marginTop: 18 }}>
            <div className="eyebrow">{cohort.code || "Chưa có mã"} · {course?.code ?? "Khoá"} · {instructor ? instructor.display_name : "Chưa gán giảng viên"}</div>
            <CohortForm
              courses={courses}
              lessons={lessons}
              instructors={withCurrentInstructor(instructors, cohort.instructor)}
              defaults={{
                id: cohort.id,
                name: cohort.name,
                course_id: cohort.course_id,
                code: cohort.code,
                unlock_mode: cohort.unlock_mode,
                instructor_id: cohort.instructor_id,
                sessions: cohort.sessions.map((session) => ({
                  title: session.title,
                  date: session.session_date,
                  lesson_ids: session.lesson_ids,
                })),
              }}
            />
            <div className="card" style={{ marginTop: 12 }}>
              <p className="muted">{cohort.org} · Review {cohort.review_enabled ? "bật" : "tắt"} · {cohort.sessions.length} buổi · {lessonCount} bài trong buổi</p>
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

function withCurrentInstructor<T extends { id: number }>(instructors: T[], current: T | null) {
  if (!current || instructors.some((person) => person.id === current.id)) return instructors;
  return [current, ...instructors];
}
