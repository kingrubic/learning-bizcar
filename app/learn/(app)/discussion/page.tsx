import Link from "next/link";
import { redirect } from "next/navigation";
import { DiscussionComposer, DiscussionLive, DiscussionThread } from "@/components/learning/DiscussionPane";
import { getSession } from "@/lib/auth";
import { api, q } from "@/lib/convex";
import { postDiscussionMessage } from "@/lib/discussion-actions";
import { discussionNotice } from "@/lib/discussion-copy";
import { messages, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { canSee } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function stamp(iso: string, locale: Locale) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale === "en" ? "en-GB" : "vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function DiscussionPage({ searchParams }: { searchParams: Promise<{ channel?: string; error?: string }> }) {
  const user = await getSession();
  if (!user) redirect("/learn/login");
  const staff = user.role === "admin" || user.role === "mod";
  if (!staff && !(await canSee(user, "discussion"))) redirect("/learn/profile");
  const params = await searchParams;
  const locale = await getLocale();
  const t = messages(locale);
  let home = await q((convex, secret) => convex.query(api.discussion.home, { secret, userId: user.id }));
  if (home.missingClass.length > 0) {
    await q((convex, secret) => convex.mutation(api.discussion.touch, { secret, userId: user.id }));
    home = await q((convex, secret) => convex.query(api.discussion.home, { secret, userId: user.id }));
  }
  const note = discussionNotice(t, params.error);
  if (!home.staff && !home.enrolled) {
    return (
      <main className="page">
        <div className="eyebrow">{t.discussionEyebrow}</div>
        <h1 className="serif">{t.discussionTitle}</h1>
        <p className="notice"><strong>{t.notEnrolled}</strong><span>{t.discussionNotEnrolled}</span></p>
      </main>
    );
  }
  const requested = Number(params.channel);
  const channelId = Number.isInteger(requested) && requested > 0 ? requested : home.channels[0]?.id;
  const view = channelId
    ? await q((convex, secret) => convex.query(api.discussion.thread, { secret, userId: user.id, channelId }))
    : null;
  const threadNote = view && view.error ? discussionNotice(t, view.error) : null;
  const multi = new Set(home.channels.map((channel) => channel.cohortId)).size > 1;
  const channel = view && !view.error ? view.channel : null;
  return (
    <main className="page">
      <div className="eyebrow">{t.discussionEyebrow}</div>
      <h1 className="serif">{t.discussionTitle}</h1>
      <p className="lede">{t.discussionLede}</p>
      {(home.enrolled || home.staff) && !home.channels.some((item) => item.kind === "group" && !item.archived) && (
        <p className="muted">{t.discussionNoGroups}</p>
      )}
      {(note || threadNote) && <p className="notice"><strong>{note || threadNote}</strong></p>}
      {home.channels.length === 0 && <p className="muted">{t.discussionNoChannel}</p>}
      {home.channels.length > 0 && (
        <div className="discussion-layout" style={{ marginTop: 18 }}>
          <aside className="card">
            <nav className="discussion-channels" aria-label={t.discussionTitle}>
              {home.channels.map((item) => (
                <Link key={item.id} className={item.id === channel?.id ? "btn dark" : "btn"} href={`/learn/discussion?channel=${item.id}`} aria-current={item.id === channel?.id ? "page" : undefined}>
                  <span>{item.kind === "class" ? t.discussionClass : item.name}{multi ? <small style={{ display: "block", opacity: 0.75 }}>{item.cohortName}</small> : null}</span>
                  {item.archived ? <small>{t.discussionArchived}</small> : null}
                </Link>
              ))}
            </nav>
            {home.staff && <p style={{ marginTop: 16 }}><Link className="btn" href="/admin/learning/discussion">{t.discussionManage}</Link></p>}
          </aside>
          <section className="card">
            {!channel && <p className="muted">{t.discussionPick}</p>}
            {channel && view && !view.error && (
              <>
                <div className="row-actions" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div className="eyebrow">{channel.cohortName}{channel.archived ? ` · ${t.discussionArchived}` : ""}</div>
                    <h2 className="serif">{channel.kind === "class" ? t.discussionClass : channel.name}</h2>
                  </div>
                  <DiscussionLive label={t.discussionRefresh} />
                </div>
                {view.trimmed && <p className="muted">{t.discussionTrimmed}</p>}
                <DiscussionThread tail={String(view.messages.at(-1)?.id ?? "empty")}>
                  {view.messages.length === 0 && <p className="muted">{t.discussionEmpty}</p>}
                  {view.messages.map((message) => (
                    <article key={message.id} className="discussion-msg">
                      <strong>{message.authorName}</strong>
                      <span className="muted"> · {stamp(message.createdAt, locale)}</span>
                      <p>{message.body}</p>
                    </article>
                  ))}
                </DiscussionThread>
                {channel.canPost ? (
                  <DiscussionComposer
                    key={channel.id}
                    channelId={channel.id}
                    placeholder={t.discussionPlaceholder}
                    send={t.discussionSend}
                    pendingLabel={t.saving}
                    action={postDiscussionMessage}
                  />
                ) : <p className="muted">{t.discussionArchivedHint}</p>}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
