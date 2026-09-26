import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { requiresPasswordChange } from "@/lib/password-gate";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/learn/login");
  if (requiresPasswordChange(user.mustChangePassword)) redirect("/learn/password");
  return children;
}
