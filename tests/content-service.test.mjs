import test from "node:test";
import assert from "node:assert/strict";
import {
  localizeDatabaseContent,
  mergeLibrarySources,
  loadLibrary,
  loadContent,
} from "../src/lib/content-service.ts";
const row = (extra = {}) => ({
  id: "db1",
  slug: "thermodynamics/intro",
  title: "旧标题",
  body: "旧正文",
  subjectSlug: "thermodynamics",
  chapterSlug: "intro",
  order: 2,
  isPublic: true,
  isPublished: true,
  previewRatio: 0.2,
  module: null,
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...extra,
});
const sample = (localize) => ({
  id: "file:thermodynamics/intro",
  slug: "thermodynamics/intro",
  title: "Bundled",
  body: "Sample",
  subjectSlug: "thermodynamics",
  subjectTitle: "Thermodynamics",
  chapterSlug: "intro",
  order: 1,
  locale: localize,
  sourceLocale: "en",
  translationAvailable: localize === "en",
  isPublic: true,
  isPublished: true,
  moduleKey: null,
  previewRatio: 1,
  updatedAt: null,
  source: "file",
});
test("database translations select requested language without inventing availability", () => {
  const content = localizeDatabaseContent(
    row({
      translations: {
        zh: { title: "热", body: "中文" },
        en: { title: "Heat", body: "English", subjectTitle: "Thermodynamics" },
      },
    }),
    "en",
  );
  assert.equal(content.title, "Heat");
  assert.equal(content.body, "English");
  assert.equal(content.translationAvailable, true);
  assert.equal(content.sourceLocale, "en");
});
test("missing translation honestly falls back to available source locale", () => {
  const content = localizeDatabaseContent(
    row({ translations: { zh: { title: "热", body: "中文" } } }),
    "en",
  );
  assert.equal(content.body, "中文");
  assert.equal(content.sourceLocale, "zh");
  assert.equal(content.translationAvailable, false);
});
test("legacy language detection uses body as well as title", () => {
  const content = localizeDatabaseContent(row({ title: "First Law" }), "en");
  assert.equal(content.sourceLocale, "zh");
  assert.equal(content.translationAvailable, false);
});
test("draft and private database records shadow same-slug bundled lessons", () => {
  for (const record of [row({ isPublic: false }), row({ isPublished: false })])
    assert.deepEqual(mergeLibrarySources([record], [sample("en")], "en"), []);
});
test("trashed database records hide their bundled identity even if published flags remain", () => {
  const trashed = row({ deletedAt: new Date(), isPublished: true });
  assert.equal(localizeDatabaseContent(trashed, "en").isPublished, false);
  assert.deepEqual(mergeLibrarySources([trashed], [sample("en")], "en"), []);
});
test("database versions override bundled copies while unrelated files remain", () => {
  const items = mergeLibrarySources(
    [row({ title: "Updated", body: "English" })],
    [
      sample("en"),
      { ...sample("en"), id: "file:other", slug: "thermodynamics/other" },
    ],
    "en",
  );
  assert.equal(items.length, 2);
  assert.equal(
    items.find((x) => x.slug === "thermodynamics/intro").title,
    "Updated",
  );
});
test("database absence serves real bundled lessons with unavailable state", async () => {
  const old = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const result = await loadLibrary("zh");
    assert.equal(result.databaseAvailable, false);
    assert.ok(result.items.length > 0);
    assert.ok(result.items.every((x) => x.source === "file"));
    const item = result.items[0];
    const found = await loadContent(item.slug, "zh");
    assert.equal(found.content.slug, item.slug);
    assert.equal(found.databaseAvailable, false);
    const invalid = await loadContent("../outside", "zh");
    assert.equal(invalid.content, null);
  } finally {
    if (old === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = old;
  }
});

test("legacy module categories do not become entitlement gates", () => {
  assert.equal(
    localizeDatabaseContent(row({ module: "thermodynamics" }), "zh").moduleKey,
    null,
  );
  assert.equal(
    localizeDatabaseContent(
      row({ module: "thermodynamics", moduleRel: { key: "thermo-pack" } }),
      "zh",
    ).moduleKey,
    "thermo-pack",
  );
});

test("configured authoritative database failures never expose bundled copies", async () => {
  const previousUrl = process.env.DATABASE_URL;
  const previousMode = process.env.CHEMISTRY_CONTENT_MODE;
  process.env.DATABASE_URL = "postgresql://unavailable.invalid/chemistry";
  delete process.env.CHEMISTRY_CONTENT_MODE;
  try {
    const library = await loadLibrary("zh");
    assert.equal(library.databaseAvailable, false);
    assert.deepEqual(library.items, []);
    const lesson = await loadContent("thermodynamics/intro", "zh");
    assert.equal(lesson.databaseAvailable, false);
    assert.equal(lesson.content, null);
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousMode === undefined) delete process.env.CHEMISTRY_CONTENT_MODE;
    else process.env.CHEMISTRY_CONTENT_MODE = previousMode;
  }
});

test("explicit bundled preview ignores configured database and reports unavailable persistence", async () => {
  const previousUrl = process.env.DATABASE_URL;
  const previousMode = process.env.CHEMISTRY_CONTENT_MODE;
  process.env.DATABASE_URL = "postgresql://unavailable.invalid/chemistry";
  process.env.CHEMISTRY_CONTENT_MODE = "bundled";
  try {
    const library = await loadLibrary("en");
    assert.equal(library.databaseAvailable, false);
    assert.ok(library.items.length > 0);
    assert.ok(library.items.every((item) => item.source === "file"));
    const lesson = await loadContent("thermodynamics/intro", "en");
    assert.equal(lesson.databaseAvailable, false);
    assert.equal(lesson.content.source, "file");
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousMode === undefined) delete process.env.CHEMISTRY_CONTENT_MODE;
    else process.env.CHEMISTRY_CONTENT_MODE = previousMode;
  }
});

test("bundled lesson identities can be protected from deletion without reading the database", async () => {
  const { isBundledContent } = await import("../src/lib/content-service.ts");
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://unavailable.invalid/chemistry";
  try {
    assert.equal(await isBundledContent("thermodynamics/intro"), true);
    assert.equal(await isBundledContent("thermodynamics/first-law"), true);
    assert.equal(await isBundledContent("thermodynamics/not-bundled"), false);
    assert.equal(await isBundledContent("../outside"), false);
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});
