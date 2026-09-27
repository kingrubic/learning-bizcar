"use client";

import { useRef, useState } from "react";
import { saveCohort } from "@/lib/admin-actions";

type Course = { id: number; code: string; title: string };
type Lesson = { id: number; course_id: number; number: number; title: string; archived: number };
type Person = { id: number; display_name: string; username: string; role: string; management_code: string };
type SessionDraft = { key: number; title: string; date: string; lessonIds: number[] };
type Defaults = {
  id: number;
  name: string;
  course_id: number;
  code: string;
  unlock_mode: string;
  instructor_id: number | null;
  sessions: { title: string; date: string; lesson_ids: number[] }[];
};

function initialSessions(defaults?: Defaults): SessionDraft[] {
  if (!defaults) return [{ key: 1, title: "Buổi 01", date: "", lessonIds: [] }];
  return defaults.sessions.map((session, index) => ({
    key: index + 1,
    title: session.title,
    date: session.date,
    lessonIds: session.lesson_ids,
  }));
}

export function CohortForm({
  courses,
  lessons,
  instructors,
  defaults,
}: {
  courses: Course[];
  lessons: Lesson[];
  instructors: Person[];
  defaults?: Defaults;
}) {
  const formKey = defaults?.id ?? "new";
  const [courseId, setCourseId] = useState(defaults?.course_id ?? courses[0]?.id ?? 0);
  const [sessions, setSessions] = useState<SessionDraft[]>(() => initialSessions(defaults));
  const [instructorId, setInstructorId] = useState<number | "">(defaults ? (defaults.instructor_id ?? "") : (instructors[0]?.id ?? ""));
  const nextKey = useRef((defaults?.sessions.length ?? 1) + 1);
  const catalog = lessons.filter((lesson) => lesson.course_id === courseId && (lesson.archived !== 1 || sessions.some((session) => session.lessonIds.includes(lesson.id))));
  const instructor = instructors.find((person) => person.id === instructorId);
  const payload = JSON.stringify(sessions.map(({ title, date, lessonIds }) => ({ title, date, lessonIds })));

  function onCourse(next: number) {
    setCourseId(next);
    const allowed = new Set(lessons.filter((lesson) => lesson.course_id === next).map((lesson) => lesson.id));
    setSessions((current) => current.map((session) => ({ ...session, lessonIds: session.lessonIds.filter((id) => allowed.has(id)) })));
  }

  function patch(key: number, update: Partial<SessionDraft>) {
    setSessions((current) => current.map((session) => session.key === key ? { ...session, ...update } : session));
  }

  function toggleLesson(key: number, lessonId: number, checked: boolean) {
    setSessions((current) => current.map((session) => {
      if (session.key !== key) return session;
      const lessonIds = checked ? [...session.lessonIds, lessonId] : session.lessonIds.filter((id) => id !== lessonId);
      return { ...session, lessonIds };
    }));
  }

  function move(index: number, direction: -1 | 1) {
    setSessions((current) => {
      const next = [...current];
      const swap = index + direction;
      if (swap < 0 || swap >= next.length) return current;
      const [row] = next.splice(index, 1);
      next.splice(swap, 0, row);
      return next;
    });
  }

  return (
    <form action={saveCohort} className="card" style={{ marginTop: 12 }}>
      <h2>{defaults ? "Sửa lớp" : "Tạo lớp mới"}</h2>
      {defaults && <input type="hidden" name="cohortId" value={defaults.id} />}
      <input type="hidden" name="sessions" value={payload} />
      <div className="field"><label htmlFor={`name-${formKey}`}>Tên lớp</label><input id={`name-${formKey}`} name="name" required defaultValue={defaults?.name ?? ""} placeholder="BMDO K04 · Lớp 01" /></div>
      <div className="field">
        <label htmlFor={`course-${formKey}`}>Khoá học</label>
        <select id={`course-${formKey}`} name="courseId" required value={courseId} onChange={(event) => onCourse(Number(event.target.value))}>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`code-${formKey}`}>Mã lớp</label>
        <input id={`code-${formKey}`} name="code" defaultValue={defaults?.code ?? ""} placeholder="Để trống để tạo LH-…" />
      </div>
      <div className="field">
        <label htmlFor={`instructor-${formKey}`}>Giảng viên</label>
        <select id={`instructor-${formKey}`} name="instructorId" required value={instructorId || ""} onChange={(event) => setInstructorId(Number(event.target.value))}>
          <option value="" disabled>Chọn một tài khoản</option>
          {instructors.map((person) => <option key={person.id} value={person.id}>{person.display_name} · @{person.username} · {person.role}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`instructor-code-${formKey}`}>Mã giảng viên</label>
        <input id={`instructor-code-${formKey}`} name="instructorCode" placeholder={instructor?.management_code || "Để trống để tạo GV-…"} />
      </div>
      <div className="field">
        <label htmlFor={`mode-${formKey}`}>Cách mở buổi</label>
        <select id={`mode-${formKey}`} name="mode" defaultValue={defaults?.unlock_mode ?? "sequential"}>
          <option value="all_open">Mở tất cả buổi</option>
          <option value="sequential">Tuần tự — buổi sau mở khi mọi bài của buổi trước đã hoàn thành</option>
          <option value="scheduled">Theo lịch — buổi mở từ 00:00 ngày đã chọn (giờ Việt Nam)</option>
        </select>
        <p className="muted">Buổi không có ngày thì khoá khi chọn theo lịch. Bài học mở khi có ít nhất một buổi chứa bài đó đã mở.</p>
      </div>
      <fieldset className="field">
        <legend>Buổi học</legend>
        <p className="muted">Mỗi buổi có ngày (không bắt buộc) và nhiều bài học của khoá. Lớp không thêm, xoá hay sửa danh mục bài.</p>
        {catalog.length === 0 && <p className="muted">Khoá này chưa có bài học.</p>}
        {sessions.map((session, index) => (
          <div key={session.key} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            <div className="user-line">
              <strong>Buổi {String(index + 1).padStart(2, "0")}</strong>
              <span className="row-actions">
                {index > 0 && <button className="btn" type="button" onClick={() => move(index, -1)}>Lên</button>}
                {index < sessions.length - 1 && <button className="btn" type="button" onClick={() => move(index, 1)}>Xuống</button>}
                <button className="btn" type="button" onClick={() => setSessions((current) => current.filter((item) => item.key !== session.key))}>Xóa buổi</button>
              </span>
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor={`session-title-${formKey}-${session.key}`}>Tên buổi</label>
                <input id={`session-title-${formKey}-${session.key}`} value={session.title} onChange={(event) => patch(session.key, { title: event.target.value })} placeholder={`Buổi ${String(index + 1).padStart(2, "0")}`} />
              </div>
              <div className="field">
                <label htmlFor={`session-date-${formKey}-${session.key}`}>Ngày buổi</label>
                <input id={`session-date-${formKey}-${session.key}`} type="date" value={session.date} onChange={(event) => patch(session.key, { date: event.target.value })} />
              </div>
            </div>
            <div className="field">
              <span style={{ fontSize: 12, fontWeight: 800 }}>Bài học trong buổi</span>
              {session.lessonIds.length === 0 && <p className="muted">Chưa chọn bài. Mỗi buổi cần ít nhất một bài của khoá.</p>}
              <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: "4px 10px" }}>
                {catalog.map((lesson) => (
                  <label key={lesson.id} style={{ display: "block", margin: "6px 0" }}>
                    <input
                      type="checkbox"
                      checked={session.lessonIds.includes(lesson.id)}
                      onChange={(event) => toggleLesson(session.key, lesson.id, event.target.checked)}
                    />
                    {" "}Bài {String(lesson.number).padStart(2, "0")} · {lesson.title}{lesson.archived === 1 ? " · lưu trữ" : ""}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}
        <button
          className="btn"
          type="button"
          style={{ marginTop: 12 }}
          onClick={() => {
            const key = nextKey.current;
            nextKey.current += 1;
            setSessions((current) => [...current, { key, title: `Buổi ${String(current.length + 1).padStart(2, "0")}`, date: "", lessonIds: [] }]);
          }}
        >
          Thêm buổi
        </button>
      </fieldset>
      <button className="btn dark" type="submit">{defaults ? "Lưu lớp" : "Tạo lớp"}</button>
    </form>
  );
}
