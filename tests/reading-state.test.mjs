import test from "node:test";
import assert from "node:assert/strict";
import { contentLookupOutcome } from "../src/lib/reading-state.ts";

test("a missing bundled lesson is a missing page, not an outage", () => {
  assert.equal(contentLookupOutcome(false, false, true), "not-found");
});

test("authoritative lookup failures are not mistaken for missing content", () => {
  assert.equal(contentLookupOutcome(false, false, false), "unavailable");
  assert.equal(contentLookupOutcome(false, true, false), "not-found");
  assert.equal(contentLookupOutcome(true, false, true), "found");
});
