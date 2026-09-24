"use client";

import { useActionState } from "react";
import { createLearner, type CreateLearnerState } from "@/lib/admin-actions";

export function CreateLearnerForm({ cohorts }: { cohorts: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState(createLearner, {} as CreateLearnerState);
  return (
    <form action={action} className="card">
      <h2 className="serif">Cấp tài khoản học viên</h2>
      <div className="field"><label htmlFor="displayName">Họ và tên</label><input id="displayName" name="displayName" required /></div>
      <div className="field"><label htmlFor="username">Tên đăng nhập</label><input id="username" name="username" required autoComplete="off" /></div>
      <div className="field">
        <label htmlFor="cohortId">Cohort</label>
        <select id="cohortId" name="cohortId" required defaultValue="">
          <option value="" disabled>Chọn cohort</option>
          {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
        </select>
      </div>
      <button className="btn dark" type="submit" disabled={pending}>{pending ? "Đang tạo…" : "Tạo và ghi danh"}</button>
      {state.error && <p role="alert" style={{ color: "var(--red)" }}>{state.error}</p>}
      {state.temporaryPassword && <p role="status">Mật khẩu tạm cho @{state.username}: <strong>{state.temporaryPassword}</strong>. Học viên phải đổi ở lần đăng nhập đầu.</p>}
    </form>
  );
}
