export type ChannelKind = "class" | "group";

export const DISCUSSION_BODY_MAX = 2000;
export const DISCUSSION_NAME_MAX = 80;
export const DISCUSSION_HISTORY_MAX = 200;

export function channelAccess(input: {
  staff: boolean;
  enrolledCohortId: number | null;
  channelCohortId: number;
  kind: ChannelKind;
  archived: boolean;
  member: boolean;
}): { read: boolean; post: boolean } {
  if (!input.staff && input.archived) return { read: false, post: false };
  const inCohort = input.staff || input.enrolledCohortId === input.channelCohortId;
  if (!inCohort) return { read: false, post: false };
  if (input.kind === "group" && !input.staff && !input.member) return { read: false, post: false };
  return { read: true, post: !input.archived };
}
