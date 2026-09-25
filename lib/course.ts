export const COURSE = {
  slug: "bmdo-k03",
  code: "BMDO K03",
  title: "BizCar Management Design",
  tagline: "Thiết kế hệ thống quản trị MyBizCar của chính doanh nghiệp.",
} as const;

export type PhaseId =
  | "overview"
  | "activate"
  | "paradigm"
  | "practice"
  | "lens"
  | "improve"
  | "extract"
  | "resolve"
  | "report";

export const PHASES: { id: PhaseId; label: string; letter: string }[] = [
  { id: "overview", label: "Overview", letter: "●" },
  { id: "activate", label: "Activate", letter: "A" },
  { id: "paradigm", label: "Paradigm", letter: "P" },
  { id: "practice", label: "Practice", letter: "P" },
  { id: "lens", label: "Lens", letter: "L" },
  { id: "improve", label: "Improve", letter: "I" },
  { id: "extract", label: "Extract", letter: "E" },
  { id: "resolve", label: "Resolve", letter: "R" },
  { id: "report", label: "Report", letter: "H" },
];

export type LessonMeta = {
  number: number;
  code: string;
  title: string;
  framework: string;
  summary: string;
  group: "FOUNDATION" | "ENGINE" | "VALUE WHEEL" | "MARKET WHEEL" | "PEOPLE WHEEL" | "FINANCE WHEEL" | "TRANSMISSION" | "CHASSIS";
  hasReport: boolean;
  storageKey: string;
  schemaVersion: string;
  contentVersion: string;
};

