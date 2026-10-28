import test from "node:test";
import assert from "node:assert/strict";
import {
  suggestSlug,
  noteHref,
  readTranslationDrafts,
  validateDraft,
  insertText,
  imageMarkdown,
  adminErrorMessage,
  readApiObject,
  canonicalTranslation,
} from "../src/lib/editor.ts";

test("slug suggestions follow later title changes without changing legacy slash paths", () => {
  assert.equal(
    suggestSlug("First Law of Thermodynamics"),
    "first-law-of-thermodynamics",
  );
  assert.equal(
    suggestSlug("Café / Molecular Spectra"),
    "cafe/molecular-spectra",
  );
  assert.equal(noteHref("thermodynamics/intro"), "/notes/thermodynamics/intro");
});

test("legacy content starts in its original language without inventing a translation", () => {
  assert.deepEqual(readTranslationDrafts("Energy", "# First law", null), {
    zh: { title: "", body: "" },
    en: { title: "Energy", body: "# First law" },
  });
  assert.deepEqual(readTranslationDrafts("热力学", "# Energy", null), {
    zh: { title: "热力学", body: "# Energy" },
    en: { title: "", body: "" },
  });
});

test("stored translation pairs preserve an intentionally empty translation", () => {
  assert.deepEqual(
    readTranslationDrafts("Legacy", "Legacy body", {
      zh: { title: "", body: "" },
      en: { title: "Energy", body: "English" },
    }),
    {
      zh: { title: "", body: "" },
      en: { title: "Energy", body: "English" },
    },
  );
});

test("publishing requires a complete translation and valid placement", () => {
  const draft = {
    translations: {
      zh: { title: "", body: "" },
      en: { title: "Energy", body: "Notes" },
    },
    slug: "thermo/energy",
    subjectSlug: "physical-chemistry",
    chapterSlug: "thermodynamics",
    order: "0",
    isPublished: true,
  };
  assert.equal(validateDraft(draft), null);
  assert.deepEqual(
    validateDraft({
      ...draft,
      translations: { ...draft.translations, zh: { title: "能量", body: "" } },
    }),
    { code: "INCOMPLETE_TRANSLATION", locale: "zh" },
  );
  assert.deepEqual(validateDraft({ ...draft, slug: "../energy" }), {
    code: "INVALID_SLUG",
  });
  assert.deepEqual(validateDraft({ ...draft, order: "1.5" }), {
    code: "INVALID_ORDER",
  });
});

test("upload insertion uses the latest body and clamps an outdated selection", () => {
  assert.deepEqual(
    insertText("New edits remain", "\n![figure](/image.png)\n", 999, 999),
    {
      body: "New edits remain\n![figure](/image.png)\n",
      cursor: 39,
    },
  );
  assert.deepEqual(insertText("First OLD last", "**new**", 6, 9), {
    body: "First **new** last",
    cursor: 13,
  });
});

test("image markdown cannot break out of alt text or its URL destination", () => {
  assert.equal(
    imageMarkdown("Figure [1].png", "/uploads/figure (1).png"),
    "\n![Figure \\[1\\].png](/uploads/figure%20%281%29.png)\n",
  );
});

test("service and permission failures explain the actual condition in either locale", () => {
  assert.match(adminErrorMessage("UNAVAILABLE", 503, "en"), /unavailable/i);
  assert.match(adminErrorMessage("FORBIDDEN", 403, "zh"), /管理员/);
  assert.match(adminErrorMessage("CONFLICT", 409, "en"), /slug/i);
});

test("unfinished translations can be saved privately as a draft", () => {
  assert.equal(
    validateDraft({
      translations: {
        zh: { title: "能量", body: "" },
        en: { title: "", body: "" },
      },
      slug: "energy",
      subjectSlug: "",
      chapterSlug: "",
      order: "0",
      isPublished: false,
    }),
    null,
  );
});

test("reading order follows the API maximum", () => {
  assert.deepEqual(
    validateDraft({
      translations: {
        zh: { title: "", body: "" },
        en: { title: "Energy", body: "Notes" },
      },
      slug: "energy",
      subjectSlug: "notes",
      chapterSlug: "energy",
      order: "100001",
      isPublished: false,
    }),
    { code: "INVALID_ORDER" },
  );
});

test("translation subject metadata survives an article edit", () => {
  assert.deepEqual(
    readTranslationDrafts("Energy", "Notes", {
      en: {
        title: "Energy",
        body: "Notes",
        subjectTitle: "Physical chemistry",
      },
    }).en,
    { title: "Energy", body: "Notes", subjectTitle: "Physical chemistry" },
  );
});

test("malformed API bodies do not hide their HTTP status", async () => {
  assert.deepEqual(
    await readApiObject(
      new Response("<html>Unavailable</html>", { status: 503 }),
    ),
    {},
  );
  assert.deepEqual(
    await readApiObject(Response.json(null, { status: 403 })),
    {},
  );
  assert.deepEqual(await readApiObject(Response.json(["invalid"])), {});
  assert.deepEqual(
    await readApiObject(Response.json({ code: "FORBIDDEN" }, { status: 403 })),
    { code: "FORBIDDEN" },
  );
});

test("canonical fallback keeps title and body from the same completed language", () => {
  assert.deepEqual(
    canonicalTranslation({
      zh: { title: "能量", body: "" },
      en: { title: "Energy", body: "Notes" },
    }),
    { title: "Energy", body: "Notes" },
  );
});

test("an invalid successful API payload is reported as a service problem", () => {
  assert.match(adminErrorMessage(undefined, 200, "en"), /unavailable/i);
});

test("bundled content deletion explains how to unpublish instead", () => {
  assert.match(
    adminErrorMessage("BUNDLED_CONTENT", 409, "en"),
    /uncheck.*publish.*save/i,
  );
  assert.match(
    adminErrorMessage("BUNDLED_CONTENT", 409, "zh"),
    /取消.*发布文章.*保存/,
  );
});

test("bundled slug conflicts explain how to preserve the original and create a separate note", () => {
  assert.match(
    adminErrorMessage("BUNDLED_SLUG", 409, "en"),
    /keep.*original.*slug.*separate note/i,
  );
  assert.match(
    adminErrorMessage("BUNDLED_SLUG", 409, "zh"),
    /保留.*链接标识.*新建.*文章/,
  );
});
