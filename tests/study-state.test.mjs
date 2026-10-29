import test from "node:test";
import assert from "node:assert/strict";
import {
  validateStudyIdentity,
  validateStudyNote,
  validateStudyPosition,
  validateStudyPreferences,
  saveStudyRevision,
} from "../src/lib/study-state.ts";

test("study identities separate chapter language and reject invalid paths", () => {
  assert.deepEqual(
    validateStudyIdentity({
      slug: "thermodynamics/intro",
      locale: "zh",
      userId: "other",
    }),
    { contentSlug: "thermodynamics/intro", locale: "zh" },
  );
  for (const bad of [
    { slug: "../private", locale: "en" },
    { slug: "ok", locale: "fr" },
    { slug: "a".repeat(241), locale: "zh" },
  ])
    assert.throws(() => validateStudyIdentity(bad), {
      code: "VALIDATION_ERROR",
    });
});
test("private notes retain literal text and bound memory rather than accepting HTML contracts", () => {
  assert.deepEqual(
    validateStudyNote({
      body: "<script>not HTML</script>\n我的笔记",
      revision: 2,
    }),
    { body: "<script>not HTML</script>\n我的笔记", revision: 2 },
  );
  for (const bad of [
    { body: "a".repeat(5001), revision: 0 },
    { body: "a", revision: -1 },
    { body: "a", revision: 1.2 },
    { body: "a\0", revision: 0 },
  ])
    assert.throws(() => validateStudyNote(bad), { code: "VALIDATION_ERROR" });
});
test("positions are finite ratios and anchors, never completion statuses", () => {
  assert.deepEqual(
    validateStudyPosition({
      progress: 0.8,
      anchor: "entropy-熵",
      revision: 3,
      status: "COMPLETED",
    }),
    { progress: 0.8, anchor: "entropy-熵", revision: 3 },
  );
  for (const progress of [-0.1, 1.1, NaN, Infinity, "1"])
    assert.throws(
      () => validateStudyPosition({ progress, anchor: null, revision: 0 }),
      { code: "VALIDATION_ERROR" },
    );
});
test("reading preferences allow a finite accessible range", () => {
  assert.deepEqual(
    validateStudyPreferences({
      fontSize: 20,
      lineHeight: 1.8,
      theme: "sepia",
      revision: 0,
    }),
    { fontSize: 20, lineHeight: 1.8, theme: "sepia", revision: 0 },
  );
  for (const bad of [
    { fontSize: 200, lineHeight: 1.8, theme: "system", revision: 0 },
    { fontSize: 18, lineHeight: 0, theme: "system", revision: 0 },
    { fontSize: 18, lineHeight: 1.8, theme: "url(evil)", revision: 0 },
  ])
    assert.throws(() => validateStudyPreferences(bad), {
      code: "VALIDATION_ERROR",
    });
});
test("conflicting device edits do not overwrite the stored note", async () => {
  let record = { body: "remote", revision: 2 };
  const store = {
    read: async () => record,
    create: async (value) => {
      record = value;
      return record;
    },
    update: async (revision, value) => {
      if (record.revision !== revision) return false;
      record = { ...value, revision: revision + 1 };
      return true;
    },
  };
  await assert.rejects(
    () => saveStudyRevision(store, { body: "local" }, 1),
    (error) => error.code === "CONFLICT" && error.current.body === "remote",
  );
  assert.equal(record.body, "remote");
  const saved = await saveStudyRevision(store, { body: "merged" }, 2);
  assert.equal(saved.body, "merged");
  assert.equal(saved.revision, 3);
});
test("simultaneous first saves expose the winner as conflict instead of hiding it", async () => {
  const winner = { body: "other tab", revision: 1 };
  const store = {
    read: async () => winner,
    create: async () => {
      throw Object.assign(new Error("unique"), { code: "P2002" });
    },
    update: async () => false,
  };
  await assert.rejects(
    () => saveStudyRevision(store, { body: "mine" }, 0),
    (error) => error.code === "CONFLICT" && error.current === winner,
  );
});