export const LESSONS: LessonMeta[] = [
  { number: 1, code: "01", title: "12 Miền quản trị", framework: "12 Domains", summary: "Nhận diện 12 miền quản trị doanh nghiệp toàn diện.", group: "FOUNDATION", hasReport: false, storageKey: "bmdo-k03-buoi01-domains-v1", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 2, code: "02", title: "MyBizCar", framework: "MyBizCar", summary: "Bản đồ toàn cảnh MyBizCar.", group: "FOUNDATION", hasReport: false, storageKey: "bmdo-k03-buoi02-myBizCar-v1", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 3, code: "03", title: "BizCar Engine", framework: "MTUA", summary: "Meaningful Mission, Targeted Aspiration, Unwavering Commitment, Anchoring Values.", group: "ENGINE", hasReport: false, storageKey: "bmdo-k03-buoi03-mtua-v1", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 4, code: "04", title: "V-Rim", framework: "VBF", summary: "Value, Benefits, Features.", group: "VALUE WHEEL", hasReport: false, storageKey: "bmdo-k03-buoi04-vrim-v1", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 5, code: "05", title: "V-Air", framework: "LEAR", summary: "Logical Coherence, Evidence, Accountability, Reliability.", group: "VALUE WHEEL", hasReport: false, storageKey: "bmdo-k03-buoi05-lear-v1", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 6, code: "06", title: "V-Casing", framework: "CXC", summary: "Customer Experience Composition.", group: "VALUE WHEEL", hasReport: false, storageKey: "bmdo-k03-buoi06-cxc-v1", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 7, code: "07", title: "V-Tread", framework: "DFARS", summary: "Demandability, Fit, Advantage, Resistance, Staying Power.", group: "VALUE WHEEL", hasReport: false, storageKey: "bmdo-k03-buoi07-dfars-v1", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 8, code: "08", title: "M-Rim", framework: "SCP", summary: "Segment, Channel, Partner.", group: "MARKET WHEEL", hasReport: false, storageKey: "bmdo-k03-buoi08-scp-v1", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 9, code: "09", title: "M-Air", framework: "CIB", summary: "Capability, Integrity, Benevolence.", group: "MARKET WHEEL", hasReport: true, storageKey: "bmdo_k03_buoi09_mair_cib", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 10, code: "10", title: "M-Casing", framework: "PFE", summary: "Perceive, Feel, Evaluate.", group: "MARKET WHEEL", hasReport: true, storageKey: "bmdo_k03_buoi10_mcasing_pfe", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 11, code: "11", title: "M-Tread", framework: "GRIP", summary: "Gets Adopted, Remains in Use, Increases in Use, Prompts Advocacy.", group: "MARKET WHEEL", hasReport: true, storageKey: "bmdo_k03_buoi11_mtread_grip", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 12, code: "12", title: "P-Rim", framework: "COD", summary: "Core, Open, Digital. Bắt đầu từ công việc và khả lực cần có.", group: "PEOPLE WHEEL", hasReport: true, storageKey: "bmdo_k03_buoi12_prim_cod", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 13, code: "13", title: "P-Air", framework: "CRISS", summary: "Niềm tin là một cấu kiện được hiệu chuẩn.", group: "PEOPLE WHEEL", hasReport: true, storageKey: "bmdo_k03_buoi13_pair_criss", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 14, code: "14", title: "P-Casing", framework: "WSC", summary: "Work, Service, Communication. Lớp trải nghiệm bao quanh hệ nhân lực.", group: "PEOPLE WHEEL", hasReport: true, storageKey: "bmdo_k03_buoi14_pcasing_wsc", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 15, code: "15", title: "P-Tread", framework: "MAPY", summary: "Meaning, Advantage, Pride, Yield. Lực bám của sự đóng góp.", group: "PEOPLE WHEEL", hasReport: true, storageKey: "bmdo_k03_buoi15_ptread_mapy", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 16, code: "16", title: "F-Rim", framework: "FPC", summary: "Financial Position, Profit, Cash. Ba sự thật tài chính.", group: "FINANCE WHEEL", hasReport: true, storageKey: "bmdo_k03_buoi16_frim_fpc", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 17, code: "17", title: "F-Air", framework: "GRELS", summary: "Governance, Risk, Earnings Quality, Liquidity, Solvency. Niềm tin tài chính có căn cứ.", group: "FINANCE WHEEL", hasReport: true, storageKey: "bmdo_k03_buoi17_fair_grels", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 18, code: "18", title: "F-Casing", framework: "RFE", summary: "Clear Rules, Smooth Flow, Verifiable Evidence. Tình huống tài chính được nhìn thấy và kiểm chứng.", group: "FINANCE WHEEL", hasReport: true, storageKey: "bmdo_k03_buoi18_rfe_v1", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 19, code: "19", title: "F-Tread", framework: "4C1R", summary: "Cash Conversion, Cost & Obligation, Capital Allocation, Capital Productivity, Financial Resilience. Sức bám và lực đẩy tài chính.", group: "FINANCE WHEEL", hasReport: false, storageKey: "bmdo-k03-buoi19-ftread-v1", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 20, code: "20", title: "GTS / KTO", framework: "KTO", summary: "Gearbox & Transmission System. KAROT, Transmission Flow và Operating Control chuyển mục tiêu thành chuyển động có phối hợp.", group: "TRANSMISSION", hasReport: true, storageKey: "bmdo_k03_buoi20_gts_kto_v1", schemaVersion: "1", contentVersion: "2026.09" },
  { number: 21, code: "21", title: "Chassis / SGD", framework: "SGD", summary: "Chassis System. Structure, Governance và Decision Rights thiết kế khung gầm để doanh nghiệp gánh tải mà không mất ổn định.", group: "CHASSIS", hasReport: false, storageKey: "bmdo_k03_buoi21_chassis_sgd_v1", schemaVersion: "1", contentVersion: "2026.09" },
];

export const GROUPS = ["FOUNDATION", "ENGINE", "VALUE WHEEL", "MARKET WHEEL", "PEOPLE WHEEL", "FINANCE WHEEL", "TRANSMISSION", "CHASSIS"] as const;

export function lessonByNumber(n: number) {
  return LESSONS.find((l) => l.number === n);
}

export function phasesFor(lesson: LessonMeta) {
  return PHASES.filter((p) => p.id !== "report" || lesson.hasReport);
}

export type WorkbookField = { path: string; label: string };

