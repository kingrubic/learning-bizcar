"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      className="btn"
      type="button"
      onClick={async () => {
        await fetch("/api/auth/login", { method: "DELETE" });
        router.push("/learn/login");
        router.refresh();
      }}
    >{label}</button>
  );
}
