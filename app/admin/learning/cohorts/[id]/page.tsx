import Link from "next/link";
import { notFound } from "next/navigation";
import { classPickerLabel } from "@/convex/codes";
import { api, q } from "@/lib/convex";
import { enrollLearner, unenrollLearner } from "@/lib/admin-actions";
import { CreateLearnerForm } from "@/components/admin/CreateLearnerForm";
import { getSession } from "@/lib/auth";
import { learningState } from "@/lib/access";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";
import { SelfEnroll } from "@/components/admin/SelfEnroll";
import { CohortForm } from "@/components/admin/CohortForm";

export const dynamic = "force-dynamic";

export default async function CohortDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; enroll?: string }>;
}) {
  const { id } = await params;
  const cohortId = Number(id);
  if (!Number.isInteger(cohortId) || cohortId <= 0) notFound();
  const query = await searchParams;
  const t = messages(await getLocale());
  const data = await q((convex, secret) => convex.query(api.reads.cohortsView, { secret }));
  const cohort = data.cohorts.find((item) => item.id === cohortId);
  if (!cohort) notFound();
  const course = data.courses.find((item) => item.id === cohort.course_id);
  const instructor = cohort.instructor;
  const members = data.enrollments.filter((row) => row.cohort_id === cohort.id);
  const openUsers = data.users.filter((item) => !members.some((member) => member.user_id === item.id));
  const lessonCount = new Set(cohort.sessions.flatMap((session) => session.lesson_ids)).size;
  const user = await getSession();
  const state = user?.role === "admin" ? await learningState(user.id) : null;
  const enrolled = (state?.enrollments ?? []).some((seat) => seat.cohort_id === cohort.id);
  const enrollNote = query.enroll === "enrolled" ? t.enrolledOk : query.enroll === "already" ? t.alreadyInCohort : query.enroll === "error" ? t.enrollFailed : query.enroll === "invalid" ? t.enrollInvalid : null;
  const label = classPickerLabel({ name: cohort.name, code: cohort.code, courseCode: course?.code });
  return (
    <main>
      <p className="row-actions"><Link className="btn" href="/admin/learning/cohorts">Danh sách lớp</Link></p>
      <div className="eyebrow">{instructor ? instructor.display_name : "Chưa gán giảng viên"}</div>
      <h1 className="serif">{label}</h1>
      <p className="muted">Buổi học là lịch của lớp: mỗi buổi có ngày và gồm nhiều bài học của khoá. Sửa lớp không đổi danh mục bài.</p>
      {query.error && <p className="notice"><strong>{query.error}</strong></p>}
      {enrollNote && <p className="notice"><strong>{enrollNote}</strong></p>}
      <CohortForm
        courses={data.courses}
        lessons={data.lessons}
        instructors={withCurrentInstructor(data.instructors, cohort.instructor)}
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
        <h3>Quản lý học viên</h3>
        <p className="muted">{cohort.org} · Review {cohort.review_enabled ? "bật" : "tắt"} · {cohort.sessions.length} buổi · {lessonCount} bài trong buổi. Thêm học viên vào đúng lớp này.</p>
        <CreateLearnerForm
          embedded
          cohortId={cohort.id}
          cohorts={[{ id: cohort.id, name: cohort.name, code: cohort.code, course_code: course?.code ?? "" }]}
        />
        <p style={{ marginTop: 16 }}><strong>Đang trong lớp</strong></p>
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
            <label className="muted" htmlFor={`enroll-${cohort.id}`}>Tài khoản đã có</label>
            <select id={`enroll-${cohort.id}`} name="userId" aria-label="Tài khoản đã có" defaultValue={openUsers[0]?.id}>
              {openUsers.map((item) => <option key={item.id} value={item.id}>{item.display_name} · @{item.username}</option>)}
            </select>
            <button className="btn dark" type="submit">Ghi danh vào lớp</button>
          </form>
        )}
        {user?.role === "admin" && (
          <SelfEnroll
            cohortId={cohort.id}
            cohortName={label}
            enrolled={enrolled}
            nextPath={`/admin/learning/cohorts/${cohort.id}`}
            variant="inline"
          />
        )}
      </div>
    </main>
  );
}

function withCurrentInstructor<T extends { id: number }>(instructors: T[], current: T | null) {
  if (!current || instructors.some((person) => person.id === current.id)) return instructors;
  return [current, ...instructors];
}
