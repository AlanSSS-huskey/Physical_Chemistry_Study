import test from "node:test";
import assert from "node:assert/strict";
import {
  ContentHistoryError,
  createContentVersion,
  saveContentVersion,
  trashContentVersion,
  restoreContentVersion,
  savePrivateDraft,
  deletePrivateDraft,
  validatePrivateDraftPayload,
} from "../src/lib/content-history.ts";

const admin = { id: "admin-a", isAdmin: true };
const initial = {
  id: "lesson",
  title: "Original",
  slug: "thermodynamics/intro",
  body: "First law",
  module: null,
  subjectSlug: "thermodynamics",
  chapterSlug: "intro",
  order: 0,
  translations: null,
  isPublic: true,
  isPublished: true,
  previewRatio: 0.2,
  sourcePath: "bundled.mdx",
  version: 1,
  deletedAt: null,
};

function store() {
  let row = structuredClone(initial);
  const revisions = new Map();
  const drafts = new Map();
  const tx = {
    async $queryRaw(query) {
      const ids = query.values;
      return ids
        .filter((id) => id === "available-image")
        .map((id) => ({ id, storagePath: "u/available.png" }));
    },
    storageDeletion: {
      async findFirst() {
        return null;
      },
    },
    content: {
      async findUnique() {
        return structuredClone(row);
      },
      async findUniqueOrThrow() {
        return structuredClone(row);
      },
      async updateMany({ where, data }) {
        if (row.id !== where.id || row.version !== where.version)
          return { count: 0 };
        row = {
          ...row,
          ...data,
          translations:
            data.translations?.constructor?.name === "DbNull"
              ? null
              : data.translations,
        };
        return { count: 1 };
      },
    },
    contentRevision: {
      async upsert({ where, create }) {
        const key = where.contentId_version.version;
        if (!revisions.has(key)) revisions.set(key, structuredClone(create));
      },
      async create({ data }) {
        assert.equal(
          revisions.has(data.version),
          false,
          "history version must be immutable",
        );
        revisions.set(data.version, structuredClone(data));
      },
      async findUnique({ where }) {
        return structuredClone(
          revisions.get(where.contentId_version.version) ?? null,
        );
      },
    },
    contentDraft: {
      async findUnique({ where }) {
        return structuredClone(
          drafts.get(
            `${where.userId_draftKey.userId}:${where.userId_draftKey.draftKey}`,
          ) ?? null,
        );
      },
      async findUniqueOrThrow({ where }) {
        return structuredClone(
          drafts.get(
            `${where.userId_draftKey.userId}:${where.userId_draftKey.draftKey}`,
          ),
        );
      },
      async create({ data }) {
        const key = `${data.userId}:${data.draftKey}`;
        if (drafts.has(key))
          throw Object.assign(new Error(), { code: "P2002" });
        const draft = { ...data, id: key, updatedAt: new Date() };
        drafts.set(key, structuredClone(draft));
        return draft;
      },
      async updateMany({ where, data }) {
        const key = `${where.userId}:${where.draftKey}`;
        const draft = drafts.get(key);
        if (!draft || draft.revision !== where.revision) return { count: 0 };
        drafts.set(key, { ...draft, ...data, updatedAt: new Date() });
        return { count: 1 };
      },
      async deleteMany({ where }) {
        const key = `${where.userId}:${where.draftKey}`;
        const draft = drafts.get(key);
        if (!draft || draft.revision !== where.revision) return { count: 0 };
        drafts.delete(key);
        return { count: 1 };
      },
    },
  };
  return { tx, revisions, drafts, row: () => structuredClone(row) };
}

test("missing application image metadata prevents content saves and preserves the old version", async () => {
  const db = store();
  await assert.rejects(
    () =>
      saveContentVersion(
        db.tx,
        admin,
        "lesson",
        { body: "![removed](/api/images/missing-image)", expectedVersion: 1 },
        true,
      ),
    { code: "IMAGE_UNAVAILABLE" },
  );
  assert.equal(db.row().version, 1);
  assert.equal(db.revisions.size, 0);
});
test("application images referenced in translations are locked with parameterized ids before a write", async () => {
  const db = store();
  const observed = [];
  db.tx.$queryRaw = async (query) => {
    observed.push(query);
    return [{ id: "available-image", storagePath: "u/available.png" }];
  };
  await saveContentVersion(
    db.tx,
    admin,
    "lesson",
    {
      translations: {
        en: {
          title: "Image",
          body: "![available](/api/images/available-image?width=120)",
        },
      },
      expectedVersion: 1,
    },
    true,
  );
  assert.equal(observed.length, 1);
  assert.deepEqual(observed[0].values, ["available-image"]);
  assert.match(observed[0].strings.join("?"), /FOR KEY SHARE/i);
  assert.equal(db.row().version, 2);
});
test("queued images cannot be reused by creation, save or historical restoration", async () => {
  const db = store();
  db.tx.storageDeletion.findFirst = async () => ({ id: "queued" });
  await assert.rejects(
    () =>
      createContentVersion(db.tx, admin, {
        ...initial,
        translations: undefined,
        body: "![image](/api/images/available-image)",
      }),
    { code: "IMAGE_UNAVAILABLE" },
  );
  await assert.rejects(
    () =>
      saveContentVersion(
        db.tx,
        admin,
        "lesson",
        { body: "![image](/api/images/available-image)", expectedVersion: 1 },
        true,
      ),
    { code: "IMAGE_UNAVAILABLE" },
  );
  db.revisions.set(1, {
    snapshot: { ...initial, body: "![image](/api/images/available-image)" },
  });
  await assert.rejects(
    () => restoreContentVersion(db.tx, admin, "lesson", 1, 1, true),
    { code: "IMAGE_UNAVAILABLE" },
  );
  assert.equal(db.row().version, 1);
});

