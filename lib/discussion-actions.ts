"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Id } from "../convex/_generated/dataModel";
import { DISCUSSION_FILE_BYTES } from "../convex/discussionAccess";
import { getSession } from "./auth";
import { api, q } from "./convex";

async function signedIn() {
  const user = await getSession();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

async function staff() {
  const user = await signedIn();
  if (user.role !== "admin" && user.role !== "mod") throw new Error("FORBIDDEN");
  return user;
}

function memberIds(formData: FormData) {
  return [...new Set(formData.getAll("members").map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
}

function learnRedirect(channelId: number, error?: string): never {
  const params = new URLSearchParams();
  if (Number.isInteger(channelId) && channelId > 0) params.set("channel", String(channelId));
  if (error) params.set("error", error);
  redirect(`/learn/discussion?${params.toString()}`);
}

function deskRedirect(cohortId: number, error?: string, done?: string): never {
  const params = new URLSearchParams();
  if (Number.isInteger(cohortId) && cohortId > 0) params.set("cohort", String(cohortId));
  if (error) params.set("error", error);
  if (done) params.set("done", done);
  redirect(`/admin/learning/discussion?${params.toString()}`);
}

function cleanFileName(name: string) {
  const base = name.split(/[/\\]/).pop()?.trim() || "file";
  const cleaned = base.replace(/[^\p{L}\p{N}.\- ()]+/gu, "_").slice(0, 120);
  return cleaned.replace(/^\.+$/, "") || "file";
}

export async function uploadDiscussionFile(formData: FormData): Promise<{ storageId: Id<"_storage">; fileName: string; contentType: string } | { error: "empty" | "size" | "forbidden" | "missing" | "upload" }> {
  const user = await signedIn();
  const channelId = Number(formData.get("channelId"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) return { error: "empty" };
  if (file.size > DISCUSSION_FILE_BYTES) return { error: "size" };
  const prepared = await q((convex, secret) => convex.mutation(api.discussion.prepareUpload, { secret, userId: user.id, channelId }));
  if (prepared.error || !prepared.uploadUrl) return { error: prepared.error ?? "upload" };
  const contentType = file.type || "application/octet-stream";
  const posted = await fetch(prepared.uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!posted.ok) return { error: "upload" };
  const payload = await posted.json() as { storageId?: string };
  if (!payload.storageId) return { error: "upload" };
  return { storageId: payload.storageId as Id<"_storage">, fileName: cleanFileName(file.name), contentType };
}

export async function discardDiscussionUploads(storageIds: Id<"_storage">[]) {
  const user = await signedIn();
  if (storageIds.length === 0) return;
  await q((convex, secret) => convex.mutation(api.discussion.discardUploads, { secret, userId: user.id, storageIds }));
}

export async function postDiscussionMessage(formData: FormData) {
  const user = await signedIn();
  const channelId = Number(formData.get("channelId"));
  const body = String(formData.get("body") || "");
  const attachments = parseAttachments(String(formData.get("attachments") || "[]"));
  const result = await q((convex, secret) => convex.mutation(api.discussion.post, {
    secret,
    userId: user.id,
    channelId,
    body,
    attachments,
  }));
  if ("error" in result) {
    await q((convex, secret) => convex.mutation(api.discussion.discardUploads, {
      secret,
      userId: user.id,
      storageIds: attachments.map((file) => file.storageId),
    }));
  }
  revalidatePath("/learn/discussion");
  learnRedirect(channelId, "error" in result ? result.error : undefined);
}

function parseAttachments(raw: string): { storageId: Id<"_storage">; fileName: string; contentType: string }[] {
  try {
    const parsed = JSON.parse(raw) as { storageId?: string; fileName?: string; contentType?: string }[];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((file) => file.storageId ? [{
      storageId: file.storageId as Id<"_storage">,
      fileName: cleanFileName(String(file.fileName || "file")),
      contentType: String(file.contentType || "application/octet-stream").slice(0, 160),
    }] : []);
  } catch {
    return [];
  }
}

export async function createDiscussionGroup(formData: FormData) {
  const user = await staff();
  const cohortId = Number(formData.get("cohortId"));
  const name = String(formData.get("name") || "");
  const result = await q((convex, secret) => convex.mutation(api.discussion.createGroup, {
    secret,
    userId: user.id,
    cohortId,
    name,
    memberIds: memberIds(formData),
  }));
  revalidatePath("/admin/learning/discussion");
  revalidatePath("/learn/discussion");
  deskRedirect(cohortId, "error" in result ? result.error : undefined);
}

export async function saveDiscussionGroup(formData: FormData) {
  const user = await staff();
  const cohortId = Number(formData.get("cohortId"));
  const channelId = Number(formData.get("channelId"));
  const name = String(formData.get("name") || "");
  const result = await q((convex, secret) => convex.mutation(api.discussion.saveGroup, {
    secret,
    userId: user.id,
    channelId,
    name,
    memberIds: memberIds(formData),
  }));
  revalidatePath("/admin/learning/discussion");
  revalidatePath("/learn/discussion");
  deskRedirect(cohortId, "error" in result ? result.error : undefined);
}

export async function archiveDiscussionGroup(formData: FormData) {
  const user = await staff();
  const cohortId = Number(formData.get("cohortId"));
  const channelId = Number(formData.get("channelId"));
  const archived = String(formData.get("archived")) === "1";
  const result = await q((convex, secret) => convex.mutation(api.discussion.setArchived, {
    secret,
    userId: user.id,
    channelId,
    archived,
  }));
  revalidatePath("/admin/learning/discussion");
  revalidatePath("/learn/discussion");
  deskRedirect(cohortId, "error" in result ? result.error : undefined);
}

export async function deleteDiscussionGroup(formData: FormData) {
  const user = await staff();
  const cohortId = Number(formData.get("cohortId"));
  const channelId = Number(formData.get("channelId"));
  if (String(formData.get("confirm")) !== "1") deskRedirect(cohortId, "confirm");
  const result = await q((convex, secret) => convex.mutation(api.discussion.deleteGroup, { secret, userId: user.id, channelId }));
  revalidatePath("/admin/learning/discussion");
  revalidatePath("/learn/discussion");
  deskRedirect(cohortId, "error" in result ? result.error : undefined, "error" in result ? undefined : "deleted");
}
