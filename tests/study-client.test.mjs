import test from "node:test";
import assert from "node:assert/strict";
import {
  studyRequest,
  StudyRequestError,
  sameStudyValue,
  readAnonymousPreferences,
  readingSnapshot,
} from "../src/lib/study-client.ts";

test("study client binds every read and CSRF-protected write to the rendered account", async () => {
  const calls = [];
  const fetcher = async (path, options) => {
    calls.push([path, options]);
    return Response.json(
      path.endsWith("/csrf")
        ? { csrfToken: "nonce" }
        : { ok: true, userId: "alice", data: { body: "saved", revision: 2 } },
    );
  };
  const result = await studyRequest("/api/study/note", "alice", {
    method: "PUT",
    body: { body: "private" },
    fetcher,
  });
  assert.equal(result.body, "saved");
  assert.equal(calls[1][1].headers.get("X-Study-User"), "alice");
  assert.equal(calls[1][1].headers.get("X-CSRF-Token"), "nonce");
  assert.equal(calls[1][1].credentials, "same-origin");
  assert.equal(calls[1][1].cache, "no-store");
});
test("a response from a switched account cannot populate the old account UI", async () => {
  await assert.rejects(
    () =>
      studyRequest("/api/study/note", "alice", {
        fetcher: async () =>
          Response.json({
            ok: true,
            userId: "bob",
            data: { body: "bobs private note" },
          }),
      }),
    (e) => e.code === "SESSION_CHANGED",
  );
});
test("conflict errors preserve remote text so the editor can offer an explicit merge", async () => {
  await assert.rejects(
    () =>
      studyRequest("/api/study/note", "alice", {
        fetcher: async () =>
          Response.json(
            {
              ok: false,
              code: "CONFLICT",
              current: { body: "remote", revision: 9 },
            },
            { status: 409 },
          ),
      }),
    (e) => e instanceof StudyRequestError && e.current.body === "remote",
  );
});
test("lost acknowledgment can be reconciled by equal values without overwriting a newer edit", () => {
  assert.equal(
    sameStudyValue(
      { body: "mine", revision: 2 },
      { body: "mine", revision: 3 },
    ),
    true,
  );
  assert.equal(
    sameStudyValue(
      { body: "mine", revision: 2 },
      { body: "newer", revision: 3 },
    ),
    false,
  );
});
test("anonymous reading preferences validate storage rather than accepting arbitrary styles", () => {
  assert.equal(
    readAnonymousPreferences(
      '{"fontSize":99,"lineHeight":1.8,"theme":"dark","revision":0}',
    ).fontSize,
    18,
  );
  assert.equal(
    readAnonymousPreferences(
      '{"fontSize":22,"lineHeight":2,"theme":"sepia","revision":0}',
    ).fontSize,
    22,
  );
  assert.equal(readAnonymousPreferences("broken").theme, "system");
});
test("scroll snapshot remains within visible chapter range and keeps a real nearest heading", () => {
  assert.deepEqual(
    readingSnapshot(500, 1600, 800, [
      { id: "first", top: 100 },
      { id: "second", top: 450 },
    ]),
    { progress: 0.625, anchor: "second" },
  );
  assert.deepEqual(readingSnapshot(-100, 100, 800, []), {
    progress: 0,
    anchor: null,
  });
  assert.equal(readingSnapshot(9000, 1600, 800, []).progress, 1);
});
