import mammoth from "mammoth";
import { extractText } from "unpdf";
import type { CompanyFileKind } from "../convex/companyProfileAccess";

function mostlyText(bytes: Uint8Array) {
  const sample = bytes.subarray(0, 4000);
  if (sample.length === 0) return false;
  let odd = 0;
  for (const byte of sample) {
    if (byte === 0 || byte < 9 || (byte > 13 && byte < 32)) odd += 1;
  }
  return odd / sample.length < 0.08;
}

export async function extractCompanyFile(kind: CompanyFileKind, bytes: Uint8Array) {
  if (kind === "txt" || kind === "md") {
    if (!mostlyText(bytes)) return "";
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  if (kind === "docx") {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return result.value || "";
  }
  const extracted = await extractText(bytes, { mergePages: true });
  return extracted.text;
}
