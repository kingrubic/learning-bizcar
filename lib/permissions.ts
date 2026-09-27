import { learningState } from "./access";
import { api, q } from "./convex";
import type { Role } from "./db";

export type SessionUser = {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  organizationId: number | null;
  departmentId: number | null;
  permissionGroupId: number | null;
  active: number;
  mustChangePassword: number;
};

export type MenuItem = {
  key: string;
  label: string;
  href: string;
  area: "learn" | "admin";
  adminOnly?: boolean;
};

export const MENUS: MenuItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/learn/dashboard", area: "learn" },
  { key: "map", label: "Learning Map", href: "/learn/course/bmdo-k03", area: "learn" },
  { key: "workbook", label: "Workbook", href: "/learn/workbook", area: "learn" },
  { key: "portfolio", label: "Portfolio", href: "/learn/portfolio", area: "learn" },
  { key: "tasks", label: "Nhiệm vụ", href: "/learn/tasks", area: "learn" },
  { key: "discussion", label: "Thảo luận", href: "/learn/discussion", area: "learn" },
  { key: "admin-home", label: "Tổng quan", href: "/admin/learning", area: "admin" },
  { key: "admin-courses", label: "Course", href: "/admin/learning/courses", area: "admin" },
  { key: "admin-cohorts", label: "Cohort", href: "/admin/learning/cohorts", area: "admin" },
  { key: "admin-discussion", label: "Thảo luận lớp", href: "/admin/learning/discussion", area: "admin" },
  { key: "admin-learners", label: "Học viên", href: "/admin/learning/learners", area: "admin" },
  { key: "admin-progress", label: "Tiến độ", href: "/admin/learning/progress", area: "admin" },
  { key: "admin-submissions", label: "Bài nộp", href: "/admin/learning/submissions", area: "admin" },
  { key: "admin-tasks", label: "Giao nhiệm vụ", href: "/admin/tasks", area: "admin" },
  { key: "admin-users", label: "Người dùng", href: "/admin/organization/users", area: "admin", adminOnly: true },
  { key: "admin-departments", label: "Phòng ban", href: "/admin/organization/departments", area: "admin", adminOnly: true },
  { key: "admin-groups", label: "Nhóm quyền", href: "/admin/organization/groups", area: "admin", adminOnly: true },
  { key: "admin-cms", label: "CMS", href: "/admin/cms", area: "admin", adminOnly: true },
];

function withMenu(menus: MenuItem[], key: string) {
  if (menus.some((item) => item.key === key)) return menus;
  const item = MENUS.find((entry) => entry.key === key);
  if (!item) return menus;
  const anchor = menus.findIndex((entry) => entry.key === "tasks" || entry.key === "admin-cohorts");
  const next = [...menus];
  next.splice(anchor >= 0 ? anchor + 1 : next.length, 0, item);
  return next;
}

export async function menusFor(user: SessionUser) {
  if (user.role === "admin" || user.role === "mod") {
    const base = user.role === "admin" ? MENUS : MENUS.filter((item) => !item.adminOnly);
    return withMenu(withMenu(base, "discussion"), "admin-discussion");
  }
  const menus = await learnerMenus(user);
  const state = await learningState(user.id);
  const learnAccess = menus.some((item) => item.area === "learn") || Boolean(state.enrollment);
  const next = learnAccess ? withMenu(menus, "discussion") : menus;
  return next.map((item) => item.key === "map" ? { ...item, href: `/learn/course/${state.course.slug}` } : item);
}

async function learnerMenus(user: SessionUser) {
  if (!user.permissionGroupId) return [];
  const rows = await q((convex, secret) => convex.query(api.reads.menuKeys, { secret, groupId: user.permissionGroupId! }));
  const allowed = new Set(rows.map((row) => row.menu_key));
  return MENUS.filter((item) => allowed.has(item.key));
}

export async function canSee(user: SessionUser, key: string) {
  return (await menusFor(user)).some((item) => item.key === key);
}
