import { channelAccess, type ChannelKind } from "../convex/discussionAccess.ts";

const base = {
  staff: false,
  enrolledCohortId: 1 as number | null,
  channelCohortId: 1,
  kind: "class" as ChannelKind,
  archived: false,
  member: false,
};

function expect(input: typeof base, read: boolean, post: boolean, label: string) {
  const got = channelAccess(input);
  if (got.read !== read || got.post !== post) throw new Error(label);
}

expect({ ...base, channelCohortId: 2 }, false, false, "other cohort class");
expect(base, true, true, "own class");
expect({ ...base, kind: "group" }, false, false, "group outsider");
expect({ ...base, kind: "group", member: true }, true, true, "group member");
expect({ ...base, kind: "group", staff: true, enrolledCohortId: null, channelCohortId: 9 }, true, true, "staff any group");
expect({ ...base, archived: true }, false, false, "learner archived class");
expect({ ...base, kind: "group", member: true, archived: true }, false, false, "learner archived group");
expect({ ...base, staff: true, archived: true }, true, false, "staff archived read only");
expect({ ...base, staff: true, enrolledCohortId: null, kind: "class", channelCohortId: 4 }, true, true, "staff class");
console.log("discussion-access ok");
