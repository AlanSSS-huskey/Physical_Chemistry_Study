import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBackupImport,
  summarizeBackupPreview,
  previewNeedsRefresh,
} from "../src/components/account/backup-import-client.ts";

const backup = (changes = {}) => ({
  format: "physical-chemistry-account",
  version: 1,
  profile: { id: "old-account", email: "private@example.invalid" },
  notes: [
    {
      contentSlug: "thermodynamics/intro",
      locale: "zh",
      body: "<script>只是私人原文</script>",
    },
  ],
  bookmarks: [{ contentSlug: "thermodynamics/intro" }],
  ...changes,
});
test("backup input preserves literal private text and other export sections without interpreting them", () => {
  const value = backup({ preferences: { fontSize: 20 } });
  assert.deepEqual(parseBackupImport(JSON.stringify(value)), value);
});
test("invalid formats and oversized private payloads are rejected before an upload request", () => {
  for (const raw of [
    "broken",
    "[]",
    JSON.stringify(backup({ version: 2 })),
    JSON.stringify(
      backup({
        notes: Array.from({ length: 101 }, () => ({
          contentSlug: "ok",
          locale: "en",
          body: "text",
        })),
      }),
    ),
    JSON.stringify(
      backup({
        notes: [{ contentSlug: "ok", locale: "en", body: "x".repeat(5001) }],
      }),
    ),
    JSON.stringify(
      backup({
        bookmarks: Array.from({ length: 501 }, () => ({ contentSlug: "ok" })),
      }),
    ),
  ])
    assert.throws(
      () => parseBackupImport(raw),
      (error) => error.code === "BACKUP_INVALID",
    );
  assert.throws(
    () => parseBackupImport(" ".repeat(1048577)),
    (error) => error.code === "BACKUP_TOO_LARGE",
  );
  assert.throws(
    () =>
      parseBackupImport(
        JSON.stringify(backup({ padding: "汉".repeat(400000) })),
      ),
    (error) => error.code === "BACKUP_TOO_LARGE",
  );
});
test("preview totals distinguish new, identical and conflicting text without exposing source profile fields", () => {
  const summary = summarizeBackupPreview({
    notes: [
      { status: "new" },
      { status: "identical" },
      { status: "conflict" },
      { status: "conflict" },
    ],
    bookmarks: { newCount: 2, existingCount: 4 },
    sourceAccountDifferent: true,
  });
  assert.deepEqual(summary, {
    notesNew: 1,
    notesIdentical: 1,
    notesConflicting: 2,
    bookmarksNew: 2,
    bookmarksExisting: 4,
  });
  assert.equal(
    JSON.stringify(summary).includes("private@example.invalid"),
    false,
  );
});
test("stale or expired previews require a new preview while rate limits can retry the existing operation", () => {
  for (const code of ["PREVIEW_STALE", "PREVIEW_EXPIRED", "PREVIEW_INVALID"])
    assert.equal(previewNeedsRefresh(code), true);
  assert.equal(previewNeedsRefresh("RATE_LIMITED"), false);
  assert.equal(previewNeedsRefresh("UNAVAILABLE"), false);
});
