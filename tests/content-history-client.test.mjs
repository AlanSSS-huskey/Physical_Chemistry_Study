import test from "node:test";
import assert from "node:assert/strict";
import {
  adminMutation,
  HistoryRequestError,
  restoreEditorFields,
} from "../src/lib/content-history-client.ts";

test("admin writes fetch signed CSRF and retain structured conflicts instead of a false saved state", async () => {
  const calls = [];
  const fetcher = async (path, options) => {
    calls.push({ path, options });
    return path.endsWith("/csrf")
      ? Response.json({ csrfToken: "signed" })
      : Response.json({ code: "VERSION_CONFLICT" }, { status: 409 });
  };
  await assert.rejects(
    adminMutation(
      "/api/admin/content/a",
      "PUT",
      { expectedVersion: 1 },
      fetcher,
    ),
    (error) =>
      error instanceof HistoryRequestError && error.code === "VERSION_CONFLICT",
  );
  assert.equal(calls[1].options.headers.get("X-CSRF-Token"), "signed");
  assert.equal(calls[1].options.credentials, "same-origin");
  assert.equal(JSON.parse(calls[1].options.body).expectedVersion, 1);
});

test("recovering an unfinished draft retains all writing without accepting injected properties", () => {
  const recovered = restoreEditorFields({
    slug: "energy",
    order: "2",
    role: "ADMIN",
    translations: {
      zh: { title: "能量", body: "" },
      en: { title: "", body: "" },
    },
    isPublic: true,
    isPublished: false,
  });
  assert.equal(recovered.translations.zh.title, "能量");
  assert.equal(recovered.translations.zh.body, "");
  assert.equal(recovered.order, "2");
  assert.equal("role" in recovered, false);
  assert.equal(restoreEditorFields(null), null);
});
