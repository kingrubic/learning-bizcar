import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/learn/login");
  if (user.mustChangePassword) redirect("/learn/password");
  return children;
}
