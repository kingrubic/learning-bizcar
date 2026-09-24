"use client";

import { useActionState, useState } from "react";
import { createAccount, type CreateAccountState } from "@/lib/admin-actions";

export function CreateUserForm({
  departments,
  groups,
}: {
  departments: { id: number; name: string }[];
  groups: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState(createAccount, {} as CreateAccountState);
  const [role, setRole] = useState("user");
  return (
    <form action={action} className="card" style={{ marginBottom: 16 }}>
      <h2 className="serif">Tạo tài khoản</h2>
      <p className="muted">Mật khẩu tạm được tạo tự động. Người dùng phải đổi ở lần đăng nhập đầu.</p>
      <div className="field"><label htmlFor="displayName">Họ và tên</label><input id="displayName" name="displayName" required autoComplete="off" /></div>
      <div className="field"><label htmlFor="username">Tên đăng nhập</label><input id="username" name="username" required autoComplete="off" /></div>
      <div className="field">
        <label htmlFor="role">Vai trò</label>
        <select id="role" name="role" value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="user">User</option>
          <option value="mod">Mod</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {role === "user" && (
        <>
          <div className="field">
            <label htmlFor="departmentId">Phòng ban</label>
            <select id="departmentId" name="departmentId" defaultValue="">
              <option value="">Chưa gắn phòng ban</option>
              {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="groupId">Nhóm quyền</label>
            <select id="groupId" name="groupId" defaultValue="">
              <option value="">Chưa có nhóm quyền</option>
              {groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        </>
      )}
      <button className="btn dark" type="submit" disabled={pending}>{pending ? "Đang tạo…" : "Tạo tài khoản"}</button>
      {state.error && <p role="alert" style={{ color: "var(--red)" }}>{state.error}</p>}
      {state.temporaryPassword && <p role="status">Mật khẩu tạm cho @{state.username}: <strong>{state.temporaryPassword}</strong>. Người dùng phải đổi ở lần đăng nhập đầu.</p>}
    </form>
  );
}
