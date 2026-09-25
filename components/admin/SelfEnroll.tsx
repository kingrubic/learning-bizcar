import Link from "next/link";
import { enrollSelf } from "@/lib/admin-actions";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";

type Seat = {
  cohort_id: number;
  cohort_name: string;
  member_role: string;
} | null;

export async function SelfEnroll({
  cohortId,
  cohortName,
  enrollment,
  nextPath,
  variant,
}: {
  cohortId: number;
  cohortName: string;
  enrollment: Seat;
  nextPath: string;
  variant: "panel" | "inline";
}) {
  const t = messages(await getLocale());
  const inThis = enrollment?.member_role === "learner" && enrollment.cohort_id === cohortId;
  const inOther = Boolean(enrollment && enrollment.member_role === "learner" && enrollment.cohort_id !== cohortId);

  if (inThis) {
    return (
      <p className="notice" style={{ marginTop: variant === "inline" ? 12 : 16 }}>
        <strong>{t.alreadyInCohort}</strong>
        <span>{cohortName}</span>
        <Link className="btn gold" href="/learn/dashboard">{t.openLearner}</Link>
      </p>
    );
  }

  if (inOther) {
    if (variant === "inline") return <p className="muted" style={{ marginTop: 12 }}>{t.alreadyInOther}</p>;
    return (
      <p className="notice" style={{ marginTop: 16 }}>
        <strong>{t.alreadyInOther}</strong>
        <span>{enrollment?.cohort_name}</span>
        <Link className="btn gold" href="/learn/dashboard">{t.openLearner}</Link>
      </p>
    );
  }

  if (variant === "inline") {
    return (
      <form action={enrollSelf} className="row-actions" style={{ marginTop: 12 }}>
        <input type="hidden" name="cohortId" value={cohortId} />
        <input type="hidden" name="next" value={nextPath} />
        <button className="btn dark" type="submit">{t.joinCohort}</button>
      </form>
    );
  }

  return (
    <form action={enrollSelf} className="card" style={{ marginTop: 16 }}>
      <div className="eyebrow">{t.selfEnrollEyebrow}</div>
      <h2 className="serif" style={{ fontSize: 28, marginTop: 6 }}>{cohortName}</h2>
      <p className="muted">{t.joinCohortHint}</p>
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="next" value={nextPath} />
      <button className="btn dark" type="submit">{t.joinCohort}</button>
    </form>
  );
}
