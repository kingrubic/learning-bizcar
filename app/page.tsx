import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const user = await getSession();
  redirect(user ? "/learn/dashboard" : "/learn/login");
}
