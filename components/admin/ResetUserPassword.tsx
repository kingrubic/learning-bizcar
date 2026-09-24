"use client";

import { useState } from "react";
import { resetPassword } from "@/lib/admin-actions";

export function ResetUserPassword({ userId }: { userId: number }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="row-actions">
      <button
        className="btn"
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setMessage("");
          try {
            const temporaryPassword = await resetPassword(userId);
            setMessage(`Mật khẩu tạm: ${temporaryPassword}. Lần đăng nhập sau phải đổi mật khẩu.`);
          } catch {
            setMessage("Không đặt lại được mật khẩu.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Đang cấp…" : "Đặt mật khẩu tạm"}
      </button>
      {message && <span role="status">{message}</span>}
    </div>
  );
}
