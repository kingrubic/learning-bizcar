import { api, q } from "./convex";

export type Role = "admin" | "mod" | "user";
export type UnlockMode = "all_open" | "sequential" | "scheduled";
export type LessonStatus = "not_started" | "in_progress" | "completed" | "submitted" | "reviewed";

export async function logActivity(actorId: number | null, action: string, targetType?: string, targetId?: string | number, detail?: string) {
  await q((convex, secret) => convex.mutation(api.writes.logActivity, {
    secret,
    actorId,
    action,
    targetType,
    targetId: targetId != null ? String(targetId) : undefined,
    detail,
  }));
}
