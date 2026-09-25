export type ChannelKind = "class" | "group";

export const DISCUSSION_BODY_MAX = 2000;
export const DISCUSSION_NAME_MAX = 80;
export const DISCUSSION_HISTORY_MAX = 200;
export const DISCUSSION_FILE_MAX = 4;
export const DISCUSSION_FILE_BYTES = 20 * 1024 * 1024;
export const DISCUSSION_SUMMARY_TITLE_MAX = 120;
export const DISCUSSION_SUMMARY_FIELD_MAX = 8000;
export const DISCUSSION_SUGGEST_MAX = 30;
export const DISCUSSION_SUGGEST_LINE = 160;

export function summaryBullets(points: string) {
  return points.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.replace(/^[-*•]\s+/, ""));
}

export function draftFromMessages(
  messages: { authorName: string; body: string; fileCount: number }[],
  fileNote: (count: number) => string,
  max = DISCUSSION_SUGGEST_MAX,
) {
  const lines: string[] = [];
  for (const message of messages.slice(-max)) {
    const first = message.body.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
    const text = first.replace(/\s+/g, " ");
    const short = text.length > DISCUSSION_SUGGEST_LINE ? `${text.slice(0, DISCUSSION_SUGGEST_LINE - 1)}…` : text;
    if (short) lines.push(`- ${message.authorName}: ${short}`);
    else if (message.fileCount > 0) lines.push(`- ${message.authorName}: ${fileNote(message.fileCount)}`);
  }
  return lines.join("\n");
}

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
