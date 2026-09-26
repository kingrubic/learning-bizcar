/** Forced first-login / reset passwords store this as 1. A cleared account is 0. */
export function requiresPasswordChange(flag: number | null | undefined) {
  return flag === 1;
}

export function postLoginPath(role: string) {
  return role === "user" ? "/learn/dashboard" : "/admin/learning";
}

export function loginDestination(flag: number | null | undefined, role: string) {
  return requiresPasswordChange(flag) ? "/learn/password" : postLoginPath(role);
}
