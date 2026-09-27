"use client";

import { useActionState } from "react";
import { classPickerLabel } from "@/convex/codes";
import { createLearner, type CreateLearnerState } from "@/lib/admin-actions";

export type ClassOption = { id: number; name: string; code?: string; course_code?: string };

function labelOf(cohort: ClassOption) {
  return classPickerLabel({ name: cohort.name, code: cohort.code, courseCode: cohort.course_code });
}

export function CreateLearnerForm({
  cohorts,
  cohortId,
  embedded = false,
}: {
  cohorts: ClassOption[];
  /** Creates the learner in this class. The value is the cohort id. */
  cohortId?: number;
  embedded?: boolean;
}) {
  const [state, action, pending] = useActionState(createLearner, {} as CreateLearnerState);
  const locked = cohortId != null;
  const cohort = locked ? cohorts.find((item) => item.id === cohortId) : undefined;
  const suffix = locked ? String(cohortId) : "new";
  const canSubmit = locked ? Boolean(cohort) : cohorts.length > 0;
  return (
    <form action={action} className={embedded ? undefined : "card"}>
      {embedded ? <p><strong>Tài khoản mới</strong></p> : <h2 className="serif">Cấp tài khoản học viên</h2>}
      <div className="field"><label htmlFor={`displayName-${suffix}`}>Họ và tên</label><input id={`displayName-${suffix}`} name="displayName" required /></div>
      <div className="field"><label htmlFor={`username-${suffix}`}>Tên đăng nhập</label><input id={`username-${suffix}`} name="username" required autoComplete="off" /></div>
      {locked ? (
        <>
          <input type="hidden" name="cohortId" value={cohortId} />
          {cohort ? <p className="muted">Ghi danh vào lớp {labelOf(cohort)}.</p> : <p role="alert">Không thấy lớp này.</p>}
        </>
      ) : (
        <div className="field">
          <label htmlFor={`cohortId-${suffix}`}>Lớp học</label>
          <select id={`cohortId-${suffix}`} name="cohortId" required defaultValue="">
            <option value="" disabled>Chọn lớp</option>
            {cohorts.map((item) => <option key={item.id} value={item.id}>{labelOf(item)}</option>)}
          </select>
          <p className="muted">Danh sách là lớp học: mã LH- rồi tên lớp.</p>
        </div>
      )}
      {!locked && cohorts.length === 0 && <p role="alert">Chưa có lớp. Tạo lớp trước khi cấp tài khoản.</p>}
      <button className="btn dark" type="submit" disabled={pending || !canSubmit}>{pending ? "Đang tạo…" : "Tạo và ghi danh"}</button>
      {state.error && <p role="alert" style={{ color: "var(--red)" }}>{state.error}</p>}
      {state.temporaryPassword && <p role="status">Mật khẩu tạm cho @{state.username}: <strong>{state.temporaryPassword}</strong>. Học viên phải đổi ở lần đăng nhập đầu.</p>}
    </form>
  );
}
