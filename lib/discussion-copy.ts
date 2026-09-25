import type { Copy } from "./i18n";

export function discussionNotice(t: Copy, code?: string) {
  if (!code) return null;
  const map: Record<string, string> = {
    empty: t.discussionErrorEmpty,
    long: t.discussionErrorLong,
    forbidden: t.discussionForbidden,
    missing: t.discussionForbidden,
    name: t.discussionErrorName,
    members: t.discussionErrorMembers,
    deleted: t.adminDiscussionDeleted,
    confirm: t.adminDiscussionDeleteNeed,
  };
  return map[code] ?? null;
}
