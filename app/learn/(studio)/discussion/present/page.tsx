import Link from "next/link";
import { redirect } from "next/navigation";
import { PresentFrame } from "@/components/learning/DiscussionSummary";
import { getSession } from "@/lib/auth";
import { api, q } from "@/lib/convex";
import { discussionNotice } from "@/lib/discussion-copy";
import { messages, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { canSee } from "@/lib/permissions";
import { summaryBullets } from "@/convex/discussionAccess";

export const dynamic = "force-dynamic";

function stamp(iso: string, locale: Locale) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale === "en" ? "en-GB" : "vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function PresentPage({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  const user = await getSession();
  if (!user) redirect("/learn/login");
  const staff = user.role === "admin" || user.role === "mod";
  if (!staff && !(await canSee(user, "discussion"))) redirect("/learn/profile");
  const params = await searchParams;
  const locale = await getLocale();
  const t = messages(locale);
  const channelId = Number(params.channel);
  const back = Number.isInteger(channelId) && channelId > 0
    ? `/learn/discussion?channel=${channelId}&tab=summary`
    : "/learn/discussion";
  if (!Number.isInteger(channelId) || channelId <= 0) {
    return (
      <main className="present-screen">
        <Link className="btn dark" href={back}>{t.summaryExit}</Link>
        <p className="lede">{t.summaryPresentEmpty}</p>
      </main>
    );
  }
  const view = await q((convex, secret) => convex.query(api.discussionSummary.view, { secret, userId: user.id, channelId }));
  if (view.error || !view.channel) {
    return (
      <main className="present-screen">
        <Link className="btn dark" href="/learn/discussion">{t.summaryExit}</Link>
        <p className="notice"><strong>{discussionNotice(t, view.error ?? "forbidden")}</strong></p>
      </main>
    );
  }
  const summary = view.summary;
  const bullets = summaryBullets(summary?.points ?? "");
  const blank = !summary || (!summary.title && bullets.length === 0 && !summary.conclusion && !summary.notes);
  const channelName = view.channel.kind === "class" ? t.discussionClass : view.channel.name;
  return (
    <PresentFrame
      exitHref={back}
      exit={t.summaryExit}
      notes={summary?.notes ?? ""}
      notesLabel={t.summaryNotes}
      showNotes={t.summaryShowNotes}
      hideNotes={t.summaryHideNotes}
    >
      <p className="eyebrow">{view.channel.cohortName}{view.channel.archived ? ` · ${t.discussionArchived}` : ""} · {channelName}</p>
      {blank ? <p className="lede">{t.summaryPresentEmpty}</p> : (
        <>
          <h1 className="serif">{summary?.title || channelName}</h1>
          {bullets.length > 0 && (
            <ul className="present-points">
              {bullets.map((line, index) => <li key={index}>{line}</li>)}
            </ul>
          )}
          {summary?.conclusion ? <p className="present-conclusion">{summary.conclusion}</p> : null}
          {summary ? <p className="muted">{t.summaryUpdated.replace("{time}", stamp(summary.updatedAt, locale)).replace("{name}", summary.editorName)}</p> : null}
        </>
      )}
    </PresentFrame>
  );
}
