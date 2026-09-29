import { notFound, redirect } from "next/navigation";
import { isLessonUnlocked, learningState } from "./access";
import { getSession } from "./auth";
import { BMDO_SLUG } from "@/convex/codes";
import { lessonPublished } from "./cms";
import { requiresPasswordChange } from "./password-gate";
import { canSee } from "./permissions";
import { VRIM, vrimDecision } from "./vrim-studio";

export async function requireVrim(slug: string, num: string) {
  const number = Number(num);
  if (!Number.isInteger(number) || number < 1) notFound();
  const user = await getSession();
  if (!user) redirect("/learn/login");
  if (requiresPasswordChange(user.mustChangePassword)) redirect("/learn/password");
  if (!(await canSee(user, "map"))) redirect("/learn/profile");
  const state = await learningState(user.id, slug);
  if (!state || state.course.slug !== slug) notFound();
  const row = state.lessons.find((item) => item.number === number);
  const published = state.course.slug === BMDO_SLUG ? await lessonPublished(number) : false;
  const unlocked = row ? await isLessonUnlocked(user.id, number, slug) : false;
  const decision = vrimDecision({
    role: user.role,
    slug,
    lessonNumber: number,
    courseFound: true,
    enrolledLearner: state.enrollment?.member_role === "learner",
    lessonInClass: Boolean(row),
    published,
    unlocked,
  });
  if (decision === "missing") notFound();
  if (decision === "denied") redirect("/learn/dashboard");
  if (decision === "locked") redirect(`/learn/course/${slug}`);
  if (decision !== "allow" || slug !== VRIM.slug) notFound();
  return { backHref: `/learn/course/${slug}/lesson/${String(VRIM.lessonNumber).padStart(2, "0")}` };
}
