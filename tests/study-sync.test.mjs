import test from "node:test";
import assert from "node:assert/strict";
import {
  reconcileStudySave,
  resolveStudyConflict,
} from "../src/lib/study-sync.ts";
test("typing while a save is in flight preserves new text and schedules another save", () => {
  const result = reconcileStudySave(
    { body: "new edit", revision: 1 },
    { body: "old edit", revision: 2 },
    true,
  );
  assert.deepEqual(result, {
    value: { body: "new edit", revision: 2 },
    phase: "pending",
  });
});
test("an acknowledged unchanged edit is the only cloud-synced state", () => {
  assert.deepEqual(
    reconcileStudySave(
      { body: "my edit", revision: 1 },
      { body: "my edit", revision: 2 },
      false,
    ),
    { value: { body: "my edit", revision: 2 }, phase: "synced" },
  );
});
test("explicit conflict choices either use cloud text or retain local text with latest revision", () => {
  assert.deepEqual(
    resolveStudyConflict(
      { body: "mine", revision: 1 },
      { body: "remote", revision: 3 },
      "keep-local",
    ),
    { value: { body: "mine", revision: 3 }, phase: "pending" },
  );
  assert.deepEqual(
    resolveStudyConflict(
      { body: "mine", revision: 1 },
      { body: "remote", revision: 3 },
      "use-cloud",
    ),
    { value: { body: "remote", revision: 3 }, phase: "synced" },
  );
});
