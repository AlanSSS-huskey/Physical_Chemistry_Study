import test from "node:test";
import assert from "node:assert/strict";
import {
  validateContentInput,
  ContentValidationError,
  noteSlugFromSegments,
} from "../src/lib/content-validation.ts";

const valid = { title: "热力学", body: "正文", slug: "thermodynamics/intro" };
test("note routes accept legacy encoded separators and reject malformed paths", () => {
  assert.equal(noteSlugFromSegments(["thermodynamics", "intro"]), valid.slug);
  assert.equal(noteSlugFromSegments(["thermodynamics%2Fintro"]), valid.slug);
  for (const segments of [
    ["%"],
    ["%2e%2e", "intro"],
    ["x%2f%2fintro"],
    ["%2fintro"],
    ["x%5cintro"],
  ]) {
    assert.equal(noteSlugFromSegments(segments), null);
  }
});
test("content validation rejects nonobject JSON and wrong types", () => {
  for (const value of [
    null,
    [],
    "text",
    { ...valid, isPublic: "false" },
    { ...valid, order: 1.5 },
  ]) {
    assert.throws(() => validateContentInput(value), ContentValidationError);
  }
});
test("canonical slash slugs are accepted but traversal and invalid segments are rejected", () => {
  assert.equal(validateContentInput(valid).slug, "thermodynamics/intro");
  for (const slug of [
    "../intro",
    "/intro",
    "thermo//intro",
    "x?y",
    "intro/",
    "a.b",
  ]) {
    assert.throws(
      () => validateContentInput({ ...valid, slug }),
      ContentValidationError,
    );
  }
});
test("new content receives explicit safe metadata defaults", () => {
  const result = validateContentInput(valid);
  assert.equal(result.subjectSlug, "thermodynamics");
  assert.equal(result.chapterSlug, "intro");
  assert.equal(result.isPublic, true);
  assert.equal(result.isPublished, true);
  assert.equal(result.order, 0);
});
test("updates preserve omitted legacy access flags and translations", () => {
  const existing = {
    ...valid,
    module: "thermo-pack",
    subjectSlug: "thermodynamics",
    chapterSlug: "intro",
    order: 4,
    isPublic: false,
    isPublished: false,
    previewRatio: 0.1,
    translations: { en: { title: "Heat", body: "English" } },
  };
  const result = validateContentInput({ title: "新标题" }, existing);
  assert.equal(result.isPublic, false);
  assert.equal(result.isPublished, false);
  assert.equal(result.module, "thermo-pack");
  assert.equal(result.order, 4);
  assert.deepEqual(result.translations, existing.translations);
});
test("translation updates preserve the other language", () => {
  const result = validateContentInput(
    { translations: { zh: { title: "热", body: "中文" } } },
    { ...valid, translations: { en: { title: "Heat", body: "English" } } },
  );
  assert.equal(result.translations.en.body, "English");
  assert.equal(result.translations.zh.body, "中文");
});
test("publishing requires a complete available language", () => {
  assert.throws(
    () =>
      validateContentInput({
        ...valid,
        title: "",
        body: "",
        translations: { en: { title: "Heat", body: "" } },
      }),
    ContentValidationError,
  );
  const draft = validateContentInput({
    ...valid,
    body: "",
    isPublished: false,
  });
  assert.equal(draft.isPublished, false);
  const translated = validateContentInput({
    ...valid,
    title: "",
    body: "",
    translations: { en: { title: "Heat", body: "Body" } },
  });
  assert.equal(translated.title, "Heat");
  assert.equal(translated.body, "Body");
});
test("content limits reject oversized bodies and nontext module categories", () => {
  assert.throws(
    () => validateContentInput({ ...valid, body: "a".repeat(300001) }),
    ContentValidationError,
  );
  assert.throws(
    () => validateContentInput({ ...valid, module: { name: "category" } }),
    ContentValidationError,
  );
});

