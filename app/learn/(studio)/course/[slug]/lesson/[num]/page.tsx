import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { answerFor, isLessonUnlocked, learningState } from "@/lib/access";
import { BMDO_SLUG } from "@/convex/codes";
import { lessonByNumber, type LessonMeta } from "@/lib/course";
import { loadLessonSource } from "@/lib/lesson-source";
import { babosoraLesson, isBabosoraCourse } from "@/lib/babosora-applier";
import { isVabixCourse, vabixLesson } from "@/lib/vabix-applier";
import { LessonExperience } from "@/components/learning/LessonExperience";
import { canSee } from "@/lib/permissions";
import { getLocale } from "@/lib/locale";
import { lessonPublished } from "@/lib/cms";

export default async function LessonPage({ params }: { params: Promise<{ slug: string; num: string }> }) {
  const { slug, num } = await params;
  const number = Number(num);
  if (!Number.isInteger(number) || number < 1) notFound();
  const user = await getSession();
  if (!user) redirect("/learn/login");
  if (!(await canSee(user, "map"))) redirect("/learn/profile");
  const state = await learningState(user.id, slug);
  if (!state || slug !== state.course.slug) notFound();
  const enrollment = state.enrollment;
  if (!enrollment || enrollment.member_role !== "learner") redirect("/learn/dashboard");
  const rows = state.lessons;
  const row = rows.find((item) => item.number === number);
  if (!row) notFound();
  const vabix = isVabixCourse(slug, row.storage_key);
  const babosora = isBabosoraCourse(slug, row.storage_key);
  const meta = vabix ? vabixLesson(number) : babosora ? babosoraLesson(number) : lessonByNumber(number);
  if (!meta) notFound();
  const published = state.course.slug === BMDO_SLUG ? await lessonPublished(number) : true;
  if (!published || !(await isLessonUnlocked(user.id, number, slug))) redirect(`/learn/course/${state.course.slug}`);
  const lesson: LessonMeta = vabix || babosora
    ? { ...meta, title: row.title, framework: row.framework, summary: row.summary, storageKey: row.storage_key }
    : meta;
  const saved = await answerFor(user.id, row.id, slug);
  const source = loadLessonSource(number, { slug, storageKey: row.storage_key });
  const answers = saved ? JSON.parse(saved.answers_json) as Record<string, unknown> : {};
  const done = saved ? JSON.parse(saved.phases_done_json) as string[] : [];
  const lessonNav = await Promise.all(rows.map(async (item) => ({
    number: item.number,
    code: String(item.number).padStart(2, "0"),
    title: item.title,
    framework: item.framework,
    status: "not_started" as const,
    unlocked: await isLessonUnlocked(user.id, item.number, slug),
  })));
  return (
    <LessonExperience
      lesson={lesson}
      scopeClass={source.scopeClass}
      showSample={source.showSample}
      showPhases={source.showPhases}
      lessons={lessonNav}
      source={{ css: source.css, html: source.html, script: source.script }}
      initialAnswers={answers}
      initialPhase={saved?.current_phase || "overview"}
      initialDone={done}
      initialProgress={saved?.progress_percent ?? 0}
      userId={user.id}
      serverUpdatedAt={saved?.updated_at ?? null}
      reviewEnabled={Boolean(enrollment?.review_enabled)}
      status={saved?.status ?? "not_started"}
      locale={await getLocale()}
      courseSlug={state.course.slug}
      courseCode={state.course.code}
    />
  );
}

export const dynamic = "force-dynamic";
