import test from "node:test";
import assert from "node:assert/strict";
import { searchStudyLibrary } from "../src/lib/search-service.ts";
import { renderMarkdown } from "../src/lib/markdown.ts";

const doc = (overrides = {}) => ({
  id: "one",
  slug: "thermodynamics/intro",
  title: "Intro",
  body: "# Visible\n\nPublic first paragraph\n\n## Secret\n\nUNIQUE_SECRET_TAIL",
  subjectSlug: "thermodynamics",
  subjectTitle: "Thermodynamics",
  chapterSlug: "intro",
  order: 0,
  locale: "en",
  sourceLocale: "en",
  translationAvailable: true,
  isPublic: true,
  isPublished: true,
  moduleKey: "thermo",
  previewRatio: 0.25,
  updatedAt: null,
  source: "database",
  ...overrides,
});
function dependencies(items, access) {
  return { load: async () => ({ items, databaseAvailable: true }), access };
}

test("preview search never indexes gated paragraphs or their headings", async () => {
  const options = dependencies([doc()], async () => "preview");
  assert.equal(
    (await searchStudyLibrary("UNIQUE_SECRET_TAIL", "en", "alice", "", options))
      .hits.length,
    0,
  );
  assert.equal(
    (await searchStudyLibrary("Secret", "en", "alice", "", options)).hits
      .length,
    0,
  );
  assert.equal(
    (await searchStudyLibrary("Visible", "en", "alice", "", options)).hits
      .length,
    1,
  );
});
test("denied chapter title is excluded as well as its body", async () => {
  const result = await searchStudyLibrary(
    "SensitiveTitle",
    "en",
    "alice",
    "",
    dependencies([doc({ title: "SensitiveTitle" })], async () => "denied"),
  );
  assert.deepEqual(result.hits, []);
});
test("unpublished sources are filtered before any authorization or parsing", async () => {
  let checked = false;
  const result = await searchStudyLibrary(
    "draft",
    "en",
    "alice",
    "",
    dependencies([doc({ title: "draft", isPublished: false })], async () => {
      checked = true;
      return "full";
    }),
  );
  assert.equal(checked, false);
  assert.deepEqual(result.hits, []);
});
test("authorization outage fails closed rather than returning snippets from other sources", async () => {
  await assert.rejects(
    () =>
      searchStudyLibrary(
        "secret",
        "en",
        "alice",
        "",
        dependencies([doc()], async () => {
          throw new Error("permission outage");
        }),
      ),
    /permission outage/,
  );
});
test("search result section links point at the actual rendered heading even when heading contains an image", async () => {
  const content = doc({
    body: "## Diagram ![enthalpy](https://example.org/a.png)\n\nunique needle",
  });
  const result = await searchStudyLibrary(
    "needle",
    "en",
    undefined,
    "",
    dependencies([content], async () => "full"),
  );
  const html = await renderMarkdown(content.body);
  assert.match(html, new RegExp(`id="${result.hits[0].anchor}"`));
});
test("search result section links retain duplicate-heading suffixes used by the renderer", async () => {
  const content = doc({
    body: "## Definition\n\nfirst\n\n## Definition\n\nunique needle",
  });
  const result = await searchStudyLibrary(
    "needle",
    "en",
    undefined,
    "",
    dependencies([content], async () => "full"),
  );
  const html = await renderMarkdown(content.body);
  assert.equal(result.hits[0].anchor, "section-definition-2");
  assert.match(html, /id="section-definition-2"/);
});
test("generated footnote reference numbers do not change search heading targets", async () => {
  const content = doc({
    body: "## Diagram[^a]\n\nunique needle\n\n[^a]: A note",
  });
  const result = await searchStudyLibrary(
    "needle",
    "en",
    undefined,
    "",
    dependencies([content], async () => "full"),
  );
  assert.match(
    await renderMarkdown(content.body),
    new RegExp(`id="${result.hits[0].anchor}"`),
  );
});
