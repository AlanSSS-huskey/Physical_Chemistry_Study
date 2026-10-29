import test from "node:test";
import assert from "node:assert/strict";
import { searchResultNeedsReload } from "../src/lib/search-result-navigation.ts";

test("another language of the current chapter must reload even when only the anchor changes", () => {
  assert.equal(
    searchResultNeedsReload(
      "/notes/thermo/intro#section-energy",
      "https://study.example/notes/thermo/intro#section-intro",
      "zh",
      "en",
    ),
    true,
  );
  assert.equal(
    searchResultNeedsReload(
      "/notes/thermo/intro",
      "https://study.example/notes/thermo/intro",
      "en",
      "zh",
    ),
    true,
  );
});
test("same-language anchors and other documents keep normal link navigation", () => {
  assert.equal(
    searchResultNeedsReload(
      "/notes/thermo/intro#section-energy",
      "https://study.example/notes/thermo/intro",
      "en",
      "en",
    ),
    false,
  );
  assert.equal(
    searchResultNeedsReload(
      "/notes/thermo/next",
      "https://study.example/notes/thermo/intro",
      "zh",
      "en",
    ),
    false,
  );
  assert.equal(
    searchResultNeedsReload(
      "/notes/thermo/intro?view=other",
      "https://study.example/notes/thermo/intro",
      "zh",
      "en",
    ),
    false,
  );
});
