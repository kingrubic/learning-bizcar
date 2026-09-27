import { instructorAssignmentError, PRACTICAL_INSTRUCTOR_GROUP, PRACTICAL_INSTRUCTOR_MENUS } from "../convex/catalog.ts";

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}

assert(PRACTICAL_INSTRUCTOR_GROUP === "giảng viên dẫn giảng thực hành", "exact group name");
const menus = new Set<string>(PRACTICAL_INSTRUCTOR_MENUS);
for (const key of ["dashboard", "map", "admin-progress", "admin-submissions", "tasks", "discussion"]) {
  assert(menus.has(key), `menu ${key}`);
}
for (const key of ["admin-users", "admin-departments", "admin-groups", "admin-cms", "admin-courses", "admin-discussion"]) {
  assert(!menus.has(key), `no ${key}`);
}

const groupId = 7;
const member = { active: 1, role: "user" as const, permissionGroupId: groupId };
const admin = { active: 1, role: "admin" as const, permissionGroupId: 1 };
const mod = { active: 1, role: "mod" as const, permissionGroupId: null };
assert(instructorAssignmentError({ instructorId: null, existingInstructorId: null, groupId, user: null }) === null, "clear");
assert(instructorAssignmentError({ instructorId: 3, existingInstructorId: null, groupId, user: member }) === null, "member");
assert(instructorAssignmentError({ instructorId: 3, existingInstructorId: null, groupId, user: admin }) === null, "admin");
assert(instructorAssignmentError({ instructorId: 3, existingInstructorId: null, groupId, user: mod }) === null, "mod");
assert(instructorAssignmentError({ instructorId: 3, existingInstructorId: null, groupId: null, user: admin }) === null, "admin without group");
assert(instructorAssignmentError({ instructorId: 3, existingInstructorId: null, groupId, user: { active: 0, role: "user", permissionGroupId: groupId } }) !== null, "inactive");
assert(instructorAssignmentError({ instructorId: 3, existingInstructorId: null, groupId, user: { active: 0, role: "admin", permissionGroupId: null } }) !== null, "inactive admin");
assert(instructorAssignmentError({ instructorId: 3, existingInstructorId: null, groupId, user: { active: 1, role: "user", permissionGroupId: 1 } }) !== null, "plain user");
assert(instructorAssignmentError({ instructorId: 3, existingInstructorId: null, groupId: null, user: member }) !== null, "missing group");
assert(instructorAssignmentError({ instructorId: 3, existingInstructorId: 3, groupId, user: { active: 0, role: "user", permissionGroupId: 1 } }) === null, "keep current");
assert(instructorAssignmentError({ instructorId: 4, existingInstructorId: 3, groupId, user: null }) !== null, "missing user");

console.log("instructor-group ok");
