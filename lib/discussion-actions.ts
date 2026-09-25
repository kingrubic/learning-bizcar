"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

export async function postDiscussionMessage(formData: FormData) {
  const user = await signedIn();
  const channelId = Number(formData.get("channelId"));
  const body = String(formData.get("body") || "");
  const result = await q((convex, secret) => convex.mutation(api.discussion.post, { secret, userId: user.id, channelId, body }));
  revalidatePath("/learn/discussion");
  learnRedirect(channelId, "error" in result ? result.error : undefined);
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
