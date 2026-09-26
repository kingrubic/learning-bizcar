"use client";

import { useState } from "react";
import { setAccountActive } from "@/lib/admin-actions";

export function LearnerControls({ id, active, role = "user" }: { id: number; active: boolean; role?: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<"" | "reset" | "delete">("");
  return (
    <div className="row-actions">
      <form action={setAccountActive.bind(null, id, !active)}>
        <button className="btn" type="submit">{active ? "Khóa" : "Mở khóa"}</button>
      </form>
      <button className="btn" type="button" disabled={pending !== ""} onClick={async () => {
        setPending("reset");
        const response = await fetch(`/api/admin/learners/${id}/reset`, { method: "POST" });
        const payload = await response.json() as { temporaryPassword?: string; error?: string };
        setPending("");
        setMessage(payload.temporaryPassword ? `Mật khẩu tạm: ${payload.temporaryPassword}` : payload.error || "Không reset được.");
      }}>{pending === "reset" ? "Đang cấp…" : "Reset mật khẩu"}</button>
      {role !== "admin" && <button className="btn" type="button" disabled={pending !== ""} onClick={async () => {
        if (!window.confirm("Xóa học viên này? Tài khoản, ghi danh, tiến độ và tư cách thành viên thảo luận sẽ bị xóa.")) return;
        setPending("delete");
        const response = await fetch(`/api/admin/learners/${id}`, { method: "DELETE" });
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setPending("");
        if (!response.ok) { setMessage(payload?.error || "Không xóa được."); return; }
        window.location.reload();
      }}>{pending === "delete" ? "Đang xóa…" : "Xóa"}</button>}
      {message && <span role="status">{message}</span>}
    </div>
  );
}
