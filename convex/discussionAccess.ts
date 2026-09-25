export type ChannelKind = "class" | "group";

export const DISCUSSION_BODY_MAX = 2000;
export const DISCUSSION_NAME_MAX = 80;
export const DISCUSSION_HISTORY_MAX = 200;

export function channelAccess(input: {
  staff: boolean;
  enrolledCohortId: number | null;
  channelCohortId: number;
  kind: ChannelKind;
  archived: boolean;
  member: boolean;
}): { read: boolean; post: boolean } {
  if (!input.staff && input.archived) return { read: false, post: false };
  const inCohort = input.staff || input.enrolledCohortId === input.channelCohortId;
  if (!inCohort) return { read: false, post: false };
  if (input.kind === "group" && !input.staff && !input.member) return { read: false, post: false };
  return { read: true, post: !input.archived };
}

export function assertChannelAccess() {
  const base = {
    staff: false,
    enrolledCohortId: 1 as number | null,
    channelCohortId: 1,
    kind: "class" as ChannelKind,
    archived: false,
    member: false,
  };
  const expect = (input: typeof base, read: boolean, post: boolean, label: string) => {
    const got = channelAccess(input);
    if (got.read !== read || got.post !== post) throw new Error(label);
  };
  expect({ ...base, channelCohortId: 2 }, false, false, "other cohort class");
  expect(base, true, true, "own class");
  expect({ ...base, kind: "group" }, false, false, "group outsider");
  expect({ ...base, kind: "group", member: true }, true, true, "group member");
  expect({ ...base, kind: "group", staff: true, enrolledCohortId: null, channelCohortId: 9 }, true, true, "staff any group");
  expect({ ...base, archived: true }, false, false, "learner archived class");
  expect({ ...base, kind: "group", member: true, archived: true }, false, false, "learner archived group");
  expect({ ...base, staff: true, archived: true }, true, false, "staff archived read only");
  expect({ ...base, staff: true, enrolledCohortId: null, kind: "class", channelCohortId: 4 }, true, true, "staff class");
}

if (typeof process !== "undefined" && process.argv[1]?.endsWith("discussionAccess.ts")) {
  assertChannelAccess();
  console.log("discussion-access ok");
}
