import test from "node:test";
import assert from "node:assert/strict";
import {
  createBackupImportService,
  normalizeBackup,
} from "../src/lib/backup-import.ts";

process.env.NEXTAUTH_SECRET = "backup-import-test-only-secret";
const userId = "destination-owner";
const file = (extra = {}) => ({
  format: "physical-chemistry-account",
  version: 1,
  profile: { id: userId },
  notes: [],
  bookmarks: [],
  ...extra,
});
const note = (contentSlug, body, locale = "en") => ({
  contentSlug,
  locale,
  body,
});
function database() {
  const tables = { personalNote: [], bookmark: [], authRateLimit: [] };
  let sequence = 0;
  const db = {};
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, value]) => {
      if (key === "OR") return value.some((item) => matches(row, item));
      if (value && typeof value === "object") {
        if ("in" in value) return value.in.includes(row[key]);
        return false;
      }
      return row[key] === value;
    });
  for (const [name, rows] of Object.entries(tables))
    db[name] = {
      async findMany({ where } = {}) {
        return rows
          .filter((row) => matches(row, where))
          .map((row) => ({ ...row }));
      },
      async createMany({ data, skipDuplicates }) {
        let count = 0;
        for (const value of data) {
          const exists = rows.some(
            (row) =>
              row.userId === value.userId &&
              row.contentSlug === value.contentSlug &&
              (name === "bookmark" || row.locale === value.locale),
          );
          if (exists) {
            if (skipDuplicates) continue;
            throw Object.assign(Error("unique"), { code: "P2002" });
          }
          rows.push({
            id: `fixture-${++sequence}`,
            createdAt: new Date(0),
            updatedAt: new Date(0),
            ...value,
          });
          count++;
        }
        return { count };
      },
      async upsert({ where, create, update }) {
        const row = rows.find((item) => matches(item, where));
        if (row) {
          row.count += update.count.increment;
          return { ...row };
        }
        rows.push({ ...create });
        return { ...create };
      },
    };
  db.$executeRaw = async (query) => {
    const owner = query.values.at(-1);
    let count = 0;
    for (let index = 0; index < query.values.length - 1; index += 5) {
      const [slug, locale, revision, previousBody, body] = query.values.slice(
        index,
        index + 5,
      );
      const row = tables.personalNote.find(
        (item) =>
          item.userId === owner &&
          item.contentSlug === slug &&
          item.locale === locale &&
          item.revision === revision &&
          item.body === previousBody,
      );
      if (row) {
        row.body = body;
        row.revision++;
        row.updatedAt = new Date(1);
        count++;
      }
    }
    return count;
  };
  db.$transaction = async (operation, settings) => {
    assert.equal(settings.isolationLevel, "Serializable");
    const before = structuredClone(tables);
    try {
      const result = await operation(db);
      if (db.failCommit)
        throw Object.assign(Error("serialization"), { code: "P2034" });
      return result;
    } catch (error) {
      for (const [name, rows] of Object.entries(tables))
        rows.splice(0, rows.length, ...before[name]);
      throw error;
    }
  };
  return { db, tables };
}
function setup(options = {}) {
  const store = database();
  return {
    ...store,
    service: createBackupImportService({ db: store.db, ...options }),
  };
}

