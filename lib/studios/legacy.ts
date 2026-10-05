import { WORKBOOK, readPath } from "../course";

const SKIP = new Set(["ui", "version", "schema", "updatedAt", "savedAt", "phase", "currentPhase", "progress", "done"]);

/**
 * Read-only lines for «Bài làm phiên bản cũ»: the old workbook's labelled fields first, then every other
 * non-empty text it holds (so nothing written in the old version is hidden).
 */
export function legacyRows(lessonNumber: number, old: unknown): { label: string; value: string }[] {
  if (!old || typeof old !== "object") return [];
  const rows: { label: string; value: string }[] = [];
  const used = new Set<string>();
  for (const field of WORKBOOK[lessonNumber] ?? []) {
    if (field.path.startsWith("doc.") || field.path === "outline") continue;
    const value = readPath(old, field.path);
    if (value) { rows.push({ label: field.label, value }); used.add(field.path); }
  }
  const walk = (value: unknown, path: string[], depth: number) => {
    if (rows.length >= 120 || depth > 6 || value == null) return;
    if (typeof value === "string") {
      const key = path.join(".");
      if (value.trim() && !used.has(key)) rows.push({ label: path.join(" › "), value: value.trim().slice(0, 4000) });
      return;
    }
    if (Array.isArray(value)) { value.forEach((item, index) => walk(item, [...path, String(index + 1)], depth + 1)); return; }
    if (typeof value === "object") {
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) if (!SKIP.has(key)) walk(item, [...path, key], depth + 1);
    }
  };
  walk(old, [], 0);
  return rows;
}
