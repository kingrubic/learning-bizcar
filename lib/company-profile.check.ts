import { createRequire } from "node:module";
import {
  COMPANY_PROMPT_MAX,
  PASTE_MAX,
  PROFILE_TEXT_MAX,
  assessmentMessages,
  buildProfileText,
  cleanFileName,
  companyFileKind,
  parseAssessment,
  promptText,
  unwrapJson,
} from "../convex/companyProfileAccess.ts";
import { extractCompanyFile } from "./company-extract.ts";

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label);
}

assert(companyFileKind("ho-so.PDF") === "pdf", "pdf kind");
assert(companyFileKind("mo-ta.DOCX") === "docx", "docx kind");
assert(companyFileKind("a.txt") === "txt", "txt kind");
assert(companyFileKind("a.md") === "md", "md kind");
assert(companyFileKind("a.doc") === null, "doc rejected");
assert(companyFileKind("a.exe") === null, "exe rejected");
assert(companyFileKind("pdf") === null, "bare name rejected");
assert(!cleanFileName("../../secret.pdf").includes("/"), "file name stripped");

const kept = buildProfileText("A".repeat(PROFILE_TEXT_MAX), "GHI CHU");
assert(kept.source === "both", "both source");
assert(kept.truncated, "truncated when file is long");
assert(kept.text.endsWith("GHI CHU"), "paste kept");
assert(kept.text.length <= PROFILE_TEXT_MAX, "text cap");
assert(buildProfileText("  ", "  ").text === "", "blank profile");
assert(buildProfileText("Cong ty A", "").source === "file", "file source");
const pasteOnly = buildProfileText("", "Mo ta");
assert(pasteOnly.source === "paste" && pasteOnly.text === "Mo ta", "paste source");
assert(buildProfileText("", "x".repeat(PASTE_MAX + 5)).pasteText.length === PASTE_MAX, "paste cap");

const cut = promptText("y".repeat(COMPANY_PROMPT_MAX + 10));
assert(cut.startsWith("y".repeat(COMPANY_PROMPT_MAX)), "prompt keeps the start");
assert(cut.includes(String(COMPANY_PROMPT_MAX)), "prompt names the ceiling");

const messages = assessmentMessages({
  lessonNumber: 3,
  title: "BizCar Engine",
  framework: "MTUA",
  summary: "Meaningful Mission",
  group: "ENGINE",
  text: "Cong ty gom.",
});
assert(messages.user.includes("MTUA"), "prompt framework");
assert(messages.user.includes("Buổi 3"), "prompt lesson");
assert(!messages.system.includes("OPENAI"), "prompt has no key");

const parsed = parseAssessment('```json\n{"evaluation":"On.","strengths":"- Ro","gaps":"Thieu bang chung","focus":["Kiem chung"]}\n```');
assert(parsed?.evaluation === "On." && parsed.strengths[0] === "Ro" && parsed.gaps[0] === "Thieu bang chung", "parse assessment");
assert(parseAssessment("{}") === null, "reject empty assessment");
assert(unwrapJson('```json\n{"a":1}\n```') === '{"a":1}', "unwrap json");

function minimalPdf(line: string) {
  const stream = `BT /F1 18 Tf 36 100 Td (${line}) Tj ET`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
  ];
  let body = "%PDF-1.4\n";
  const xref = [0];
  for (const object of objects) {
    xref.push(body.length);
    body += object;
  }
  const start = body.length;
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < xref.length; index += 1) table += `${String(xref[index]).padStart(10, "0")} 00000 n \n`;
  body += `${table}trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return new Uint8Array(Buffer.from(body));
}

const require = createRequire(import.meta.url);
const JSZip = require("jszip") as { new (): { file: (name: string, data: string) => void; generateAsync: (options: { type: "uint8array" }) => Promise<Uint8Array> } };

const docx = new JSZip();
docx.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
docx.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
docx.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>BizCar Fuel</w:t></w:r></w:p></w:body></w:document>`);

const txt = await extractCompanyFile("txt", new TextEncoder().encode("MyBizCar mo ta"));
const md = await extractCompanyFile("md", new TextEncoder().encode("# MTUA\nCam ket"));
const binary = await extractCompanyFile("txt", Uint8Array.from({ length: 32 }, () => 0));
const pdf = await extractCompanyFile("pdf", minimalPdf("BizCar"));
const word = await extractCompanyFile("docx", await docx.generateAsync({ type: "uint8array" }));
assert(txt.includes("MyBizCar"), "txt extract");
assert(md.includes("MTUA"), "md extract");
assert(binary === "", "binary txt rejected");
assert(pdf.includes("BizCar"), `pdf extract ${pdf}`);
assert(word.includes("BizCar Fuel"), `docx extract ${word}`);
console.log("company-profile ok");
