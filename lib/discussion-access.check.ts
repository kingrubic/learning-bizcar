import { channelAccess, draftFromMessages, type ChannelKind } from "../convex/discussionAccess.ts";

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
const draft = draftFromMessages([
  { authorName: "An", body: "hello\nworld", fileCount: 0 },
  { authorName: "Bình", body: "", fileCount: 2 },
  { authorName: "C", body: "   ", fileCount: 0 },
], (count) => `${count} files`);
if (draft !== "- An: hello\n- Bình: 2 files") throw new Error(`draft ${draft}`);
const cut = draftFromMessages([{ authorName: "D", body: "x".repeat(200), fileCount: 0 }], () => "");
if (!cut.startsWith("- D: ") || !cut.endsWith("…")) throw new Error("cut");
const many = draftFromMessages(Array.from({ length: 40 }, (_, i) => ({ authorName: String(i), body: "m", fileCount: 0 })), () => "");
if (many.split("\n").length !== 30 || !many.startsWith("- 10:")) throw new Error("window");
console.log("discussion-access ok");
