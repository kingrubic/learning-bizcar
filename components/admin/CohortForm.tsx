"use client";

import { useState } from "react";
import { saveCohort } from "@/lib/admin-actions";

type Course = { id: number; code: string; title: string };
type Lesson = { id: number; course_id: number; number: number; title: string; archived: number };
type Person = { id: number; display_name: string; username: string; role: string; management_code: string };
type Defaults = {
  id: number;
  name: string;
  course_id: number;
  code: string;
  unlock_mode: string;
  instructor_id: number | null;
  lesson_ids: number[];
};

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
  const [courseId, setCourseId] = useState(defaults?.course_id ?? courses[0]?.id ?? 0);
  const [checked, setChecked] = useState<number[]>(() => {
    if (defaults) return defaults.lesson_ids;
    return lessons.filter((lesson) => lesson.course_id === (courses[0]?.id ?? 0) && lesson.archived !== 1).map((lesson) => lesson.id);
  });
  const [instructorId, setInstructorId] = useState<number | "">(defaults ? (defaults.instructor_id ?? "") : (instructors[0]?.id ?? ""));
  const catalog = lessons.filter((lesson) => lesson.course_id === courseId && (lesson.archived !== 1 || checked.includes(lesson.id)));
  const instructor = instructors.find((person) => person.id === instructorId);

  function onCourse(next: number) {
    setCourseId(next);
    setChecked(lessons.filter((lesson) => lesson.course_id === next && lesson.archived !== 1).map((lesson) => lesson.id));
  }

  return (
    <form action={saveCohort} className="card" style={{ marginTop: 12 }}>
      <h2>{defaults ? "Sửa lớp" : "Tạo lớp mới"}</h2>
      {defaults && <input type="hidden" name="cohortId" value={defaults.id} />}
      <div className="field"><label htmlFor={`name-${defaults?.id ?? "new"}`}>Tên lớp</label><input id={`name-${defaults?.id ?? "new"}`} name="name" required defaultValue={defaults?.name ?? ""} placeholder="BMDO K04 · Lớp 01" /></div>
      <div className="field">
        <label htmlFor={`course-${defaults?.id ?? "new"}`}>Khoá học</label>
        <select id={`course-${defaults?.id ?? "new"}`} name="courseId" required value={courseId} onChange={(event) => onCourse(Number(event.target.value))}>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`code-${defaults?.id ?? "new"}`}>Mã lớp</label>
        <input id={`code-${defaults?.id ?? "new"}`} name="code" defaultValue={defaults?.code ?? ""} placeholder="Để trống để tạo LH-…" />
      </div>
      <div className="field">
        <label htmlFor={`instructor-${defaults?.id ?? "new"}`}>Giảng viên</label>
        <select id={`instructor-${defaults?.id ?? "new"}`} name="instructorId" required value={instructorId || ""} onChange={(event) => setInstructorId(Number(event.target.value))}>
          <option value="" disabled>Chọn một tài khoản</option>
          {instructors.map((person) => <option key={person.id} value={person.id}>{person.display_name} · @{person.username} · {person.role}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`instructor-code-${defaults?.id ?? "new"}`}>Mã giảng viên</label>
        <input id={`instructor-code-${defaults?.id ?? "new"}`} name="instructorCode" placeholder={instructor?.management_code || "Để trống để tạo GV-…"} />
      </div>
      <div className="field">
        <label htmlFor={`mode-${defaults?.id ?? "new"}`}>Cách mở bài</label>
        <select id={`mode-${defaults?.id ?? "new"}`} name="mode" defaultValue={defaults?.unlock_mode ?? "sequential"}>
          <option value="all_open">Mở tất cả</option>
          <option value="sequential">Tuần tự — xong buổi trước mới mở buổi sau</option>
          <option value="scheduled">Theo lịch</option>
        </select>
      </div>
      <fieldset className="field">
        <legend>Buổi trong lớp</legend>
        <p className="muted">Chọn tập con danh mục của khoá. Nội dung buổi vẫn nằm ở khoá, không sao chép.</p>
        {catalog.map((lesson) => (
          <label key={lesson.id} style={{ display: "block", marginTop: 6 }}>
            <input
              type="checkbox"
              name="lessonIds"
              value={lesson.id}
              checked={checked.includes(lesson.id)}
              onChange={(event) => setChecked((current) => event.target.checked ? [...current, lesson.id] : current.filter((id) => id !== lesson.id))}
            />
            {" "}{String(lesson.number).padStart(2, "0")} · {lesson.title}{lesson.archived === 1 ? " · lưu trữ" : ""}
          </label>
        ))}
      </fieldset>
      <button className="btn dark" type="submit">{defaults ? "Lưu lớp" : "Tạo lớp"}</button>
    </form>
  );
}
