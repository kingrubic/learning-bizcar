"use client";

import { useState } from "react";
import { setAccountActive } from "@/lib/admin-actions";

export function LearnerControls({ id, active }: { id: number; active: boolean }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="row-actions">
      <form action={setAccountActive.bind(null, id, !active)}>
        <button className="btn" type="submit">{active ? "Khóa" : "Mở khóa"}</button>
      </form>
      <button className="btn" type="button" disabled={pending} onClick={async () => {
        setPending(true);
        const response = await fetch(`/api/admin/learners/${id}/reset`, { method: "POST" });
        const payload = await response.json() as { temporaryPassword?: string; error?: string };
        setPending(false);
        setMessage(payload.temporaryPassword ? `Mật khẩu tạm: ${payload.temporaryPassword}` : payload.error || "Không reset được.");
      }}>{pending ? "Đang cấp…" : "Reset mật khẩu"}</button>
      {message && <span role="status">{message}</span>}
    </div>
  );
}
