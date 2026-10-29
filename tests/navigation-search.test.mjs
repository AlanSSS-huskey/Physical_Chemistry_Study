import test from "node:test";
import assert from "node:assert/strict";
import {
  navigationSearch,
  searchShortcut,
  focusLoopTarget,
} from "../src/lib/navigation-search.ts";

const hit = {
  slug: "thermo/intro",
  title: "能量",
  subjectTitle: "物理化学",
  locale: "zh",
  href: "/notes/thermo/intro#%E8%83%BD%E9%87%8F",
  anchor: "能量",
  snippet: "守恒与状态函数",
};
test("quick search requests only the authorized search API and preserves Unicode locale links", async () => {
  const calls = [];
  const result = await navigationSearch(" 能量 & heat ", "zh", {
    fetcher: async (path, options) => {
      calls.push({ path, options });
      return Response.json({
        ok: true,
        data: { hits: [hit], databaseAvailable: true },
      });
    },
  });
  assert.equal(
    calls[0].path,
    "/api/search?q=%E8%83%BD%E9%87%8F+%26+heat&locale=zh",
  );
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.deepEqual(result.hits[0], hit);
  assert.equal(result.partial, false);
});
test("malformed successful results and external result URLs fail without showing false empty success", async () => {
  for (const body of [
    { ok: true, data: null },
    {
      ok: true,
      data: {
        hits: [{ ...hit, href: "https://external.example" }],
        databaseAvailable: true,
      },
    },
  ]) {
    await assert.rejects(
      navigationSearch("heat", "en", {
        fetcher: async () => Response.json(body),
      }),
      /UNAVAILABLE/,
    );
  }
});
test("partial responses are explicit and aborted searches keep their cancellation", async () => {
  const partial = await navigationSearch("heat", "en", {
    fetcher: async () =>
      Response.json({ ok: true, data: { hits: [], databaseAvailable: false } }),
  });
  assert.equal(partial.partial, true);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    navigationSearch("heat", "en", {
      signal: controller.signal,
      fetcher: async (_path, options) => {
        assert.equal(options.signal, controller.signal);
        throw new DOMException("Aborted", "AbortError");
      },
    }),
    (error) => error.name === "AbortError",
  );
});
test("only the explicit command/control K shortcut opens search, including from editable fields", () => {
  assert.equal(searchShortcut({ key: "K", metaKey: true }), true);
  assert.equal(searchShortcut({ key: "k", ctrlKey: true }), true);
  for (const event of [
    { key: "k" },
    { key: "f", ctrlKey: true },
    { key: "k", ctrlKey: true, altKey: true },
    { key: "k", ctrlKey: true, isComposing: true },
    { key: "k", ctrlKey: true, defaultPrevented: true },
  ])
    assert.equal(searchShortcut(event), false);
});
test("dialog focus wraps only at the boundaries and cannot escape through Shift Tab", () => {
  assert.equal(focusLoopTarget(0, 4, true), 3);
  assert.equal(focusLoopTarget(3, 4, false), 0);
  assert.equal(focusLoopTarget(1, 4, false), null);
  assert.equal(focusLoopTarget(-1, 4, false), 0);
  assert.equal(focusLoopTarget(0, 0, true), null);
});
