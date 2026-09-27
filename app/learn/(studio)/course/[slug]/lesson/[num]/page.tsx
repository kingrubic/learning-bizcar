import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { answerFor, enrollmentFor, isLessonUnlocked, learningState } from "@/lib/access";
import { lessonByNumber, type LessonMeta } from "@/lib/course";
import { loadLessonSource } from "@/lib/lesson-source";
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
  const enrollment = await enrollmentFor(user.id);
  if (!enrollment || enrollment.member_role !== "learner") redirect("/learn/dashboard");
  const state = await learningState(user.id);
  if (slug !== state.course.slug) notFound();
  const rows = state.lessons;
  const row = rows.find((item) => item.number === number);
  if (!row) notFound();
  const vabix = isVabixCourse(slug, row.storage_key);
  const meta = vabix ? vabixLesson(number) : lessonByNumber(number);
  if (!meta) notFound();
  if ((!vabix && !(await lessonPublished(number))) || !(await isLessonUnlocked(user.id, number))) redirect(`/learn/course/${state.course.slug}`);
  const lesson: LessonMeta = vabix
    ? { ...meta, title: row.title, framework: row.framework, summary: row.summary, storageKey: row.storage_key }
    : meta;
  const saved = await answerFor(user.id, row.id);
  const source = loadLessonSource(number, { slug, storageKey: row.storage_key });
  const answers = saved ? JSON.parse(saved.answers_json) as Record<string, unknown> : {};
  const done = saved ? JSON.parse(saved.phases_done_json) as string[] : [];
  const lessonNav = await Promise.all(rows.map(async (item) => ({
    number: item.number,
    code: String(item.number).padStart(2, "0"),
    title: item.title,
    framework: item.framework,
    status: "not_started" as const,
    unlocked: await isLessonUnlocked(user.id, item.number),
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
