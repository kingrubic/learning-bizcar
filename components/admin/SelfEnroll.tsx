import Link from "next/link";
import { enrollSelf } from "@/lib/admin-actions";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";

export async function SelfEnroll({
  cohortId,
  cohortName,
  enrolled,
  nextPath,
  variant,
}: {
  cohortId: number;
  cohortName: string;
  enrolled: boolean;
  nextPath: string;
  variant: "panel" | "inline";
}) {
  const t = messages(await getLocale());
  if (enrolled) {
    return (
      <p className="notice" style={{ marginTop: variant === "inline" ? 12 : 16 }}>
        <strong>{t.alreadyInCohort}</strong>
        <span>{cohortName}</span>
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