test("only site version-one notes and bookmarks normalize; identities, counts, content and file size are bounded", () => {
  const valid = normalizeBackup(
    file({
      notes: [note("removed/chapter", "自己的私人文本")],
      bookmarks: [{ contentSlug: "removed/chapter" }],
      role: "ADMIN",
      progress: [{ contentSlug: "paid", status: "COMPLETED" }],
    }),
  );
  assert.deepEqual(valid.notes, [note("removed/chapter", "自己的私人文本")]);
  assert.equal("role" in valid, false);
  assert.equal("progress" in valid, false);
  for (const invalid of [
    file({ version: 2 }),
    file({ format: "other-site" }),
    file({ notes: [note("../escape", "x")] }),
    file({ notes: [note("a", "x", "fr")] }),
    file({ notes: [note("a", "x".repeat(5001))] }),
    file({ notes: [note("a", "x"), note("a", "other")] }),
    file({ bookmarks: [{ contentSlug: "a" }, { contentSlug: "a" }] }),
    file({
      notes: Array.from({ length: 101 }, (_, index) => note(`n-${index}`, "x")),
    }),
    file({
      bookmarks: Array.from({ length: 501 }, (_, index) => ({
        contentSlug: `b-${index}`,
      })),
    }),
  ])
    assert.throws(() => normalizeBackup(invalid), { code: "BACKUP_INVALID" });
  assert.throws(
    () => normalizeBackup(file({ ignored: "x".repeat(1024 * 1024) })),
    { code: "BACKUP_TOO_LARGE" },
  );
});
test("preview reads only the destination's own target rows and never changes data or loads chapter metadata", async () => {
  const { service, tables } = setup();
  tables.personalNote.push(
    {
      id: "own",
      userId,
      contentSlug: "a",
      locale: "en",
      body: "old",
      revision: 2,
      updatedAt: new Date(0),
    },
    {
      id: "other",
      userId: "other",
      contentSlug: "b",
      locale: "en",
      body: "DO NOT EXPOSE",
      revision: 1,
    },
  );
  tables.bookmark.push({
    id: "own-bookmark",
    userId,
    contentSlug: "a",
    createdAt: new Date(0),
  });
  const preview = await service.preview(userId, {
    backup: file({
      profile: { id: "source-owner", email: "not-written@example.invalid" },
      notes: [note("a", "new"), note("b", "imported")],
      bookmarks: [{ contentSlug: "a" }, { contentSlug: "removed/chapter" }],
    }),
  });
  assert.equal(preview.sourceAccountDifferent, true);
  assert.deepEqual(
    preview.notes.map((item) => [
      item.slug,
      item.status,
      item.currentBody,
      item.currentRevision,
    ]),
    [
      ["a", "conflict", "old", 2],
      ["b", "new", null, null],
    ],
  );
  assert.deepEqual(preview.bookmarks, { newCount: 1, existingCount: 1 });
  assert.ok(!JSON.stringify(preview).includes("DO NOT EXPOSE"));
  assert.equal(tables.personalNote.length, 2);
  assert.equal(tables.bookmark.length, 1);
});
test("default apply preserves conflicting writing, restores unavailable slugs, and writes no account or course state", async () => {
  const { service, tables } = setup();
  tables.personalNote.push({
    id: "own",
    userId,
    contentSlug: "a",
    locale: "en",
    body: "keep me",
    revision: 3,
    updatedAt: new Date(0),
  });
  const backup = file({
    notes: [
      note("a", "incoming"),
      note("removed/chapter", "recover private writing"),
    ],
    bookmarks: [{ contentSlug: "removed/chapter" }],
    profile: { id: userId, role: "ADMIN" },
    preferences: { theme: "dark" },
    progress: [{ contentSlug: "paid", status: "COMPLETED" }],
  });
  const preview = await service.preview(userId, { backup });
  const result = await service.apply(userId, {
    backup,
    previewToken: preview.previewToken,
    confirm: true,
  });
  assert.deepEqual(result, {
    notesCreated: 1,
    notesUpdated: 0,
    notesSkipped: 1,
    bookmarksAdded: 1,
  });
  assert.equal(
    tables.personalNote.find((row) => row.contentSlug === "a").body,
    "keep me",
  );
  assert.equal(
    tables.personalNote.find((row) => row.contentSlug === "removed/chapter")
      .revision,
    1,
  );
  assert.equal(tables.bookmark.length, 1);
});
test("explicit replacement updates only matching own conflicts atomically and preserves literal SQL-looking text", async () => {
  const { service, tables } = setup();
  tables.personalNote.push(
    {
      id: "own",
      userId,
      contentSlug: "a",
      locale: "en",
      body: "old",
      revision: 2,
      updatedAt: new Date(0),
    },
    {
      id: "other",
      userId: "other",
      contentSlug: "a",
      locale: "en",
      body: "other private",
      revision: 2,
      updatedAt: new Date(0),
    },
  );
  const body = "'); DELETE FROM User; --\n自己的笔记";
  const backup = file({ notes: [note("a", body)] });
  const preview = await service.preview(userId, { backup });
  const result = await service.apply(userId, {
    backup,
    previewToken: preview.previewToken,
    conflictMode: "replace-conflicts",
    confirm: true,
  });
  assert.equal(result.notesUpdated, 1);
  assert.equal(tables.personalNote[0].body, body);
  assert.equal(tables.personalNote[0].revision, 3);
  assert.equal(tables.personalNote[1].body, "other private");
});
test("changed target rows, changed files, cross-account tokens, tampering and expired previews cannot write", async () => {
  let time = Date.now();
  const { service, tables } = setup({ now: () => time });
  const backup = file({ notes: [note("a", "incoming")] });
  const preview = await service.preview(userId, { backup });
  for (const attempt of [
    {
      who: "other",
      input: { backup, previewToken: preview.previewToken, confirm: true },
    },
    {
      who: userId,
      input: {
        backup: file({ notes: [note("a", "different")] }),
        previewToken: preview.previewToken,
        confirm: true,
      },
    },
    {
      who: userId,
      input: {
        backup,
        previewToken: preview.previewToken + "x",
        confirm: true,
      },
    },
  ])
    await assert.rejects(() => service.apply(attempt.who, attempt.input), {
      code: "PREVIEW_INVALID",
    });
  assert.equal(tables.personalNote.length, 0);
  tables.personalNote.push({
    id: "other-device",
    userId,
    contentSlug: "a",
    locale: "en",
    body: "other device saved",
    revision: 1,
    updatedAt: new Date(0),
  });
  await assert.rejects(
    () =>
      service.apply(userId, {
        backup,
        previewToken: preview.previewToken,
        confirm: true,
      }),
    { code: "PREVIEW_STALE" },
  );
  assert.equal(tables.personalNote[0].body, "other device saved");
  const fresh = await service.preview(userId, { backup });
  time += 600001;
  await assert.rejects(
    () =>
      service.apply(userId, {
        backup,
        previewToken: fresh.previewToken,
        confirm: true,
      }),
    { code: "PREVIEW_EXPIRED" },
  );
});
test("a serialization failure rolls back created notes, conflict updates and bookmarks as one import", async () => {
  const { service, db, tables } = setup();
  tables.personalNote.push({
    id: "own",
    userId,
    contentSlug: "a",
    locale: "en",
    body: "old",
    revision: 1,
    updatedAt: new Date(0),
  });
  const backup = file({
    notes: [note("a", "replace"), note("b", "create")],
    bookmarks: [{ contentSlug: "b" }],
  });
  const preview = await service.preview(userId, { backup });
  db.failCommit = true;
  await assert.rejects(
    () =>
      service.apply(userId, {
        backup,
        previewToken: preview.previewToken,
        conflictMode: "replace-conflicts",
        confirm: true,
      }),
    { code: "PREVIEW_STALE" },
  );
  assert.equal(tables.personalNote.length, 1);
  assert.equal(tables.personalNote[0].body, "old");
  assert.equal(tables.personalNote[0].revision, 1);
  assert.equal(tables.bookmark.length, 0);
});
test("identical notes and existing bookmarks remain idempotent without incrementing revisions", async () => {
  const { service, tables } = setup();
  tables.personalNote.push({
    id: "own",
    userId,
    contentSlug: "a",
    locale: "en",
    body: "same",
    revision: 9,
    updatedAt: new Date(0),
  });
  tables.bookmark.push({
    id: "bookmark",
    userId,
    contentSlug: "a",
    createdAt: new Date(0),
  });
  const backup = file({
    notes: [note("a", "same")],
    bookmarks: [{ contentSlug: "a" }],
  });
  const preview = await service.preview(userId, { backup });
  assert.equal(preview.notes[0].status, "identical");
  assert.deepEqual(
    await service.apply(userId, {
      backup,
      previewToken: preview.previewToken,
      confirm: true,
    }),
    { notesCreated: 0, notesUpdated: 0, notesSkipped: 1, bookmarksAdded: 0 },
  );
  assert.equal(tables.personalNote[0].revision, 9);
});
test("maximum supported import uses bounded bulk writes and preserves all hundred note identities", async () => {
  const { service, db, tables } = setup();
  const notes = Array.from({ length: 100 }, (_, index) =>
    note(`n-${index}`, `incoming ${index}`),
  );
  for (let index = 0; index < 50; index++)
    tables.personalNote.push({
      id: `old-${index}`,
      userId,
      contentSlug: `n-${index}`,
      locale: "en",
      body: "old",
      revision: 4,
      updatedAt: new Date(0),
    });
  let writes = 0;
  const update = db.$executeRaw;
  db.$executeRaw = async (sql) => {
    writes++;
    return update(sql);
  };
  for (const model of [db.personalNote, db.bookmark]) {
    const create = model.createMany;
    model.createMany = async (query) => {
      writes++;
      return create(query);
    };
  }
  const backup = file({
    notes,
    bookmarks: Array.from({ length: 500 }, (_, index) => ({
      contentSlug: `b-${index}`,
    })),
  });
  const preview = await service.preview(userId, { backup });
  assert.deepEqual(
    await service.apply(userId, {
      backup,
      previewToken: preview.previewToken,
      conflictMode: "replace-conflicts",
      confirm: true,
    }),
    {
      notesCreated: 50,
      notesUpdated: 50,
      notesSkipped: 0,
      bookmarksAdded: 500,
    },
  );
  assert.equal(writes, 3);
  assert.equal(tables.personalNote.length, 100);
  assert.equal(tables.bookmark.length, 500);
  assert.equal(
    tables.personalNote.find((item) => item.contentSlug === "n-0").revision,
    5,
  );
});
test("bookmark changes invalidate the preview and explicit confirmation is mandatory", async () => {
  const { service, tables } = setup();
  const backup = file({ bookmarks: [{ contentSlug: "removed/chapter" }] });
  const preview = await service.preview(userId, { backup });
  await assert.rejects(
    () =>
      service.apply(userId, {
        backup,
        previewToken: preview.previewToken,
        confirm: "true",
      }),
    { code: "CONFIRMATION_REQUIRED" },
  );
  tables.bookmark.push({
    id: "other-device",
    userId,
    contentSlug: "removed/chapter",
    createdAt: new Date(0),
  });
  await assert.rejects(
    () =>
      service.apply(userId, {
        backup,
        previewToken: preview.previewToken,
        confirm: true,
      }),
    { code: "PREVIEW_STALE" },
  );
  assert.equal(tables.bookmark.length, 1);
});
test("preview and apply rate limits are independently scoped to each account without raw identity keys", async () => {
  const { service, tables } = setup();
  const backup = file();
  for (let index = 0; index < 20; index++)
    await service.preview(userId, { backup });
  await assert.rejects(() => service.preview(userId, { backup }), {
    code: "RATE_LIMITED",
    status: 429,
  });
  const other = await service.preview("other-owner", { backup });
  for (let index = 0; index < 5; index++)
    await service.apply("other-owner", {
      backup,
      previewToken: other.previewToken,
      confirm: true,
    });
  await assert.rejects(
    () =>
      service.apply("other-owner", {
        backup,
        previewToken: other.previewToken,
        confirm: true,
      }),
    { code: "RATE_LIMITED" },
  );
  assert.ok(
    tables.authRateLimit.every((row) => /^[a-f0-9]{64}$/.test(row.key)),
  );
});
