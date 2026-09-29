import type { Role } from "./db";

/** Extension of BMDO-K03 lesson 04. The workbook storage key stays `bmdo-k03-buoi04-vrim-v1`. */
export const VRIM = {
  slug: "bmdo-k03",
  lessonNumber: 4,
  label: "V-RIM Studio (mở rộng)",
  storageKey: "mybizcar-vrim-studio-v2",
  workbookKey: "bmdo-k03-buoi04-vrim-v1",
  htmlPath: "source/bmdo-k03-vrim/index.html",
  sha256: "11f55c1eaffe37de33f4f5217ca1a231b360f92f7190ce18a55ce50d276ccd9a",
} as const;

export function vrimStudioPath() {
  return `/learn/course/${VRIM.slug}/lesson/04/vrim`;
}

export function vrimFilePath() {
  return `${vrimStudioPath()}/file`;
}

export type VrimDecision = "allow" | "missing" | "denied" | "locked";

export function vrimDecision(input: {
  role: Role;
  slug: string;
  lessonNumber: number;
  courseFound: boolean;
  enrolledLearner: boolean;
  lessonInClass: boolean;
  published: boolean;
  unlocked: boolean;
}): VrimDecision {
  if (!input.courseFound || input.slug !== VRIM.slug || input.lessonNumber !== VRIM.lessonNumber) return "missing";
  if (input.role === "admin" || input.role === "mod") return "allow";
  if (!input.enrolledLearner) return "denied";
  if (!input.lessonInClass) return "missing";
  if (!input.published || !input.unlocked) return "locked";
  return "allow";
}
