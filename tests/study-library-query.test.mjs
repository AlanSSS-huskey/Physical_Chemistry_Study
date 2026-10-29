import test from "node:test";
import assert from "node:assert/strict";
import { privateLibraryQuery } from "../src/components/study/library-query.ts";
test("private note queries are bounded and included only in the private notes API request", () => {
  const notes = privateLibraryQuery("notes", 2, "zh", "  熵与焓  ");
  assert.equal(notes.pathname, "/api/study/library");
  assert.equal(notes.searchParams.get("q"), "熵与焓");
  assert.equal(notes.searchParams.get("page"), "2");
  assert.equal(
    privateLibraryQuery("notes", 1, "en", "x".repeat(250)).searchParams.get("q")
      .length,
    200,
  );
  assert.equal(
    privateLibraryQuery(
      "bookmarks",
      1,
      "zh",
      "private phrase",
    ).searchParams.has("q"),
    false,
  );
  assert.equal(
    privateLibraryQuery("recent", 1, "zh", "private phrase").searchParams.has(
      "q",
    ),
    false,
  );
});