export const WORKBOOK: Record<number, WorkbookField[]> = {
  1: [
    { path: "profile.company", label: "Doanh nghiệp" },
    { path: "profile.industry", label: "Lĩnh vực" },
    { path: "practice.question", label: "Câu hỏi quản trị đang soi" },
    { path: "improve.statement", label: "Nhận định sau khi nhìn đủ 12 miền" },
    { path: "improve.assumption", label: "Giả định cần kiểm chứng" },
    { path: "extract.principle", label: "Nguyên tắc mang theo" },
    { path: "resolve.action", label: "Hành động 7 ngày" },
    { path: "resolve.evidence", label: "Bằng chứng" },
  ],
  2: [
    { path: "profile.company", label: "Doanh nghiệp" },
    { path: "map.priorityReason", label: "Vì sao ưu tiên cấu phần này" },
    { path: "improve.key", label: "Điểm cải tiến bản đồ" },
    { path: "extract.principle", label: "Nguyên tắc mang theo" },
    { path: "extract.realization", label: "Điều nhận ra" },
    { path: "resolve.action", label: "Kiểm chứng 7 ngày" },
    { path: "resolve.question", label: "Câu hỏi kiểm chứng" },
  ],
  3: [
    { path: "profile.company", label: "Doanh nghiệp" },
    { path: "decision.text", label: "Quyết định đang soi" },
    { path: "mtua.m.statement", label: "Meaningful Mission" },
    { path: "mtua.t.statement", label: "Targeted Aspiration" },
    { path: "mtua.u.statement", label: "Unwavering Commitment" },
    { path: "improve.m", label: "M sau cải tiến" },
    { path: "improve.t", label: "T sau cải tiến" },
    { path: "improve.u", label: "U sau cải tiến" },
    { path: "improve.a", label: "A sau cải tiến" },
    { path: "improve.priority", label: "Phải ưu tiên" },
    { path: "improve.stop", label: "Cần dừng / từ chối" },
    { path: "resolve.action", label: "Cam kết kích hoạt" },
  ],
  4: [
    { path: "profile.company", label: "Doanh nghiệp" },
    { path: "practice.statement", label: "Câu VBF" },
    { path: "improve.before", label: "VBF trước" },
    { path: "improve.after", label: "VBF sau" },
    { path: "extract.principle", label: "Nguyên tắc" },
    { path: "resolve.action", label: "Kiểm chứng" },
    { path: "resolve.hypothesis", label: "Giả thuyết" },
  ],
  5: [
    { path: "profile.company", label: "Doanh nghiệp" },
    { path: "improve.stopClaim", label: "Lời hứa cần dừng" },
    { path: "improve.newClaim", label: "Lời hứa được hiệu chỉnh" },
    { path: "extract.one", label: "Bài học 1" },
    { path: "extract.two", label: "Bài học 2" },
    { path: "extract.three", label: "Bài học 3" },
    { path: "resolve.action", label: "Hành động tạo bằng chứng" },
    { path: "resolve.evidence", label: "Bằng chứng" },
  ],
  6: [
    { path: "profile.company", label: "Doanh nghiệp" },
    { path: "improve.statement", label: "Điều kiện trải nghiệm sau cải tiến" },
    { path: "improve.before", label: "Trước" },
    { path: "improve.after", label: "Sau" },
    { path: "resolve.action", label: "Hành động 7 ngày" },
    { path: "resolve.evidence", label: "Bằng chứng" },
    { path: "resolve.owner", label: "Chủ sở hữu" },
  ],
  7: [
    { path: "profile.company", label: "Doanh nghiệp" },
    { path: "improve.statement", label: "Sức bám sau cải tiến" },
    { path: "improve.why", label: "Vì sao mắt gai này" },
    { path: "extract.one", label: "Bài học 1" },
    { path: "extract.two", label: "Bài học 2" },
    { path: "extract.three", label: "Bài học 3" },
    { path: "resolve.hypothesis", label: "Giả thuyết kiểm chứng" },
    { path: "resolve.action", label: "Hành động" },
  ],
  8: [
    { path: "profile.company", label: "Doanh nghiệp" },
    { path: "improve.segment", label: "Segment" },
    { path: "improve.channel", label: "Channel" },
    { path: "improve.partner", label: "Partner" },
    { path: "improve.address", label: "Địa chỉ thị trường" },
    { path: "resolve.hypothesis", label: "Giả thuyết SCP" },
    { path: "resolve.action", label: "Kiểm chứng" },
  ],
  9: [
    { path: "segment", label: "Phân khúc" },
    { path: "promise", label: "Lời hứa niềm tin" },
    { path: "improved_belief", label: "Niềm tin sau cải tiến" },
    { path: "improved_c", label: "Capability" },
    { path: "improved_i", label: "Integrity" },
    { path: "improved_b", label: "Benevolence" },
    { path: "action", label: "Cam kết 7 ngày" },
    { path: "evidence_collect", label: "Bằng chứng cần thu" },
  ],
  10: [
    { path: "segment", label: "Phân khúc" },
    { path: "vbf", label: "VBF đang soi" },
    { path: "improved_perceive", label: "Perceive" },
    { path: "improved_feel", label: "Feel" },
    { path: "improved_evaluate", label: "Evaluate" },
    { path: "improved_condition", label: "Điều kiện sau cải tiến" },
    { path: "lesson1", label: "Bài học 1" },
    { path: "lesson2", label: "Bài học 2" },
    { path: "lesson3", label: "Bài học 3" },
  ],
  11: [
    { path: "vbf", label: "VBF" },
    { path: "segment", label: "Phân khúc" },
    { path: "priority_behavior", label: "Hành vi ưu tiên" },
    { path: "improvement", label: "Cải tiến sức bám" },
    { path: "test_hypothesis", label: "Giả thuyết kiểm chứng" },
    { path: "test_action", label: "Hành động" },
    { path: "lesson1", label: "Bài học 1" },
    { path: "lesson2", label: "Bài học 2" },
    { path: "lesson3", label: "Bài học 3" },
  ],
  12: [
    { path: "segment", label: "Phạm vi thiết kế" },
    { path: "core_solution", label: "Khả lực Core" },
    { path: "improve_work", label: "Công việc được tái thiết kế" },
    { path: "improve_core", label: "Core sau cải tiến" },
    { path: "improve_open", label: "Open sau cải tiến" },
    { path: "improve_digital", label: "Digital sau cải tiến" },
    { path: "lesson1", label: "Bài học 1" },
    { path: "lesson2", label: "Bài học 2" },
    { path: "lesson3", label: "Bài học 3" },
    { path: "commit", label: "Cam kết" },
  ],
  13: [
    { path: "decision", label: "Quyết định niềm tin đang soi" },
    { path: "delegated_responsibility", label: "Trách nhiệm được trao" },
    { path: "final_owner", label: "Chủ sở hữu cuối" },
    { path: "key_evidence", label: "Bằng chứng then chốt" },
    { path: "after_design", label: "Thiết kế sau hiệu chỉnh" },
    { path: "lesson1", label: "Bài học 1" },
    { path: "lesson2", label: "Bài học 2" },
    { path: "lesson3", label: "Bài học 3" },
    { path: "test_action", label: "Hành động kiểm chứng" },
    { path: "commit", label: "Cam kết" },
  ],
  14: [
    { path: "profile.company", label: "Doanh nghiệp" },
    { path: "statement.work", label: "Work" },
    { path: "statement.service", label: "Service" },
    { path: "statement.communication", label: "Communication" },
    { path: "improve.after", label: "P-Casing sau cải tiến" },
    { path: "extract.0", label: "Bài học 1" },
    { path: "extract.1", label: "Bài học 2" },
    { path: "extract.2", label: "Bài học 3" },
    { path: "resolve.action", label: "Thử nghiệm 7 ngày" },
    { path: "resolve.evidence", label: "Bằng chứng" },
  ],
  15: [
    { path: "profile.company", label: "Doanh nghiệp" },
    { path: "statement.meaning", label: "Meaning" },
    { path: "statement.advantage", label: "Advantage" },
    { path: "statement.pride", label: "Pride" },
    { path: "statement.yield", label: "Yield" },
    { path: "improve.after", label: "P-Tread sau cải tiến" },
    { path: "extract.0", label: "Bài học 1" },
    { path: "extract.1", label: "Bài học 2" },
    { path: "extract.2", label: "Bài học 3" },
    { path: "resolve.action", label: "Cam kết 7 ngày" },
  ],
  16: [
    { path: "profile.company", label: "Doanh nghiệp" },
    { path: "scope.decision", label: "Quyết định tài chính đang soi" },
    { path: "improve.decision", label: "Quyết định sau FPC" },
    { path: "improve.after", label: "Đọc FPC sau cải tiến" },
    { path: "improve.guardrail", label: "Hàng rào bảo vệ" },
    { path: "extract.0", label: "Bài học 1" },
    { path: "extract.1", label: "Bài học 2" },
    { path: "extract.2", label: "Bài học 3" },
    { path: "resolve.action", label: "Hành động 7 ngày" },
    { path: "resolve.evidence", label: "Bằng chứng" },
  ],
  17: [
    { path: "profile.company", label: "Doanh nghiệp" },
    { path: "claim.statement", label: "Nhận định cần được tin" },
    { path: "claim.decision", label: "Quyết định phụ thuộc" },
    { path: "profileGrels.impact", label: "Mắt xích yếu làm suy giảm niềm tin" },
    { path: "profileGrels.missing", label: "Bằng chứng cần bổ sung" },
    { path: "improve.action", label: "Cơ chế củng cố niềm tin" },
    { path: "extract.0", label: "Bài học 1" },
    { path: "extract.1", label: "Bài học 2" },
    { path: "extract.2", label: "Bài học 3" },
    { path: "resolve.action", label: "Hành động 7 ngày" },
    { path: "resolve.evidence", label: "Bằng chứng" },
  ],
  18: [
    { path: "profile.outcome", label: "Kết quả cần tạo" },
    { path: "profile.decider", label: "Người quyết định" },
    { path: "profile.controller", label: "Người kiểm soát" },
    { path: "improve.top1", label: "Cải tiến 1" },
    { path: "improve.top2", label: "Cải tiến 2" },
    { path: "improve.top3", label: "Cải tiến 3" },
    { path: "extract.0", label: "Bài học 1" },
    { path: "extract.1", label: "Bài học 2" },
    { path: "extract.2", label: "Bài học 3" },
    { path: "resolve.action", label: "Hành động" },
    { path: "resolve.evidence", label: "Bằng chứng" },
  ],
  19: [
    { path: "meta.company", label: "Doanh nghiệp" },
    { path: "meta.context", label: "Bối cảnh tài chính" },
    { path: "activate.priority", label: "Tín hiệu ưu tiên" },
    { path: "practice.cashLock", label: "Điểm khóa dòng tiền" },
    { path: "practice.weakHypothesis", label: "Mắt gai yếu" },
    { path: "improve.keyImprovement", label: "Cải tiến quan trọng nhất" },
    { path: "extract.lesson1", label: "Bài học 1" },
    { path: "extract.lesson2", label: "Bài học 2" },
    { path: "extract.lesson3", label: "Bài học 3" },
    { path: "resolve.action", label: "Cam kết 7 ngày" },
    { path: "resolve.evidence", label: "Bằng chứng" },
  ],
  20: [
    { path: "profile.company", label: "Doanh nghiệp" },
    { path: "profile.name", label: "Người thiết kế" },
    { path: "karot.priority", label: "Mục tiêu ưu tiên" },
    { path: "karot.target", label: "Target" },
    { path: "karot.owner", label: "Chủ sở hữu Target" },
    { path: "flow.outcome", label: "Outcome của dòng vận hành" },
    { path: "flow.lock", label: "Điểm khóa dòng vận hành" },
    { path: "lens.key", label: "Điểm yếu then chốt" },
    { path: "improve.0", label: "Cải tiến 1" },
    { path: "improve.1", label: "Cải tiến 2" },
    { path: "improve.2", label: "Cải tiến 3" },
    { path: "extract.0", label: "Bài học 1" },
    { path: "extract.1", label: "Bài học 2" },
    { path: "extract.2", label: "Bài học 3" },
    { path: "resolve.action", label: "Hành động 7 ngày" },
    { path: "resolve.owner", label: "Chủ sở hữu" },
    { path: "resolve.evidence", label: "Bằng chứng" },
  ],
  21: [
    { path: "profile.company", label: "Doanh nghiệp" },
    { path: "profile.name", label: "Người thiết kế" },
    { path: "activate.domain", label: "Miền quyết định" },
    { path: "activate.decision", label: "Quyết định đang chậm" },
    { path: "structure.result", label: "Kết quả Structure" },
    { path: "structure.change", label: "Thay đổi Structure" },
    { path: "governance.protect", label: "Governance bảo vệ" },
    { path: "governance.change", label: "Thay đổi Governance" },
    { path: "decision.redesign", label: "Thiết kế lại quyền quyết định" },
    { path: "decision.newOwner", label: "Người quyết định mới" },
    { path: "lens.key", label: "Điểm yếu then chốt" },
    { path: "improve.0", label: "Cải tiến 1" },
    { path: "improve.1", label: "Cải tiến 2" },
    { path: "improve.2", label: "Cải tiến 3" },
    { path: "extract.0", label: "Bài học 1" },
    { path: "extract.1", label: "Bài học 2" },
    { path: "extract.2", label: "Bài học 3" },
    { path: "resolve.action", label: "Hành động 7 ngày" },
    { path: "resolve.owner", label: "Chủ sở hữu" },
    { path: "resolve.evidence", label: "Bằng chứng" },
  ],
};

