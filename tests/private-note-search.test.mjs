import test from "node:test";
import assert from "node:assert/strict";
import { privateNoteFilter } from "../src/lib/private-note-search.ts";

test("private search always retains the account boundary and excludes empty notes", () => {
  assert.deepEqual(privateNoteFilter("alice", null), {
    userId: "alice",
    body: { not: "" },
  });
  assert.deepEqual(privateNoteFilter("bob", "   "), {
    userId: "bob",
    body: { not: "" },
  });
});

test("private note searches treat SQL patterns literally and accept bilingual text", () => {
  const query = privateNoteFilter("alice", "  熵 Heat 50%_\\ ΔG  ");
  assert.equal(query.userId, "alice");
  assert.equal(query.body.contains, "熵 Heat 50\\%\\_\\\\ ΔG");
  assert.equal(query.body.mode, "insensitive");
  assert.equal(query.body.not, "");
});

test("oversize or control-character search requests fail before querying private data", () => {
  for (const query of ["a".repeat(201), "line\u0000break", "line\nbreak"])
    assert.throws(
      () => privateNoteFilter("alice", query),
      (error) => error.code === "VALIDATION_ERROR" && error.status === 400,
    );
  assert.equal(
    privateNoteFilter("alice", "a".repeat(200)).body.contains.length,
    200,
  );
});
