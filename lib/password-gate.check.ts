import { loginDestination, postLoginPath, requiresPasswordChange } from "./password-gate.ts";

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}

assert(requiresPasswordChange(1), "temporary password still requires a change");
assert(!requiresPasswordChange(0), "cleared flag must not require a change");
assert(!requiresPasswordChange(null), "missing flag must not trap an account");
assert(!requiresPasswordChange(undefined), "undefined flag must not trap an account");
assert(!requiresPasswordChange(true), "boolean true is not the stored flag");
assert(!requiresPasswordChange(false), "boolean false is cleared");
assert(!requiresPasswordChange("1"), "string 1 must not keep the gate shut");

assert(loginDestination(1, "user") === "/learn/password", "learner with a temporary password");
assert(loginDestination(0, "user") === "/learn/dashboard", "learner after a successful change");
assert(loginDestination(0, "admin") === "/admin/learning", "staff after a successful change");
assert(loginDestination(1, "mod") === "/learn/password", "reset password still gates staff");
assert(postLoginPath("user") === "/learn/dashboard", "learner home");
assert(postLoginPath("admin") === "/admin/learning", "staff home");

console.log("password-gate ok");
