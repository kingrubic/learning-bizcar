/**
 * BMDO-K03 lessons rebuilt from an original MyBizCar studio file (batch 1: Buổi 08, 09, 10, 11, 12, 14).
 *
 * The studio's own code, content and 7-step APPLIER flow run inside the lesson shell (no iframe).
 * Learner work is one "studio envelope" saved in the new-version record (table lessonAnswerVersions,
 * key `answerKey`). The lesson's old record (`oldKey`) is read-only and shown under «Bài làm phiên bản cũ».
 * This file is pure data + pure functions so server, client and checks share it.
 */
import type { PhaseId } from "../course";

export type StudioId = "mrim" | "mair" | "mcasing" | "mtread" | "prim" | "pcasing";

/** The studio's 7 APPLIER steps, in order, mapped to the lesson shell phases. */
export const STUDIO_STEPS: PhaseId[] = ["activate", "paradigm", "practice", "lens", "improve", "extract", "resolve"];

export const STUDIO_FORMAT = "mybizcar-studio";

export type StudioEnvelope = {
  format: typeof STUDIO_FORMAT;
  studio: StudioId;
  version: 2;
  /** The studio's own document, exactly what its «Xuất JSON» exports. */
  doc: Record<string, unknown> | null;
  /** Shell phases the learner has opened (Paradigm has no form of its own). */
  visited: PhaseId[];
  /** Plain-text summary for teachers and admins; rebuilt on every save. */
  outline: string;
};

type Doc = Record<string, unknown>;

export type StudioConfig = {
  id: StudioId;
  lesson: number;
  title: string;
  framework: string;
  file: string;
  oldKey: string;
  answerKey: string;
  /** localStorage key the studio reads and writes; the host maps it to the new-version record. */
  localKey: string;
  /** JS expressions evaluated inside the studio's own scope. */
  stateVar: string;
  readStep: string;
  writeStep: string;
  intro: string[];
  /** Other studio JSON this studio can import by hand (file picker inside the studio). */
  imports?: string;
  steps: (doc: Doc, visited: PhaseId[]) => boolean[];
  summary: (doc: Doc) => string;
};

const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const rec = (value: unknown): Doc => (value && typeof value === "object" && !Array.isArray(value) ? value as Doc : {});
const list = (value: unknown): Doc[] => (Array.isArray(value) ? value.map(rec) : []);
const anyText = (source: unknown, keys: string[]) => keys.some((key) => text(rec(source)[key]));
const line = (label: string, value: unknown) => (text(value) ? `${label}: ${String(value).trim()}` : "");
const names = (rows: Doc[], key: string) => rows.map((row) => String(row[key] ?? "").trim()).filter(Boolean).slice(0, 12).join("; ");
const join = (parts: string[]) => parts.filter(Boolean).join("\n").slice(0, 6000);
const seen = (visited: PhaseId[], phase: PhaseId) => visited.includes(phase);

const ID_STEPS = "steps.findIndex((row) => row[0] === tab)";
const ID_WRITE = "tab = steps[i][0]";

