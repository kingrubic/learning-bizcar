import Link from "next/link";
import { redirect } from "next/navigation";
import { DiscussionComposer, DiscussionLive, DiscussionThread } from "@/components/learning/DiscussionPane";
import { DiscussionSummaryEditor } from "@/components/learning/DiscussionSummary";
import { summaryBullets } from "@/convex/discussionAccess";
import { getSession } from "@/lib/auth";
import { api, q } from "@/lib/convex";
import { discussionNotice } from "@/lib/discussion-copy";
import { messages, type Copy, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { canSee } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / (1024 * 102.4)) / 10} MB`;
}

function stamp(iso: string, locale: Locale) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale === "en" ? "en-GB" : "vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function DiscussionPage({ searchParams }: { searchParams: Promise<{ channel?: string; error?: string; tab?: string }> }) {
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
  const tab = params.tab === "summary" ? "summary" : "chat";
  const view = tab === "chat" && channelId
    ? await q((convex, secret) => convex.query(api.discussion.thread, { secret, userId: user.id, channelId }))
    : null;
  const summary = tab === "summary" && channelId
    ? await q((convex, secret) => convex.query(api.discussionSummary.view, { secret, userId: user.id, channelId }))
    : null;
  const threadNote = view && view.error ? discussionNotice(t, view.error) : summary && summary.error ? discussionNotice(t, summary.error) : null;
  const multi = new Set(home.channels.map((channel) => channel.cohortId)).size > 1;
  const channel = view && !view.error ? view.channel : summary && !summary.error ? summary.channel : null;
  const channelHref = (id: number) => tab === "summary" ? `/learn/discussion?channel=${id}&tab=summary` : `/learn/discussion?channel=${id}`;
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
                <Link key={item.id} className={item.id === channel?.id ? "btn dark" : "btn"} href={channelHref(item.id)} aria-current={item.id === channel?.id ? "page" : undefined}>
                  <span>{item.kind === "class" ? t.discussionClass : item.name}{multi ? <small style={{ display: "block", opacity: 0.75 }}>{item.cohortName}</small> : null}</span>
                  {item.archived ? <small>{t.discussionArchived}</small> : null}
                </Link>
              ))}
            </nav>
            {home.staff && <p style={{ marginTop: 16 }}><Link className="btn" href="/admin/learning/discussion">{t.discussionManage}</Link></p>}
          </aside>
          <section className="card">
            {!channel && <p className="muted">{t.discussionPick}</p>}
            {channel && (
              <>
                <div className="row-actions" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div className="eyebrow">{channel.cohortName}{channel.archived ? ` · ${t.discussionArchived}` : ""}</div>
                    <h2 className="serif">{channel.kind === "class" ? t.discussionClass : channel.name}</h2>
                  </div>
                  {tab === "chat" && <DiscussionLive label={t.discussionRefresh} />}
                </div>
                <div className="discussion-tabs" role="tablist">
                  <Link className={tab === "chat" ? "btn dark" : "btn"} role="tab" aria-selected={tab === "chat"} href={`/learn/discussion?channel=${channel.id}`}>{t.discussionTab}</Link>
                  <Link className={tab === "summary" ? "btn dark" : "btn"} role="tab" aria-selected={tab === "summary"} href={`/learn/discussion?channel=${channel.id}&tab=summary`}>{t.summaryTab}</Link>
                </div>
              </>
            )}
            {channel && tab === "chat" && view && !view.error && (
              <>
                {view.trimmed && <p className="muted">{t.discussionTrimmed}</p>}
                <DiscussionThread tail={String(view.messages.at(-1)?.id ?? "empty")}>
                  {view.messages.length === 0 && <p className="muted">{t.discussionEmpty}</p>}
                  {view.messages.map((message) => (
                    <article key={message.id} className="discussion-msg">
                      <strong>{message.authorName}</strong>
                      <span className="muted"> · {stamp(message.createdAt, locale)}</span>
                      {message.body ? <p>{message.body}</p> : null}
                      {message.attachments.length > 0 && (
                        <ul className="discussion-files">
                          {message.attachments.map((file) => (
                            <li key={file.id}>
                              {file.url && file.contentType.startsWith("image/") && <img src={file.url} alt={file.fileName} />}
                              {file.url
                                ? <a href={file.url} target="_blank" rel="noopener noreferrer">{file.fileName}</a>
                                : <span>{file.fileName}</span>}
                              <span className="muted"> · {formatSize(file.size)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </DiscussionThread>
                {view.channel.canPost ? (
                  <DiscussionComposer
                    key={channel.id}
                    channelId={channel.id}
                    placeholder={t.discussionPlaceholder}
                    send={t.discussionSend}
                    pendingLabel={t.saving}
                    attach={t.discussionAttach}
                    hint={t.discussionFileHint}
                    remove={t.discussionRemoveFile}
                    errors={{
                      empty: t.discussionErrorEmpty,
                      size: t.discussionErrorSize,
                      files: t.discussionErrorFiles,
                      upload: t.discussionErrorUpload,
                    }}
                  />
                ) : <p className="muted">{t.discussionArchivedHint}</p>}
              </>
            )}
            {channel && tab === "summary" && summary && !summary.error && (
              <SummaryPane
                channelId={channel.id}
                canEdit={summary.canEdit}
                summary={summary.summary}
                recent={summary.recent}
                locale={locale}
                t={t}
              />
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function SummaryPane({
  channelId,
  canEdit,
  summary,
  recent,
  locale,
  t,
}: {
  channelId: number;
  canEdit: boolean;
  summary: { title: string; points: string; conclusion: string; notes: string; updatedAt: string; editorName: string } | null;
  recent: { authorName: string; body: string; fileCount: number }[];
  locale: Locale;
  t: Copy;
}) {
  const bullets = summaryBullets(summary?.points ?? "");
  const hasBody = Boolean(summary && (summary.title || bullets.length > 0 || summary.conclusion || summary.notes));
  return (
    <div className="summary-doc">
      {summary && <p className="muted">{t.summaryUpdated.replace("{time}", stamp(summary.updatedAt, locale)).replace("{name}", summary.editorName)}</p>}
      {!canEdit && <p className="muted">{t.summaryReadOnly}</p>}
      <p><Link className="btn gold" href={`/learn/discussion/present?channel=${channelId}`}>{t.summaryPresent}</Link></p>
      {canEdit ? (
        <DiscussionSummaryEditor
          key={channelId}
          channelId={channelId}
          title={summary?.title ?? ""}
          points={summary?.points ?? ""}
          conclusion={summary?.conclusion ?? ""}
          notes={summary?.notes ?? ""}
          recent={recent}
          labels={{
            title: t.summaryTitle,
            points: t.summaryPoints,
            conclusion: t.summaryConclusion,
            notes: t.summaryNotes,
            save: t.summarySave,
            suggest: t.summarySuggest,
            draftHint: t.summaryDraftHint,
            noDraft: t.summaryNoDraft,
            fileLine: t.summaryFileLine,
          }}
        />
      ) : hasBody && summary ? (
        <>
          {summary.title ? <h3 className="serif">{summary.title}</h3> : null}
          {bullets.length > 0 && <ul className="summary-points">{bullets.map((line, index) => <li key={index}>{line}</li>)}</ul>}
          {summary.conclusion ? <p style={{ whiteSpace: "pre-wrap" }}>{summary.conclusion}</p> : null}
          {summary.notes ? <><div className="eyebrow">{t.summaryNotes}</div><p style={{ whiteSpace: "pre-wrap" }}>{summary.notes}</p></> : null}
        </>
      ) : <p className="muted">{t.summaryEmpty}</p>}
    </div>
  );
}
