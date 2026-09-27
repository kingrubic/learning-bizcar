"use server";

// OPENAI_API_KEY is read only in this server action. Optional OPENAI_MODEL overrides gpt-4o-mini.

import type { Id } from "../convex/_generated/dataModel";
import {
  COMPANY_FILE_BYTES,
  COMPANY_MODEL_DEFAULT,
  COMPANY_PROMPT_VERSION,
  PASTE_MAX,
  type CompanyAssessment,
  type CompanyProfileView,
  assessmentMessages,
  buildProfileText,
  companyFileKind,
  parseAssessment,
  promptText,
} from "../convex/companyProfileAccess";
import { getSession } from "./auth";
import { extractCompanyFile } from "./company-extract";
import { api, q } from "./convex";
import { lessonByNumber } from "./course";

export type CompanySaveResult = { ok: true; profile: CompanyProfileView } | { ok: false; error: "empty" | "size" | "type" | "extract" | "upload" | "long" | "missing" };
export type CompanyAssessResult = { ok: true; assessment: CompanyAssessment } | { ok: false; error: "nokey" | "empty" | "llm" | "stale" | "missing" | "forbidden" };

const CONTENT_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
};

async function signedIn() {
  const user = await getSession();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

async function discard(userId: number, storageId: Id<"_storage">) {
  await q((convex, secret) => convex.mutation(api.companyProfile.discardUpload, { secret, userId, storageId }));
}

export async function saveCompanyProfile(formData: FormData): Promise<CompanySaveResult> {
  const user = await signedIn();
  const paste = String(formData.get("paste") ?? "");
  if (paste.trim().length > PASTE_MAX) return { ok: false, error: "long" };
  const file = formData.get("file");
  let extracted = "";
  let storageId: Id<"_storage"> | null = null;
  let fileName = "paste.txt";
  let contentType = "text/plain";
  if (file instanceof File && file.size > 0) {
    if (file.size > COMPANY_FILE_BYTES) return { ok: false, error: "size" };
    const kind = companyFileKind(file.name);
    if (!kind) return { ok: false, error: "type" };
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
      extracted = await extractCompanyFile(kind, bytes);
    } catch {
      return { ok: false, error: "extract" };
    }
    if (!extracted.trim()) return { ok: false, error: "extract" };
    fileName = file.name;
    contentType = CONTENT_TYPE[kind];
    const prepared = await q((convex, secret) => convex.mutation(api.companyProfile.prepareUpload, { secret, userId: user.id }));
    if (!("uploadUrl" in prepared) || !prepared.uploadUrl) return { ok: false, error: "upload" };
    const posted = await fetch(prepared.uploadUrl, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: Buffer.from(bytes),
    });
    if (!posted.ok) return { ok: false, error: "upload" };
    const payload = await posted.json() as { storageId?: string };
    if (!payload.storageId) return { ok: false, error: "upload" };
    storageId = payload.storageId as Id<"_storage">;
  }
  const built = buildProfileText(extracted, paste);
  if (!built.text) {
    if (storageId) await discard(user.id, storageId);
    return { ok: false, error: "empty" };
  }
  try {
    const result = await q((convex, secret) => convex.mutation(api.companyProfile.commit, {
      secret,
      userId: user.id,
      storageId,
      fileName,
      contentType,
      text: built.text,
      pasteText: built.pasteText,
      truncated: built.truncated ? 1 : 0,
    }));
    if ("error" in result) {
      if (storageId) await discard(user.id, storageId);
      const error = result.error === "size" ? "size" : result.error === "type" ? "type" : result.error === "long" ? "long" : result.error === "empty" ? "empty" : "upload";
      return { ok: false, error };
    }
    return { ok: true, profile: result.profile };
  } catch (error) {
    if (storageId) await discard(user.id, storageId);
    throw error;
  }
}

export async function generateCompanyAssessment(lessonNumber: number): Promise<CompanyAssessResult> {
  const user = await signedIn();
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return { ok: false, error: "nokey" };
  if (!Number.isInteger(lessonNumber)) return { ok: false, error: "missing" };
  const lesson = lessonByNumber(lessonNumber);
  if (!lesson) return { ok: false, error: "missing" };
  const profile = await q((convex, secret) => convex.query(api.companyProfile.text, { secret, userId: user.id }));
  if (profile.error) return { ok: false, error: profile.error === "empty" ? "empty" : "forbidden" };
  const messages = assessmentMessages({
    lessonNumber: lesson.number,
    title: lesson.title,
    framework: lesson.framework,
    summary: lesson.summary,
    group: lesson.group,
    text: promptText(profile.text),
  });
  const model = process.env.OPENAI_MODEL?.trim() || COMPANY_MODEL_DEFAULT;
  let content = "";
  let usedModel = model;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: messages.system },
          { role: "user", content: messages.user },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) {
      console.error("company assessment", response.status);
      return { ok: false, error: "llm" };
    }
    const payload = await response.json() as { model?: string; choices?: { message?: { content?: string } }[] };
    content = payload.choices?.[0]?.message?.content ?? "";
    usedModel = payload.model || model;
  } catch (error) {
    console.error("company assessment", error instanceof Error ? error.message : "fetch");
    return { ok: false, error: "llm" };
  }
  const parsed = parseAssessment(content);
  if (!parsed) return { ok: false, error: "llm" };
  const saved = await q((convex, secret) => convex.mutation(api.companyProfile.saveAssessment, {
    secret,
    userId: user.id,
    lessonNumber: lesson.number,
    profileVersion: profile.version,
    evaluation: parsed.evaluation,
    strengthsJson: JSON.stringify(parsed.strengths),
    gapsJson: JSON.stringify(parsed.gaps),
    focusJson: JSON.stringify(parsed.focus),
    model: usedModel,
    promptVersion: COMPANY_PROMPT_VERSION,
  }));
  if ("error" in saved) {
    if (saved.error === "stale") return { ok: false, error: "stale" };
    if (saved.error === "empty") return { ok: false, error: "empty" };
    if (saved.error === "missing") return { ok: false, error: "missing" };
    return { ok: false, error: "forbidden" };
  }
  return {
    ok: true,
    assessment: {
      lessonNumber: lesson.number,
      profileVersion: profile.version,
      status: "current",
      evaluation: parsed.evaluation,
      strengths: parsed.strengths,
      gaps: parsed.gaps,
      focus: parsed.focus,
      model: usedModel.slice(0, 80),
      promptVersion: COMPANY_PROMPT_VERSION,
      updatedAt: saved.updatedAt,
    },
  };
}
