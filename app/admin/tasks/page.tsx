import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { api, q } from "@/lib/convex";
import { canSee } from "@/lib/permissions";
import { createTask } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminTasksPage() {
  const actor = await getSession();
  if (!actor || !(await canSee(actor, "admin-tasks"))) redirect("/learn/dashboard");
  const board = await q((convex, secret) => convex.query(api.reads.taskBoard, { secret, exceptUserId: actor.id }));
  const people = board.people;
  const tasks = board.tasks;
  return (
    <main className="grid-2">
      <form action={createTask} className="card">
        <h1 className="serif">Giao nhiệm vụ</h1>
        <p className="muted">Admin và Mod giao việc cho bất kỳ người dùng nào. User chỉ thấy nhiệm vụ của mình.</p>
        <div className="field"><label htmlFor="title">Việc cần làm</label><input id="title" name="title" required /></div>
        <div className="field"><label htmlFor="body">Nội dung</label><textarea id="body" name="body" /></div>
        <div className="field">
          <label htmlFor="assigneeId">Giao cho</label>
          <select id="assigneeId" name="assigneeId" required defaultValue="">
            <option value="" disabled>Chọn người</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.display_name} · {person.role}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="dueAt">Hạn</label><input id="dueAt" name="dueAt" type="date" /></div>
        <button className="btn dark" type="submit">Tạo nhiệm vụ</button>
      </form>
      <div>
        {tasks.map((task) => (
          <article key={task.created_at + task.title} className="card" style={{ marginBottom: 10 }}>
            <div className="eyebrow">{task.status} · {task.assignee}</div>
            <h2>{task.title}</h2>
            <p>{task.body}</p>
            <p className="muted">Giao bởi {task.author}{task.due_at ? ` · hạn ${task.due_at}` : ""}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
