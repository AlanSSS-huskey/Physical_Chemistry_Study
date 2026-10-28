import test from "node:test";
import assert from "node:assert/strict";
import {
  parseLocale,
  textFor,
  formatDate,
  contentHref,
} from "../src/lib/i18n.ts";

test("locale accepts supported language codes and rejects untrusted values", () => {
  assert.equal(parseLocale("en"), "en");
  assert.equal(parseLocale("zh"), "zh");
  assert.equal(parseLocale("<script>"), "zh");
  assert.equal(parseLocale(undefined), "zh");
});

test("interface text switches languages without changing identifiers", () => {
  assert.equal(textFor("zh", "学习", "Study"), "学习");
  assert.equal(textFor("en", "学习", "Study"), "Study");
  assert.equal(
    contentHref("thermodynamics/first-law"),
    "/notes/thermodynamics/first-law",
  );
  assert.equal(
    contentHref("中文笔记"),
    "/notes/%E4%B8%AD%E6%96%87%E7%AC%94%E8%AE%B0",
  );
});

test("missing and invalid dates never render an invalid date", () => {
  assert.equal(formatDate(null, "en"), "—");
  assert.equal(formatDate("bad-date", "zh"), "—");
  assert.match(formatDate("2026-03-07T12:00:00Z", "en"), /2026/);
});
