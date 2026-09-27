import { redirect } from "next/navigation";
import { CompanyProfilePanel } from "@/components/learning/CompanyProfile";
import { getSession } from "@/lib/auth";
import { api, q } from "@/lib/convex";
import { COURSE, GROUPS, LESSONS } from "@/lib/course";
import { messages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { canSee } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function CompanyPage({ searchParams }: { searchParams: Promise<{ learner?: string }> }) {
  const user = await getSession();
  if (!user) redirect("/learn/login");
  const staff = user.role === "admin" || user.role === "mod";
  if (!staff && !(await canSee(user, "company"))) redirect("/learn/profile");
  const params = await searchParams;
  const requested = Number(params.learner);
  const subjectId = staff && Number.isInteger(requested) && requested > 0 ? requested : user.id;
  const locale = await getLocale();
  const t = messages(locale);
  const data = await q((convex, secret) => convex.query(api.companyProfile.view, { secret, userId: user.id, subjectId }));
  if (data.error) {
    return (
      <main className="page">
        <div className="eyebrow">{t.companyEyebrow}</div>
        <h1 className="serif">{t.companyTitle}</h1>
        <p className="muted">{data.error === "forbidden" ? t.companyForbidden : t.companyMissing}</p>
      </main>
    );
  }
  const lessons = LESSONS.map((lesson) => ({
    number: lesson.number,
    code: lesson.code,
    title: lesson.title,
    framework: lesson.framework,
    summary: lesson.summary,
    group: lesson.group,
    href: `/learn/course/${COURSE.slug}/lesson/${lesson.number}`,
  }));
  const groups = GROUPS.map((id) => ({ id, label: t.group[id] }));
  return (
    <main className="page">
      <div className="eyebrow">{t.companyEyebrow}</div>
      <h1 className="serif">{t.companyTitle}</h1>
      <p className="lede">{t.companyLede}</p>
      {data.readOnly && <p className="notice"><strong>{t.companyReadOnly.replace("{name}", data.subjectName)}</strong></p>}
      <CompanyProfilePanel
        locale={locale}
        readOnly={data.readOnly}
        llmReady={Boolean(process.env.OPENAI_API_KEY?.trim())}
        profile={data.profile}
        assessments={data.assessments}
        lessons={lessons}
        groups={groups}
        labels={{
          lesson: t.lesson,
          current: t.companyCurrent,
          empty: t.companyEmpty,
          file: t.companyFile,
          paste: t.companyPaste,
          pasteHint: t.companyPasteHint,
          save: t.companySave,
          saving: t.companySaving,
          updated: t.companyUpdated,
          excerpt: t.companyExcerpt,
          truncated: t.companyTruncated,
          fileHint: t.companyFileHint,
          errorSize: t.companyErrorSize,
          errorType: t.companyErrorType,
          errorEmpty: t.companyErrorEmpty,
          errorExtract: t.companyErrorExtract,
          errorUpload: t.companyErrorUpload,
          errorLong: t.companyErrorLong,
          noKey: t.companyNoKey,
          assessTitle: t.companyAssessTitle,
          assessLede: t.companyAssessLede,
          generate: t.companyGenerate,
          regenerate: t.companyRegenerate,
          stale: t.companyStale,
          working: t.companyWorking,
          batch: t.companyBatch,
          batchConfirm: t.companyBatchConfirm,
          batchDone: t.companyBatchDone,
          strengths: t.companyStrengths,
          gaps: t.companyGaps,
          focus: t.companyFocus,
          openLesson: t.companyOpenLesson,
          model: t.companyModel,
          noText: t.companyNoText,
          errorLlm: t.companyErrorLlm,
          errorStale: t.companyErrorStale,
          errorMissing: t.companyLessonMissing,
          pasteName: t.companyPasteName,
          chars: t.companyChars,
          withPaste: t.companyWithPaste,
          promptNote: t.companyPromptNote,
          currentAll: t.companyCurrentAll,
        }}
      />
    </main>
  );
}
