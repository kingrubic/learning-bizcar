import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { api, q } from "@/lib/convex";
import { canSee } from "@/lib/permissions";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function MyTasksPage() {
  const user = await getSession();
  if (!user || !(await canSee(user, "tasks"))) redirect("/learn/profile");
  const t = messages(await getLocale());
  const tasks = await q((convex, secret) => convex.query(api.reads.myTasks, { secret, userId: user.id }));
  return (
    <main className="page">
      <div className="eyebrow">{t.tasksEyebrow}</div>
      <h1 className="serif">{t.tasksTitle}</h1>
      {tasks.length === 0 && <p className="muted">{t.noTasks}</p>}
      {tasks.map((task) => (
        <article key={task.id} className="card" style={{ marginTop: 12 }}>
          <div className="eyebrow">{t.status[task.status as keyof typeof t.status] ?? task.status}{task.due_at ? ` · ${t.due} ${task.due_at}` : ""}</div>
          <h2>{task.title}</h2>
          <p>{task.body}</p>
          <p className="muted">{t.from} {task.author}</p>
        </article>
      ))}
    </main>
  );
}
