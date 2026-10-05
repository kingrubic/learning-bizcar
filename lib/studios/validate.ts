import { STUDIO_VALIDATORS } from "./validators.generated";
import { STUDIO_STEPS, isEnvelope, type StudioConfig, type StudioEnvelope } from "./registry";

const PHASES = new Set<string>(["overview", ...STUDIO_STEPS, "report"]);

/** The studio's own import rule, run on a copy. Returns null when the document is valid, else the reason. */
export function studioDocError(config: Pick<StudioConfig, "id">, doc: unknown): string | null {
  const check = STUDIO_VALIDATORS[config.id];
  if (!check) return "Studio không xác định.";
  try {
    const result = check(JSON.parse(JSON.stringify(doc)));
    return result === false ? "Hồ sơ không đúng cấu trúc của studio." : null;
  } catch (error) {
    return error instanceof Error ? error.message : "Hồ sơ không hợp lệ.";
  }
}

/** Full check of what the lesson saves: envelope shape + the studio's own validate(). Throws on failure. */
export function validateEnvelope(config: StudioConfig, value: unknown): StudioEnvelope {
  if (!isEnvelope(value, config.id)) throw new Error("Không đúng định dạng bài làm của studio.");
  if (!Array.isArray(value.visited) || value.visited.some((item) => typeof item !== "string" || !PHASES.has(item))) {
    throw new Error("Danh sách bước không hợp lệ.");
  }
  if (typeof value.outline !== "string" || value.outline.length > 6000) throw new Error("Tóm tắt không hợp lệ.");
  if (value.doc !== null) {
    if (typeof value.doc !== "object" || Array.isArray(value.doc)) throw new Error("Hồ sơ studio không hợp lệ.");
    const error = studioDocError(config, value.doc);
    if (error) throw new Error(error);
  }
  return value;
}