export const PORTFOLIO: Record<number, { heading: string; paths: WorkbookField[] }> = {
  1: { heading: "12-Domain Map", paths: WORKBOOK[1] },
  2: { heading: "MyBizCar Overview", paths: WORKBOOK[2] },
  3: { heading: "MTUA Engine", paths: WORKBOOK[3].filter((f) => f.path.startsWith("improve") || f.path.startsWith("mtua") || f.path === "decision.text") },
  4: { heading: "V-Rim", paths: WORKBOOK[4] },
  5: { heading: "V-Air", paths: WORKBOOK[5] },
  6: { heading: "V-Casing", paths: WORKBOOK[6] },
  7: { heading: "V-Tread", paths: WORKBOOK[7] },
  8: { heading: "M-Rim", paths: WORKBOOK[8] },
  9: { heading: "M-Air", paths: WORKBOOK[9] },
  10: { heading: "M-Casing", paths: WORKBOOK[10] },
  11: { heading: "M-Tread", paths: WORKBOOK[11] },
  12: { heading: "P-Rim", paths: WORKBOOK[12] },
  13: { heading: "P-Air", paths: WORKBOOK[13] },
  14: { heading: "P-Casing", paths: WORKBOOK[14] },
  15: { heading: "P-Tread", paths: WORKBOOK[15] },
  16: { heading: "F-Rim", paths: WORKBOOK[16] },
  17: { heading: "F-Air", paths: WORKBOOK[17] },
  18: { heading: "F-Casing", paths: WORKBOOK[18] },
  19: { heading: "F-Tread", paths: WORKBOOK[19] },
  20: { heading: "GTS / KTO", paths: WORKBOOK[20] },
  21: { heading: "Chassis / SGD", paths: WORKBOOK[21] },
};

export function readPath(source: unknown, path: string): string {
  const value = path.split(".").reduce<unknown>((obj, key) => {
    if (obj && typeof obj === "object" && key in (obj as Record<string, unknown>)) {
      return (obj as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}
