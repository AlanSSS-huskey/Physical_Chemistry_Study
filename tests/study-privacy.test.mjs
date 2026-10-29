import test from "node:test";
import assert from "node:assert/strict";
import {
  studyCollectionItem,
  assertStudyOwner,
} from "../src/lib/study-privacy.ts";
test("unavailable chapter metadata never escapes into a saved collection while original private writing stays readable", () => {
  const item = studyCollectionItem(
    {
      contentSlug: "private/chapter",
      locale: "en",
      body: "my own explanation",
      updatedAt: new Date("2026-10-29"),
    },
    null,
    "zh",
  );
  assert.equal(item.title, null);
  assert.equal(item.subjectTitle, null);
  assert.equal(item.available, false);
  assert.equal(item.body, "my own explanation");
  assert.equal(item.locale, "en");
  assert.equal(JSON.stringify(item).includes("restricted textbook"), false);
});
test("readable collection metadata is allowlisted and never includes course body", () => {
  const item = studyCollectionItem(
    { contentSlug: "chemistry/intro", progress: 0.4, anchor: "section-intro" },
    {
      title: "Introduction",
      subjectTitle: "Chemistry",
      body: "restricted textbook body",
      isAdmin: true,
    },
    "zh",
  );
  assert.equal(item.title, "Introduction");
  assert.equal(item.progress, 0.4);
  assert.equal("isAdmin" in item, false);
  assert.equal("body" in item, false);
});
test("an old rendered account cannot read or save through a different live session", () => {
  assert.doesNotThrow(() => assertStudyOwner("alice", "alice"));
  for (const expected of ["bob", null, ""])
    assert.throws(
      () => assertStudyOwner(expected, "alice"),
      (e) => e.code === "SESSION_CHANGED" && e.status === 409,
    );
});
