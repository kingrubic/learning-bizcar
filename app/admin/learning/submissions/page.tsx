import { api, q } from "@/lib/convex";
import { getSession } from "@/lib/auth";
import { addFeedback } from "@/lib/admin-actions";
import { WORKBOOK, readPath } from "@/lib/course";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const user = await getSession();
  void user;
  const rows = await q((convex, secret) => convex.query(api.reads.submissionsView, { secret }));
  return (
    <main>
      <h1 className="serif">Bài nộp và phản hồi</h1>
      <p className="muted">Ảnh chụp lúc nộp không bị ghi đè khi học viên sửa tiếp. Phản hồi nằm riêng.</p>
      {rows.length === 0 && <p>Chưa có bài nộp.</p>}
      {rows.map((row) => {
        const answers = JSON.parse(row.answers_json) as unknown;
        const fields = (WORKBOOK[row.number] ?? []).map((field) => ({ ...field, value: readPath(answers, field.path) })).filter((field) => field.value);
        const notes = row.notes;
        return (
          <article className="card" key={row.id} style={{ marginTop: 12 }}>
            <div className="eyebrow">{row.review_status} · {row.submitted_at}</div>
            <h2>{row.display_name} · Buổi {String(row.number).padStart(2, "0")} {row.framework}</h2>
            {fields.map((field) => <p key={field.path}><strong>{field.label}.</strong> {field.value}</p>)}
            {notes.map((note) => <p key={note.created_at} className="muted">{note.display_name}: {note.body}</p>)}
            <form action={async (formData) => { "use server"; await addFeedback(row.id, String(formData.get("body") || "")); }} className="field">
              <label htmlFor={`fb-${row.id}`}>Phản hồi coach</label>
              <textarea id={`fb-${row.id}`} name="body" required />
              <button className="btn dark" type="submit">Gửi và đánh dấu đã xem</button>
            </form>
          </article>
        );
      })}
    </main>
  );
}
