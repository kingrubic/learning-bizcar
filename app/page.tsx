import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loginDestination } from "@/lib/password-gate";

export default async function HomePage() {
  const user = await getSession();
  redirect(user ? loginDestination(user.mustChangePassword, user.role) : "/learn/login");
}