export const STUDIOS: StudioConfig[] = [
  {
    id: "mrim",
    lesson: 8,
    title: "M-Rim",
    framework: "SCP",
    file: "source/bmdo-k03-studios/mrim/index.html",
    oldKey: "bmdo-k03-buoi08-scp-v1",
    answerKey: "bmdo-k03-buoi08-mrim-v2",
    localKey: "mybizcar-mrim-1",
    stateVar: "state",
    readStep: ID_STEPS,
    writeStep: ID_WRITE,
    imports: "JSON V-RIM (Buổi 04): nút «Nhập JSON V-RIM» trong bước Practise",
    intro: [
      "Khớp giá trị với thị trường: thiết kế SCP từ VBF, đúng UC tại Address (AH/AR/AP/AC) và Area A0–A4, qua kênh phù hợp, cùng Partner có đóng góp rõ.",
      "S là B2A. C gồm Old, Offline, Online và Omni (Omni phải mô tả sự phối hợp). P là bên đồng hành, không tự đồng nhất với AR mua để bán lại.",
      "Mỗi phương án SCP có VBF được chọn, một nhóm địa chỉ/phạm vi, NAP/CAP, kênh và các Partner. Cảnh báo là gợi ý sàng lọc, không chấm điểm và không chứng nhận thị trường phù hợp.",
    ],
    steps: (doc, visited) => {
      const wb = rec(doc.workbook);
      const designs = list(doc.designs);
      return [
        text(doc.company) || text(doc.product) || anyText(wb, ["concern", "goal"]),
        seen(visited, "paradigm") || designs.length > 0,
        designs.some((d) => Array.isArray(d.vbf) && d.vbf.length > 0 && text(rec(d.segment).uc)),
        anyText(wb, ["self", "peer", "uncertain"]),
        designs.some((d) => text(d.improve)),
        anyText(wb, ["lesson", "apply"]),
        anyText(wb, ["action", "proof"]),
      ];
    },
    summary: (doc) => {
      const wb = rec(doc.workbook);
      const designs = list(doc.designs);
      return join([
        [doc.company, doc.product].filter(text).join(" · "),
        designs.length ? `Phương án SCP (${designs.length}): ${names(designs, "name") || "chưa đặt tên"}` : "",
        ...designs.slice(0, 6).map((d) => {
          const s = rec(d.segment);
          const c = rec(d.channel);
          return `- ${String(d.name || "Phương án")}: S ${[s.uc, s.address, s.area].filter(text).join(" / ") || "?"} · C ${(Array.isArray(c.types) ? c.types.join("/") : "") || "?"} · P ${names(list(d.partners), "name") || "—"}`;
        }),
        line("Bài học", wb.lesson),
        line("Hành động", wb.action),
        line("Bằng chứng", wb.proof),
      ]);
    },
  },
  {
    id: "mair",
    lesson: 9,
    title: "M-Air",
    framework: "CIB",
    file: "source/bmdo-k03-studios/mair/index.html",
    oldKey: "bmdo_k03_buoi09_mair_cib",
    answerKey: "bmdo-k03-buoi09-mair-v2",
    localKey: "mybizcar-mair-v1",
    stateVar: "s",
    readStep: "tab",
    writeStep: "tab = i",
    intro: [
      "Hơi niềm tin thị trường: đo điều thị trường tin, kiểm tra căn cứ, vá nguyên nhân xì hơi và tạo thêm bằng chứng để xứng đáng được tin.",
      "12 ngành / 36 tình huống CIB giả định; hồ sơ lời hứa theo Address/Area/UC; phản hồi trực tiếp 1–10 hoặc chưa đủ trải nghiệm/định tính; thư viện 24 rủi ro; kế hoạch vá xì và trạm bơm; cam kết 90 ngày.",
      "C, I, B tách riêng từng chiều, không có điểm tổng hay ngưỡng chứng nhận. Chỉ dùng mã ẩn danh.",
    ],
    steps: (doc, visited) => {
      const wb = rec(doc.workbook);
      return [
        text(doc.company) || text(doc.product) || text(wb.activate),
        seen(visited, "paradigm") || list(doc.claims).length > 0,
        list(doc.claims).length > 0,
        text(wb.lens) || list(doc.responses).length > 0,
        list(doc.risks).length > 0 || list(doc.plans).length > 0,
        text(wb.extract),
        text(wb.resolve),
      ];
    },
    summary: (doc) => {
      const wb = rec(doc.workbook);
      return join([
        [doc.company, doc.product].filter(text).join(" · "),
        `${list(doc.claims).length} hồ sơ lời hứa · ${list(doc.responses).length} phản hồi · ${list(doc.risks).length} cảnh báo · ${list(doc.plans).length} kế hoạch`,
        line("Lời hứa", names(list(doc.claims), "promise")),
        line("Cảnh báo", names(list(doc.risks), "title")),
        line("Bài học", wb.extract),
        line("Cam kết 90 ngày", wb.resolve),
      ]);
    },
  },
  {
    id: "mcasing",
    lesson: 10,
    title: "M-Casing",
    framework: "PFE",
    file: "source/bmdo-k03-studios/mcasing/index.html",
    oldKey: "bmdo_k03_buoi10_mcasing_pfe",
    answerKey: "bmdo-k03-buoi10-mcasing-v2",
    localKey: "mybizcar-mcasing-1",
    stateVar: "state",
    readStep: ID_STEPS,
    writeStep: ID_WRITE,
    imports: "JSON V-CASING: nút nhập V-CASING trong bước Practise",
    intro: [
      "Lắng nghe trải nghiệm thị trường. Ba lớp PRODEX/SERVEX/COMMEX là lớp EncounterPoints; P/F/E là các chiều phép đo. XENERGY đo trực tiếp riêng: 1–5 Đau, 6–8 Đợi, 9–10 Đã.",
      "Không gộp P/F/E thành XENERGY, không chuyển nhận xét định tính thành số. Mục tiêu thiết kế không phải phản hồi.",
      "Sau khi có phản hồi, phép đo bị khóa; tạo phiên bản mới nếu đổi câu hỏi hoặc thang. Xám là chưa có điểm, không phải điểm 0.",
    ],
    steps: (doc, visited) => {
      const wb = rec(doc.workbook);
      const points = list(doc.points);
      return [
        text(doc.company) || text(doc.product) || anyText(wb, ["concern", "goal"]),
        seen(visited, "paradigm") || points.length > 0,
        points.length > 0 && list(doc.measures).length > 0,
        anyText(wb, ["self", "peer", "limits"]),
        points.some((p) => text(p.change)),
        anyText(wb, ["lesson", "application"]),
        anyText(wb, ["action", "proof"]),
      ];
    },
    summary: (doc) => {
      const wb = rec(doc.workbook);
      return join([
        [doc.company, doc.product].filter(text).join(" · "),
        `${list(doc.points).length} EncounterPoint · ${list(doc.measures).length} phép đo · ${list(doc.responses).length} phản hồi`,
        line("EncounterPoint", names(list(doc.points), "name")),
        line("Bài học", wb.lesson),
        line("Áp dụng", wb.application),
        line("Hành động", wb.action),
        line("Bằng chứng", wb.proof),
      ]);
    },
  },
  {
    id: "mtread",
    lesson: 11,
    title: "M-Tread",
    framework: "GRIP",
    file: "source/bmdo-k03-studios/mtread/index.html",
    oldKey: "bmdo_k03_buoi11_mtread_grip",
    answerKey: "bmdo-k03-buoi11-mtread-v2",
    localKey: "mybizcar-mtread-1",
    stateVar: "state",
    readStep: ID_STEPS,
    writeStep: ID_WRITE,
    intro: [
      "Bốn luồng bám thị trường GRIP: G mua mới, R tiếp tục mua, I mua tăng, P giới thiệu / ủng hộ.",
      "Tạo Address (AH/AR/AP/AC), Area A0–A4, UC; chọn hai kỳ cùng độ dài, không chồng lấn. Nhập BO và SO thủ công; mỗi SO chỉ gán một gai chính và cần căn cứ.",
      "Chỉ SO đã ghi nhận mới vào tổng; BO là cơ hội chưa trọng số, không phải doanh thu. Chưa đủ dữ liệu là chưa xác định, không phải gai yếu.",
    ],
    steps: (doc, visited) => {
      const wb = rec(doc.workbook);
      return [
        text(doc.company) || anyText(wb, ["concern", "goal"]),
        seen(visited, "paradigm") || list(doc.addresses).length > 0,
        list(doc.addresses).length > 0 && (list(doc.orders).length > 0 || list(doc.opportunities).length > 0),
        anyText(wb, ["self", "peer"]),
        text(wb.action),
        text(wb.lesson),
        text(wb.proof),
      ];
    },
    summary: (doc) => {
      const wb = rec(doc.workbook);
      return join([
        text(doc.company) ? String(doc.company) : "",
        `${list(doc.addresses).length} Address · ${list(doc.orders).length} SO · ${list(doc.opportunities).length} BO · tiền ${String(doc.currency ?? "")}`,
        line("Kỳ hiện tại", [doc.currentStart, doc.currentEnd].filter(text).join(" → ")),
        line("Cải tiến", wb.action),
        line("Bài học", wb.lesson),
        line("Tiêu chí kiểm chứng", wb.proof),
      ]);
    },
  },
  {
    id: "prim",
    lesson: 12,
    title: "P-Rim",
    framework: "COD",
    file: "source/bmdo-k03-studios/prim/index.html",
    oldKey: "bmdo_k03_buoi12_prim_cod",
    answerKey: "bmdo-k03-buoi12-prim-v2",
    localKey: "mybizcar-prim-v1",
    stateVar: "state",
    readStep: "tab",
    writeStep: "tab = i",
    intro: [
      "Mâm nhân lực CORE / OPEN / DIGITAL: thiết kế công việc, huy động nhân lực mở, triển khai nhân lực số và giữ trách nhiệm rõ ràng. Phân biệt O ở P-RIM với P ở M-RIM.",
      "Tạo hồ sơ doanh nghiệp và kỳ hoạch định; thêm nguồn C/O/D với phút hữu dụng, chi phí, sẵn sàng và bằng chứng; thêm công việc; xem tải từng nguồn; sao chép phương án; thử hệ số nhu cầu; chốt kế hoạch và mở Phiếu hoạch định.",
      "Không cộng phút máy với phút người, không cộng công suất các công đoạn nối tiếp. Kết luận chỉ theo quy tắc hiện tại, không chứng nhận năng lực hay tính tối ưu.",
    ],
    steps: (doc, visited) => {
      const profiles = list(doc.profiles);
      const notes = [rec(doc.notes), ...profiles.map((p) => rec(p.notes))];
      const note = (key: string) => notes.some((n) => text(n[key]));
      const plans = profiles.flatMap((p) => list(p.plans));
      return [
        profiles.length > 0 || note("activate"),
        seen(visited, "paradigm") || profiles.length > 0,
        plans.some((p) => list(p.resources).length > 0 && list(p.tasks).length > 0),
        note("lens"),
        profiles.some((p) => list(p.plans).length > 1) || plans.some((p) => list(p.actions).length > 0),
        note("extract"),
        plans.some((p) => list(p.decisions).length > 0) || note("resolve"),
      ];
    },
    summary: (doc) => {
      const profiles = list(doc.profiles);
      return join(profiles.slice(0, 4).flatMap((p) => {
        const plans = list(p.plans);
        const active = plans.find((plan) => plan.id === p.activePlan) ?? plans[0] ?? {};
        const decision = list(active.decisions).at(-1) ?? {};
        return [
          [p.company, p.sector, p.phase].filter(text).join(" · "),
          line("Mục tiêu", p.goal),
          `Phương án đang chọn: ${String(active.name ?? "—")} · ${list(active.resources).length} nguồn C/O/D · ${list(active.tasks).length} công việc · ${plans.length} phương án`,
          line("Quyết định", decision.choice),
          line("Phạm vi chốt", decision.scope),
          line("Bài học", rec(p.notes).extract),
          line("Cam kết", rec(p.notes).resolve),
        ];
      }));
    },
  },
  {
    id: "pcasing",
    lesson: 14,
    title: "P-Casing",
    framework: "WSC",
    file: "source/bmdo-k03-studios/pcasing/index.html",
    oldKey: "bmdo_k03_buoi14_pcasing_wsc",
    answerKey: "bmdo-k03-buoi14-pcasing-v2",
    localKey: "mybizcar-pcasing-v1",
    stateVar: "s",
    readStep: "tab",
    writeStep: "tab = i",
    intro: [
      "Điều kiện trải nghiệm COD: WorkEx · ServEx · CommEx. 27 tình huống mẫu theo C/O/D × WorkEx/ServEx/CommEx và 12 bối cảnh ngành; mẫu không tạo dữ liệu hay điểm số giả.",
      "Thiết kế EncounterPoint có đối tượng, vai trò, thời kỳ, vấn đề, điều kiện mới, người phụ trách, bằng chứng và kế hoạch đo. P/F/E/X của C/O là phản hồi trực tiếp 1–10; D đo chỉ số vận hành, không có Feel/XENERGY.",
      "Không có điểm tổng COD. Điểm đã có dữ liệu bị khóa thiết kế; tạo phiên bản tiếp để đổi điều kiện. Thu phản hồi tự nguyện, dùng mã ẩn danh.",
    ],
    steps: (doc, visited) => {
      const notes = rec(doc.notes);
      return [
        text(doc.company) || text(notes.activate),
        seen(visited, "paradigm") || list(doc.points).length > 0,
        list(doc.points).length > 0,
        text(notes.lens) || list(doc.feedback).length > 0 || list(doc.readings).length > 0,
        list(doc.actions).length > 0,
        text(notes.extract),
        text(notes.resolve),
      ];
    },
    summary: (doc) => {
      const notes = rec(doc.notes);
      return join([
        [doc.company, doc.sector].filter(text).join(" · "),
        line("Phạm vi", doc.scope),
        `${list(doc.points).length} EncounterPoint · ${list(doc.feedback).length} phản hồi · ${list(doc.readings).length} chỉ số D · ${list(doc.actions).length} kế hoạch`,
        line("EncounterPoint", list(doc.points).slice(0, 12).map((p) => [p.target, p.layer, p.name].filter(text).join(" · ")).join("; ")),
        line("Kế hoạch", names(list(doc.actions), "action")),
        line("Bài học", notes.extract),
        line("Cam kết", notes.resolve),
      ]);
    },
  },
];

export function studioForLesson(number: number) {
  return STUDIOS.find((row) => row.lesson === number) ?? null;
}

export function studioForAnswerKey(answerKey: string) {
  return STUDIOS.find((row) => row.answerKey === answerKey) ?? null;
}

export function emptyEnvelope(id: StudioId): StudioEnvelope {
  return { format: STUDIO_FORMAT, studio: id, version: 2, doc: null, visited: [], outline: "" };
}

export function isEnvelope(value: unknown, id?: StudioId): value is StudioEnvelope {
  const row = rec(value);
  return row.format === STUDIO_FORMAT && row.version === 2 && typeof row.studio === "string" && (!id || row.studio === id);
}

/** Progress of the 7 APPLIER steps; the shell's Overview counts once any step is done. */
export function studioProgress(config: StudioConfig, envelope: StudioEnvelope) {
  const flags = config.steps(rec(envelope.doc), envelope.visited ?? []);
  const done = STUDIO_STEPS.filter((_, index) => flags[index]);
  return {
    done: done.length ? (["overview", ...done] as PhaseId[]) : [],
    progress: Math.round((done.length / STUDIO_STEPS.length) * 100),
  };
}