test("a stale editor cannot overwrite the current version", async () => {
  const db = store();
  await saveContentVersion(
    db.tx,
    admin,
    "lesson",
    { title: "New title", expectedVersion: 1 },
    true,
  );
  await assert.rejects(
    saveContentVersion(
      db.tx,
      admin,
      "lesson",
      { title: "Lost edit", expectedVersion: 1 },
      true,
    ),
    (error) => error.code === "VERSION_CONFLICT",
  );
  assert.equal(db.row().title, "New title");
  assert.equal(db.revisions.size, 2);
  assert.equal(db.revisions.get(1).snapshot.title, "Original");
});

test("trash preserves bundled identity and history; restore creates an unpublished version", async () => {
  const db = store();
  await trashContentVersion(db.tx, admin, "lesson", 1);
  assert.equal(db.row().slug, initial.slug);
  assert.ok(db.row().deletedAt);
  assert.equal(db.row().isPublished, false);
  const deletedSnapshot = structuredClone(db.revisions.get(2));
  await restoreContentVersion(db.tx, admin, "lesson", 2, 1, true);
  assert.equal(db.row().version, 3);
  assert.equal(db.row().deletedAt, null);
  assert.equal(db.row().isPublished, false);
  assert.deepEqual(db.revisions.get(2), deletedSnapshot);
  assert.equal(db.revisions.get(3).action, "restore");
});

test("revision recovery keeps bundled slugs fixed and refuses editing trash", async () => {
  const db = store();
  await assert.rejects(
    saveContentVersion(
      db.tx,
      admin,
      "lesson",
      { slug: "other", expectedVersion: 1 },
      true,
    ),
    (error) => error.code === "BUNDLED_SLUG",
  );
  await trashContentVersion(db.tx, admin, "lesson", 1);
  await assert.rejects(
    saveContentVersion(
      db.tx,
      admin,
      "lesson",
      { title: "Hidden", expectedVersion: 2 },
      true,
    ),
    (error) => error.code === "CONTENT_TRASHED",
  );
});

test("all history mutations reject non-admin actors before touching data", async () => {
  for (const actor of [null, { id: "reader", isAdmin: false }]) {
    await assert.rejects(
      saveContentVersion({}, actor, "lesson", { expectedVersion: 1 }, false),
      (error) =>
        error instanceof ContentHistoryError && error.code === "FORBIDDEN",
    );
  }
});

const payload = {
  slug: "",
  module: "",
  subjectSlug: "",
  chapterSlug: "",
  order: "0",
  isPublic: true,
  isPublished: false,
  translations: {
    zh: { title: "未完成", body: "" },
    en: { title: "", body: "" },
  },
};

test("private autosave accepts unfinished drafts, isolates owners and detects other-tab edits", async () => {
  const db = store();
  const saved = await savePrivateDraft(db.tx, admin, "new", {
    payload,
    expectedRevision: 0,
    contentId: null,
    baseVersion: null,
  });
  assert.equal(saved.revision, 1);
  assert.equal(db.row().title, "Original");
  await assert.rejects(
    savePrivateDraft(db.tx, admin, "new", {
      payload: { ...payload, slug: "lost" },
      expectedRevision: 0,
      contentId: null,
      baseVersion: null,
    }),
    (error) => error.code === "DRAFT_CONFLICT",
  );
  await savePrivateDraft(db.tx, { id: "admin-b", isAdmin: true }, "new", {
    payload,
    expectedRevision: 0,
    contentId: null,
    baseVersion: null,
  });
  assert.equal(db.drafts.size, 2);
  await deletePrivateDraft(db.tx, admin, "new", 1);
  assert.equal(db.drafts.size, 1);
  assert.ok(db.drafts.has("admin-b:new"));
});

test("private drafts allow only editor fields and reject nested prototype keys", () => {
  assert.throws(
    () => validatePrivateDraftPayload({ ...payload, role: "ADMIN" }),
    /VALIDATION_ERROR/,
  );
  assert.throws(
    () =>
      validatePrivateDraftPayload(
        JSON.parse(
          '{"translations":{"en":{"title":"ok","body":"","__proto__":{}}}}',
        ),
      ),
    /VALIDATION_ERROR/,
  );
  assert.deepEqual(validatePrivateDraftPayload(payload), payload);
});
