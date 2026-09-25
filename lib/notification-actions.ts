"use server";

import { getSession } from "./auth";
import { api, q } from "./convex";

export async function loadNotifications() {
  const user = await getSession();
  if (!user) return { unread: 0, items: [] as NotificationItem[] };
  return q((convex, secret) => convex.query(api.notifications.feed, { secret, userId: user.id }));
}

export async function markNotificationsRead() {
  const user = await getSession();
  if (!user) return;
  await q((convex, secret) => convex.mutation(api.notifications.markAllRead, { secret, userId: user.id }));
}

type NotificationItem = {
  id: number;
  channelKind: "class" | "group";
  channelName: string;
  authorName: string;
  snippet: string;
  fileCount: number;
  href: string;
  read: boolean;
  createdAt: string;
};
