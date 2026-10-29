import test from "node:test";
import assert from "node:assert/strict";
import {
  searchDocuments,
  accessibleSearchBody,
} from "../src/lib/search-index.ts";
import { headingAnchor } from "../src/lib/heading-anchors.ts";
import { renderMarkdown } from "../src/lib/markdown.ts";

const doc = (extra = {}) => ({
  slug: "thermodynamics/intro",
  title: "Foundations",
  subjectSlug: "thermodynamics",
  subjectTitle: "Thermodynamics",
  locale: "en",
  body: "## Enthalpy\n\nEnthalpy is a state function.\n\n## Entropy\n\nEntropy measures dispersal.",
  ...extra,
});
test("full-text search finds Chinese and English body terms and links to a real rendered heading", async () => {
  const source = doc();
  const result = searchDocuments(
    [
      source,
      doc({
        locale: "zh",
        title: "基础概念",
        body: "## 焓与状态函数\n\n焓是状态函数。",
      }),
    ],
    "enthalpy",
    "zh",
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].locale, "en");
  assert.match(result[0].snippet, /Enthalpy/);
  assert.match(result[0].href, /#section-enthalpy$/);
  assert.match(await renderMarkdown(source.body), /id="section-enthalpy"/);
  assert.equal(
    searchDocuments(
      [source, doc({ locale: "zh", body: "## 焓\n\n焓是状态函数。" })],
      "状态函数",
      "en",
    )[0].locale,
    "zh",
  );
});
test("search consumes only readable bodies and never indexes a gated tail or denied content", () => {
  const source =
    "Visible introduction.\n\nA secret subscription-only phrase.\n\nMore private explanations.";
  assert.equal(accessibleSearchBody(source, "denied", 1), null);
  const preview = accessibleSearchBody(source, "preview", 0.2);
  assert.match(preview, /Visible introduction/);
  assert.doesNotMatch(preview, /secret/);
  assert.deepEqual(
    searchDocuments([doc({ body: preview })], "secret", "en"),
    [],
  );
  assert.equal(accessibleSearchBody(source, "full", 0.2), source);
});
test("duplicate headings have stable distinct ids; hostile text never becomes HTML or DOM globals", async () => {
  const ids = new Map();
  assert.equal(headingAnchor("中文与 Energy", ids), "section-中文与-energy");
  assert.equal(headingAnchor("中文与 Energy", ids), "section-中文与-energy-2");
  const html = await renderMarkdown(
    "## location\n\n## location\n\n<script>hidden danger</script>\n\n## [Safe](javascript:alert(1))",
  );
  assert.match(html, /id="section-location"/);
  assert.match(html, /id="section-location-2"/);
  assert.doesNotMatch(html, /<script|href="javascript:/);
  assert.deepEqual(
    searchDocuments(
      [doc({ body: "<script>hidden danger</script>\n\nPublic text." })],
      "hidden danger",
      "en",
    ),
    [],
  );
});
test("search deduplicates language fallbacks, ranks exact titles, treats query characters literally and filters subject", () => {
  const docs = [
    doc(),
    doc(),
    doc({
      slug: "thermodynamics/enthalpy",
      title: "Enthalpy",
      body: "A short definition.",
    }),
    doc({
      slug: "kinetics/rate",
      subjectSlug: "kinetics",
      body: "A 100% yield and a_b literal.",
    }),
  ];
  const hits = searchDocuments(docs, "enthalpy", "en");
  assert.equal(hits.length, 2);
  assert.equal(hits[0].title, "Enthalpy");
  assert.equal(searchDocuments(docs, "a_b", "en").length, 1);
  assert.equal(searchDocuments(docs, "100%", "en").length, 1);
  assert.equal(searchDocuments(docs, "a_b", "en", "thermodynamics").length, 0);
  assert.deepEqual(searchDocuments(docs, "   ", "en"), []);
});