test("mutation requests reject foreign origins and allow same-origin requests", async () => {
  const { isTrustedMutationRequest } =
    await import("../src/lib/content-validation.ts");
  assert.equal(
    isTrustedMutationRequest(
      new Request("https://study.example/api/admin/content", {
        headers: { origin: "https://study.example" },
      }),
    ),
    true,
  );
  assert.equal(
    isTrustedMutationRequest(
      new Request("https://study.example/api/admin/content", {
        headers: { origin: "https://evil.example" },
      }),
    ),
    false,
  );
  assert.equal(
    isTrustedMutationRequest(
      new Request("https://study.example/api/admin/content"),
    ),
    true,
  );
});
test("JSON request parsing bounds the body and rejects malformed input", async () => {
  const { parseContentJson, ContentValidationError } =
    await import("../src/lib/content-validation.ts");
  await assert.rejects(
    () =>
      parseContentJson(
        new Request("https://example.test", { method: "POST", body: "{" }),
      ),
    ContentValidationError,
  );
  await assert.rejects(
    () =>
      parseContentJson(
        new Request("https://example.test", {
          method: "POST",
          body: "a".repeat(101),
        }),
        100,
      ),
    ContentValidationError,
  );
  assert.deepEqual(
    await parseContentJson(
      new Request("https://example.test", {
        method: "POST",
        body: '{"title":"Heat"}',
      }),
    ),
    { title: "Heat" },
  );
});

test("API failures expose stable scrubbed error codes", async () => {
  const { contentApiFailure } =
    await import("../src/lib/content-validation.ts");
  const invalid = contentApiFailure(new ContentValidationError("Bad title"));
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, "VALIDATION_ERROR");
  const conflict = contentApiFailure({
    code: "P2002",
    message: "sensitive SQL",
  });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).code, "CONFLICT");
  const unavailable = contentApiFailure(new Error("postgres://password@host"));
  assert.equal(unavailable.status, 503);
  assert.ok(!(await unavailable.text()).includes("password"));
});

test("legacy free-text module categories are preserved", () => {
  assert.equal(
    validateContentInput({ ...valid, module: "Physical chemistry / 物理化学" })
      .module,
    "Physical chemistry / 物理化学",
  );
});

test("mutation origin checks use validated browser Host behind Next internal URLs", async () => {
  const { isTrustedMutationRequest } =
    await import("../src/lib/content-validation.ts");
  assert.equal(
    isTrustedMutationRequest(
      new Request("http://localhost:3001/api/admin/content", {
        headers: {
          origin: "http://127.0.0.1:3001",
          host: "127.0.0.1:3001",
          "x-forwarded-proto": "http",
        },
      }),
    ),
    true,
  );
  assert.equal(
    isTrustedMutationRequest(
      new Request("http://internal:3000/api/admin/content", {
        headers: {
          origin: "https://study.example",
          host: "study.example",
          "x-forwarded-proto": "https",
        },
      }),
    ),
    true,
  );
  assert.equal(
    isTrustedMutationRequest(
      new Request("http://internal:3000/api/admin/content", {
        headers: {
          origin: "https://foreign.example",
          host: "study.example",
          "x-forwarded-host": "foreign.example",
          "x-forwarded-proto": "https",
        },
      }),
    ),
    false,
  );
  for (const host of [
    "study.example/path",
    "user@study.example",
    "study.example,foreign.example",
  ]) {
    assert.equal(
      isTrustedMutationRequest(
        new Request("http://internal:3000/api/admin/content", {
          headers: {
            origin: "https://study.example",
            host,
            "x-forwarded-proto": "https",
          },
        }),
      ),
      false,
    );
  }
  assert.equal(
    isTrustedMutationRequest(
      new Request("http://internal:3000/api/admin/content", {
        headers: {
          origin: "https://study.example",
          host: "study.example",
          "x-forwarded-proto": "https,http",
        },
      }),
    ),
    false,
  );
});

test("an explicitly empty forwarded protocol is rejected as malformed", async () => {
  const { isTrustedMutationRequest } =
    await import("../src/lib/content-validation.ts");
  assert.equal(
    isTrustedMutationRequest(
      new Request("https://study.example/api/admin/content", {
        headers: {
          origin: "https://study.example",
          host: "study.example",
          "x-forwarded-proto": "",
        },
      }),
    ),
    false,
  );
});
