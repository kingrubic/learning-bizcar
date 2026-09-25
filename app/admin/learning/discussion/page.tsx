import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { api, q } from "@/lib/convex";
import { archiveDiscussionGroup, createDiscussionGroup, deleteDiscussionGroup, saveDiscussionGroup } from "@/lib/discussion-actions";
import { discussionNotice } from "@/lib/discussion-copy";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";
import { canSee } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function DiscussionDeskPage({ searchParams }: { searchParams: Promise<{ cohort?: string; error?: string; done?: string }> }) {
  const user = await getSession();
  if (!user || !(await canSee(user, "admin-discussion"))) redirect("/learn/dashboard");
  if (user.role !== "admin" && user.role !== "mod") redirect("/learn/discussion");
  const params = await searchParams;
  const locale = await getLocale();
  const t = messages(locale);
  const requested = Number(params.cohort);
  const cohortId = Number.isInteger(requested) && requested > 0 ? requested : undefined;
  let desk = await q((convex, secret) => convex.query(api.discussion.desk, {
    secret,
    userId: user.id,
    ...(cohortId ? { cohortId } : {}),
  }));
  if (desk.cohortId && !desk.channels.some((channel) => channel.kind === "class")) {
    await q((convex, secret) => convex.mutation(api.discussion.touch, { secret, userId: user.id, cohortId: desk.cohortId! }));
    desk = await q((convex, secret) => convex.query(api.discussion.desk, {
      secret,
      userId: user.id,
      cohortId: desk.cohortId!,
    }));
  }
  const note = discussionNotice(t, params.error) ?? (params.done === "deleted" ? t.adminDiscussionDeleted : null);
  const classChannel = desk.channels.find((channel) => channel.kind === "class");
  const groups = desk.channels.filter((channel) => channel.kind === "group");
  return (
    <main>
      <div className="eyebrow">{t.adminCohorts}</div>
      <h1 className="serif">{t.adminDiscussionTitle}</h1>
      <p className="lede">{t.adminDiscussionLede}</p>
      {note && <p className="notice"><strong>{note}</strong></p>}
      {desk.error === "forbidden" && <p className="notice"><strong>{t.discussionForbidden}</strong></p>}
      {desk.cohorts.length === 0 && <p className="muted">{t.adminDiscussionNoCohort}</p>}
      {desk.cohorts.length > 0 && desk.cohortId && (
        <>
          <form className="row-actions" method="get">
            <label htmlFor="cohort">{t.adminDiscussionCohort}</label>
            <select id="cohort" name="cohort" defaultValue={String(desk.cohortId)} aria-label={t.adminDiscussionCohort}>
              {desk.cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
            </select>
            <button className="btn dark" type="submit">{t.adminDiscussionCohort}</button>
          </form>
          {classChannel && (
            <section className="card" style={{ marginTop: 16 }}>
              <div className="eyebrow">{t.discussionClass}</div>
              <h2 className="serif">{t.discussionClass}</h2>
              <p className="muted">{t.adminDiscussionClassHint}</p>
              <Link className="btn gold" href={`/learn/discussion?channel=${classChannel.id}`}>{t.adminDiscussionOpen}</Link>
            </section>
          )}
          <form action={createDiscussionGroup} className="card" style={{ marginTop: 16 }}>
            <h2>{t.adminDiscussionCreate}</h2>
            <input type="hidden" name="cohortId" value={desk.cohortId} />
            <div className="field">
              <label htmlFor="group-name">{t.adminDiscussionName}</label>
              <input id="group-name" name="name" required maxLength={80} />
            </div>
            <Roster roster={desk.roster} selected={new Set()} empty={t.adminDiscussionNoRoster} legend={t.adminDiscussionRoster} inactive={t.discussionInactive} />
            <button className="btn dark" type="submit">{t.adminDiscussionCreate}</button>
          </form>
          {groups.map((group) => (
            <section key={group.id} className="card" style={{ marginTop: 16 }}>
              {group.archived && <div className="eyebrow">{t.discussionArchived}</div>}
              <form action={saveDiscussionGroup}>
                <input type="hidden" name="cohortId" value={desk.cohortId!} />
                <input type="hidden" name="channelId" value={group.id} />
                <div className="field">
                  <label htmlFor={`name-${group.id}`}>{t.adminDiscussionName}</label>
                  <input id={`name-${group.id}`} name="name" required maxLength={80} defaultValue={group.name} />
                </div>
                <Roster roster={desk.roster} selected={new Set(group.memberIds)} empty={t.adminDiscussionNoRoster} legend={t.adminDiscussionRoster} inactive={t.discussionInactive} />
                <button className="btn dark" type="submit">{t.adminDiscussionSave}</button>
              </form>
              <div className="row-actions" style={{ marginTop: 12 }}>
                <Link className="btn" href={`/learn/discussion?channel=${group.id}`}>{t.adminDiscussionOpen}</Link>
                <form action={archiveDiscussionGroup}>
                  <input type="hidden" name="cohortId" value={desk.cohortId!} />
                  <input type="hidden" name="channelId" value={group.id} />
                  <input type="hidden" name="archived" value={group.archived ? "0" : "1"} />
                  <button className="btn" type="submit">{group.archived ? t.adminDiscussionRestore : t.adminDiscussionArchive}</button>
                </form>
              </div>
              <form action={deleteDiscussionGroup} className="row-actions" style={{ marginTop: 12 }}>
                <input type="hidden" name="cohortId" value={desk.cohortId!} />
                <input type="hidden" name="channelId" value={group.id} />
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" name="confirm" value="1" required />
                  <span>{t.adminDiscussionDeleteConfirm}</span>
                </label>
                <button className="btn" type="submit">{t.adminDiscussionDelete}</button>
              </form>
            </section>
          ))}
        </>
      )}
    </main>
  );
}

function Roster({
  roster,
  selected,
  empty,
  legend,
  inactive,
}: {
  roster: { id: number; displayName: string; username: string; active: boolean }[];
  selected: Set<number>;
  empty: string;
  legend: string;
  inactive: string;
}) {
  if (roster.length === 0) return <p className="muted">{empty}</p>;
  return (
    <fieldset style={{ border: 0, padding: 0, margin: "12px 0" }}>
      <legend className="muted">{legend}</legend>
      <div className="grid-3">
        {roster.map((member) => (
          <label key={member.id} className="check" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="members" value={member.id} defaultChecked={selected.has(member.id)} />
            <span>{member.displayName}<small className="muted" style={{ display: "block" }}>@{member.username}{member.active ? "" : ` · ${inactive}`}</small></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
