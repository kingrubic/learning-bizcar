import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { gate, nextId, now, userByLegacy } from "./helpers";

const secret = { secret: v.string() };

export async function notifyDiscussionPost(ctx: MutationCtx, input: {
  channelId: number;
  cohortId: number;
  channelKind: "class" | "group";
  channelName: string;
  messageId: number;
  authorId: number;
  authorName: string;
  snippet: string;
  fileCount: number;
}) {
  const ids = new Set<number>();
  if (input.channelKind === "class") {
    const enrolled = await ctx.db.query("enrollments").withIndex("by_cohort", (q) => q.eq("cohortId", input.cohortId)).collect();
    for (const row of enrolled) if (row.memberRole === "learner") ids.add(row.userId);
  } else {
    const members = await ctx.db.query("discussionMembers").withIndex("by_channel", (q) => q.eq("channelId", input.channelId)).collect();
    for (const row of members) ids.add(row.userId);
  }
  // ponytail: staff is every active admin/mod. Add a cohort-instructor table if that set gets large.
  const users = await ctx.db.query("users").collect();
  for (const user of users) {
    if (user.active === 1 && (user.role === "admin" || user.role === "mod")) ids.add(user.legacyId);
  }
  ids.delete(input.authorId);
  const stamp = now();
  const href = `/learn/discussion?channel=${input.channelId}`;
  for (const userId of ids) {
    const user = await userByLegacy(ctx, userId);
    if (!user || user.active !== 1) continue;
    const id = await nextId(ctx, "notifications");
    await ctx.db.insert("notifications", {
      legacyId: id,
      userId,
      channelId: input.channelId,
      channelKind: input.channelKind,
      channelName: input.channelName,
      authorName: input.authorName,
      snippet: input.snippet,
      fileCount: input.fileCount,
      href,
      readAt: null,
      createdAt: stamp,
    });
  }
}

export const feed = query({
  args: { ...secret, userId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const user = await userByLegacy(ctx, args.userId);
    if (!user || user.active !== 1) return { unread: 0, items: [] as FeedItem[] };
    // ponytail: loads this user's rows. Cap with a time index if one account collects thousands.
    const rows = await ctx.db.query("notifications").withIndex("by_user", (q) => q.eq("userId", user.legacyId)).collect();
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.legacyId - a.legacyId));
    const unread = rows.reduce((count, row) => count + (row.readAt ? 0 : 1), 0);
    return {
      unread,
      items: rows.slice(0, 20).map((row) => ({
        id: row.legacyId,
        channelKind: row.channelKind,
        channelName: row.channelName,
        authorName: row.authorName,
        snippet: row.snippet,
        fileCount: row.fileCount,
        href: row.href,
        read: row.readAt !== null,
        createdAt: row.createdAt,
      })),
    };
  },
});

type FeedItem = {
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

export const markAllRead = mutation({
  args: { ...secret, userId: v.number() },
  handler: async (ctx, args) => {
    gate(args.secret);
    const user = await userByLegacy(ctx, args.userId);
    if (!user || user.active !== 1) return { ok: true as const };
    const rows = await ctx.db.query("notifications").withIndex("by_user", (q) => q.eq("userId", user.legacyId)).collect();
    const stamp = now();
    for (const row of rows) {
      if (!row.readAt) await ctx.db.patch(row._id, { readAt: stamp });
    }
    return { ok: true as const };
  },
});
