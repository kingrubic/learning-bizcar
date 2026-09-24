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
  { key: "admin-home", label: "Tổng quan", href: "/admin/learning", area: "admin" },
  { key: "admin-courses", label: "Course", href: "/admin/learning/courses", area: "admin" },
  { key: "admin-cohorts", label: "Cohort", href: "/admin/learning/cohorts", area: "admin" },
  { key: "admin-learners", label: "Học viên", href: "/admin/learning/learners", area: "admin" },
  { key: "admin-progress", label: "Tiến độ", href: "/admin/learning/progress", area: "admin" },
  { key: "admin-submissions", label: "Bài nộp", href: "/admin/learning/submissions", area: "admin" },
  { key: "admin-tasks", label: "Giao nhiệm vụ", href: "/admin/tasks", area: "admin" },
  { key: "admin-users", label: "Người dùng", href: "/admin/organization/users", area: "admin", adminOnly: true },
  { key: "admin-departments", label: "Phòng ban", href: "/admin/organization/departments", area: "admin", adminOnly: true },
  { key: "admin-groups", label: "Nhóm quyền", href: "/admin/organization/groups", area: "admin", adminOnly: true },
  { key: "admin-cms", label: "CMS", href: "/admin/cms", area: "admin", adminOnly: true },
];

export async function menusFor(user: SessionUser) {
  if (user.role === "admin") return MENUS;
  if (user.role === "mod") return MENUS.filter((item) => !item.adminOnly);
  if (!user.permissionGroupId) return [];
  const rows = await q((convex, secret) => convex.query(api.reads.menuKeys, { secret, groupId: user.permissionGroupId! }));
  const allowed = new Set(rows.map((row) => row.menu_key));
  return MENUS.filter((item) => allowed.has(item.key));
}

export async function canSee(user: SessionUser, key: string) {
  return (await menusFor(user)).some((item) => item.key === key);
}
