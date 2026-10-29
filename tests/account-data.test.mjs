import test from "node:test";
import assert from "node:assert/strict";
import {
  createAccountDataService,
  accountDataExport,
  requireAccountDataIdentity,
} from "../src/lib/account-data.ts";

process.env.NEXTAUTH_SECRET = "test-only-account-data-secret";
function database() {
  const names = [
    "user",
    "passwordCredential",
    "session",
    "account",
    "studyPreference",
    "readingPosition",
    "bookmark",
    "personalNote",
    "progress",
    "imageAsset",
    "content",
    "contentDraft",
    "contentRevision",
    "emailChangeRequest",
    "accountDeletionRequest",
    "storageDeletion",
    "emailActionToken",
    "pendingRegistration",
    "authRateLimit",
  ];
  const tables = Object.fromEntries(names.map((name) => [name, []]));
  const queries = [];
  let sequence = 0;
  function matches(row, where = {}) {
    return Object.entries(where).every(([key, value]) => {
      if (key === "OR") return value.some((branch) => matches(row, branch));
      if (key === "AND") return value.every((branch) => matches(row, branch));
      if (value && typeof value === "object" && !(value instanceof Date)) {
        if ("contains" in value)
          return (
            typeof row[key] === "string" && row[key].includes(value.contains)
          );
        if ("string_contains" in value) {
          const field = value.path.reduce(
            (result, part) => result?.[part],
            row[key],
          );
          return (
            typeof field === "string" && field.includes(value.string_contains)
          );
        }
        if ("in" in value)
          return value.mode === "insensitive"
            ? value.in.some(
                (item) => String(row[key]).toLowerCase() === item.toLowerCase(),
              )
            : value.in.includes(row[key]);
        if ("not" in value && row[key] === value.not) return false;
        if ("gt" in value && !(row[key] > value.gt)) return false;
        if ("lt" in value && !(row[key] < value.lt)) return false;
        if ("lte" in value && !(row[key] <= value.lte)) return false;
        return true;
      }
      return value instanceof Date
        ? row[key]?.getTime() === value.getTime()
        : row[key] === value;
    });
  }
  const db = {};
  for (const [name, rows] of Object.entries(tables))
    db[name] = {
      async findMany({ where, take, select } = {}) {
        queries.push({ name, method: "findMany", select });
        const found = rows.filter((row) => matches(row, where));
        return found.slice(0, take ?? found.length).map((row) => ({ ...row }));
      },
      async findFirst(query = {}) {
        queries.push({ name, method: "findFirst", select: query.select });
        const row = rows.find((row) => matches(row, query.where));
        if (!row) return null;
        return name === "user"
          ? {
              ...row,
              passwordCredential:
                tables.passwordCredential.find(
                  (item) => item.userId === row.id,
                ) || null,
            }
          : row;
      },
      async findUnique(query) {
        return this.findFirst(query);
      },
      async count(query = {}) {
        return (await this.findMany(query)).length;
      },
      async create({ data }) {
        const row = {
          id: `${name}-${++sequence}`,
          oldConfirmedAt: null,
          newConfirmedAt: null,
          attempts: 0,
          ...data,
        };
        rows.push(row);
        return { ...row };
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const row of rows)
          if (matches(row, where)) {
            for (const [key, value] of Object.entries(data))
              row[key] =
                value && typeof value === "object" && "increment" in value
                  ? row[key] + value.increment
                  : value;
            count++;
          }
        return { count };
      },
      async update({ where, data }) {
        const row = await this.findFirst({ where });
        if (!row) throw Object.assign(Error("not found"), { code: "P2025" });
        await this.updateMany({ where, data });
        return this.findFirst({ where: { id: row.id } });
      },
      async deleteMany({ where } = {}) {
        let count = 0;
        for (let index = rows.length - 1; index >= 0; index--)
          if (matches(rows[index], where)) {
            rows.splice(index, 1);
            count++;
          }
        return { count };
      },
      async delete({ where }) {
        const row = await this.findFirst({ where });
        if (!row) throw Error("not found");
        if (name === "user") {
          for (const [kind, related] of Object.entries(tables))
            if (!["user", "imageAsset", "storageDeletion"].includes(kind)) {
              for (let index = related.length - 1; index >= 0; index--)
                if (related[index].userId === row.id) related.splice(index, 1);
            }
          for (const asset of tables.imageAsset)
            if (asset.uploadedBy === row.id) asset.uploadedBy = null;
        }
        await this.deleteMany({ where });
        return row;
      },
      async upsert({ where, create, update }) {
        return (await this.findFirst({ where }))
          ? this.update({ where, data: update })
          : this.create({ data: create });
      },
    };
  db.$transaction = async (operation) => {
    const before = structuredClone(tables);
    try {
      return await operation(db);
    } catch (error) {
      for (const name of names)
        tables[name].splice(0, tables[name].length, ...before[name]);
      throw error;
    }
  };
  return { db, tables, queries };
}
async function setup(options = {}) {
  const store = database();
  const messages = [];
  const deleted = [];
  await store.db.user.create({
    data: {
      id: "owner",
      name: "Owner",
      email: "owner@example.com",
      emailVerified: new Date(),
      image: null,
      role: "USER",
      createdAt: new Date(),
    },
  });
  await store.db.session.create({
    data: {
      userId: "owner",
      sessionToken: "private-session-secret",
      expires: new Date(Date.now() + 3600000),
    },
  });
  const service = createAccountDataService({
    db: store.db,
    mailReady: () => true,
    sendMail: async (message) => {
      messages.push(message);
    },
    checkPassword: async (password) => password === "correct password",
    deleteObject: async (objectPath) => {
      deleted.push(objectPath);
    },
    ...options,
  });
  return { ...store, service, messages, deleted };
}
const request = new Request("https://study.example/api/account/data");

test("a stale account panel cannot act on a switched session even when both passwords match", async () => {
  const { service, db, tables } = await setup();
  await db.passwordCredential.create({
    data: { userId: "owner", passwordHash: "shared-password" },
  });
  await db.user.create({
    data: { id: "other", email: "other@example.com", role: "USER" },
  });
  await db.passwordCredential.create({
    data: { userId: "other", passwordHash: "shared-password" },
  });
  const stale = new Request(request.url, {
    headers: { "X-Account-User": "owner" },
  });
  await assert.rejects(
    async () => {
      const session = requireAccountDataIdentity(stale, { userId: "other" });
      await service.requestDeletion(
        session.userId,
        { confirmation: "DELETE", currentPassword: "correct password" },
        stale,
      );
    },
    { code: "SESSION_CHANGED", status: 409 },
  );
  assert.equal(tables.user.length, 2);
  assert.equal(tables.passwordCredential.length, 2);
  assert.equal(
    tables.authRateLimit.length,
    0,
    "identity rejection precedes any action or rate mutation",
  );
  assert.throws(
    () => requireAccountDataIdentity(request, { userId: "owner" }),
    { code: "SESSION_CHANGED" },
  );
  assert.throws(() => requireAccountDataIdentity(stale, null), {
    code: "UNAUTHENTICATED",
  });
  assert.equal(
    requireAccountDataIdentity(stale, { userId: "owner" }).userId,
    "owner",
  );
});

test("export allowlists omit credentials, proofs, sessions and extra fields at every depth", () => {
  const value = accountDataExport({
    profile: {
      id: "owner",
      name: "Owner",
      email: "owner@example.com",
      passwordHash: "SECRET",
      accounts: [{ access_token: "SECRET" }],
      sessions: [{ sessionToken: "SECRET" }],
    },
    preferences: {
      fontSize: 18,
      lineHeight: 1.8,
      theme: "system",
      secret: "SECRET",
    },
    readingPositions: [
      {
        contentSlug: "lesson",
        locale: "en",
        anchor: "section",
        progress: 0.4,
        sessionToken: "SECRET",
      },
    ],
    bookmarks: [{ contentSlug: "lesson", secret: "SECRET" }],
    notes: [
      {
        contentSlug: "lesson",
        locale: "en",
        body: "My own note",
        passwordHash: "SECRET",
      },
    ],
    progress: [
      { contentSlug: "lesson", status: "COMPLETED", secret: "SECRET" },
    ],
  });
  assert.ok(!JSON.stringify(value).includes("SECRET"));
  assert.equal(value.notes[0].body, "My own note");
  assert.equal(value.profile.email, "owner@example.com");
});
test("export queries scope every study record to the authenticated owner", async () => {
  const { service, db } = await setup();
  await db.personalNote.create({
    data: {
      userId: "owner",
      contentSlug: "lesson",
      locale: "en",
      body: "Own note",
    },
  });
  await db.personalNote.create({
    data: {
      userId: "someone-else",
      contentSlug: "lesson",
      locale: "en",
      body: "OTHER PRIVATE NOTE",
    },
  });
  const document = await service.export("owner");
  assert.equal(document.notes.length, 1);
  assert.ok(!JSON.stringify(document).includes("OTHER PRIVATE NOTE"));
});
test("email change needs two independent one-use confirmations and revokes all old sessions", async () => {
  const { service, db, tables, messages } = await setup();
  await db.passwordCredential.create({
    data: { userId: "owner", passwordHash: "stored-hash" },
  });
  await assert.rejects(
    () =>
      service.requestEmailChange(
        "owner",
        { email: "new@example.com", currentPassword: "wrong" },
        request,
      ),
    { code: "CURRENT_PASSWORD_INVALID" },
  );
  await service.requestEmailChange(
    "owner",
    { email: "new@example.com", currentPassword: "correct password" },
    request,
  );
  assert.equal(messages.length, 2);
  assert.notEqual(messages[0].token, messages[1].token);
  const first = await service.confirmEmailChange(
    { token: messages[0].token, confirm: true },
    request,
  );
  assert.equal(first.completed, false);
  assert.equal(tables.user[0].email, "owner@example.com");
  await assert.rejects(
    () =>
      service.confirmEmailChange(
        { token: messages[0].token, confirm: true },
        request,
      ),
    { code: "TOKEN_INVALID" },
  );
  assert.equal(
    (
      await service.confirmEmailChange(
        { token: messages[1].token, confirm: true },
        request,
      )
    ).completed,
    true,
  );
  assert.equal(tables.user[0].email, "new@example.com");
  assert.equal(tables.session.length, 0);
});
test("email confirmations reject changed accounts and concurrent target ownership", async () => {
  const { service, db, tables, messages } = await setup();
  await service.requestEmailChange(
    "owner",
    { email: "new@example.com" },
    request,
  );
  await service.confirmEmailChange(
    { token: messages[0].token, confirm: true },
    request,
  );
  await db.user.create({
    data: { id: "other", email: "NEW@example.com", role: "USER" },
  });
  await assert.rejects(
    () =>
      service.confirmEmailChange(
        { token: messages[1].token, confirm: true },
        request,
      ),
    { code: "EMAIL_UNAVAILABLE" },
  );
  assert.equal(tables.user[0].email, "owner@example.com");
  assert.equal(tables.session.length, 1);
});
test("partial email delivery invalidates that request and reports uncertainty truthfully", async () => {
  let sent = 0;
  const { service, tables } = await setup({
    sendMail: async () => {
      if (++sent === 2) throw Error("provider rejected");
    },
  });
  await assert.rejects(
    () =>
      service.requestEmailChange(
        "owner",
        { email: "new@example.com" },
        request,
      ),
    { code: "MAIL_PARTIAL" },
  );
  assert.equal(tables.emailChangeRequest.length, 0);
  assert.equal(tables.user[0].email, "owner@example.com");
});
test("email-change proof stays inactive until both delivery acknowledgments", async () => {
  let service;
  let oldToken;
  const observed = [];
  const result = await setup({
    sendMail: async (message) => {
      if (message.purpose === "EMAIL_CHANGE_OLD") oldToken = message.token;
      else {
        for (const token of [oldToken, message.token]) {
          try {
            await service.confirmEmailChange({ token, confirm: true }, request);
            observed.push("CONFIRMED");
          } catch (error) {
            observed.push(error.code);
          }
        }
        throw Error("second delivery failed");
      }
    },
  });
  service = result.service;
  await assert.rejects(
    () =>
      service.requestEmailChange(
        "owner",
        { email: "new@example.com" },
        request,
      ),
    { code: "MAIL_PARTIAL" },
  );
  assert.equal(result.tables.user[0].email, "owner@example.com");
  assert.equal(result.tables.emailChangeRequest.length, 0);
  assert.deepEqual(observed, ["TOKEN_EXPIRED", "TOKEN_EXPIRED"]);
});
test("Google-only deletion needs an explicit, unexpired and one-use mailbox proof", async () => {
  const { service, tables, messages } = await setup();
  await assert.rejects(
    () =>
      service.requestDeletion("owner", { confirmation: "not-delete" }, request),
    { code: "CONFIRMATION_REQUIRED" },
  );
  const requested = await service.requestDeletion(
    "owner",
    { confirmation: "DELETE" },
    request,
  );
  assert.equal(requested.deleted, false);
  assert.equal(tables.user.length, 1);
  await service.confirmDeletion(
    { token: messages[0].token, confirmation: "DELETE" },
    request,
  );
  assert.equal(tables.user.length, 0);
  await assert.rejects(
    () =>
      service.confirmDeletion(
        { token: messages[0].token, confirmation: "DELETE" },
        request,
      ),
    { code: "TOKEN_INVALID" },
  );
});
test("last administrator cannot be deleted and queue changes roll back atomically", async () => {
  const { service, db, tables, deleted } = await setup();
  await db.user.update({ where: { id: "owner" }, data: { role: "ADMIN" } });
  await db.passwordCredential.create({
    data: { userId: "owner", passwordHash: "stored" },
  });
  await db.imageAsset.create({
    data: {
      id: "avatar",
      uploadedBy: "owner",
      purpose: "AVATAR",
      storagePath: "owner/avatar.png",
    },
  });
  await assert.rejects(
    () =>
      service.requestDeletion(
        "owner",
        { confirmation: "DELETE", currentPassword: "correct password" },
        request,
      ),
    { code: "LAST_ADMIN" },
  );
  assert.equal(tables.user.length, 1);
  assert.equal(tables.imageAsset.length, 1);
  assert.equal(tables.storageDeletion.length, 0);
  assert.equal(deleted.length, 0);
});
test("deletion preserves public illustrations, removes private study data and durably queues failed avatar cleanup", async () => {
  const { service, db, tables } = await setup({
    deleteObject: async () => {
      throw Error("storage offline");
    },
  });
  await db.passwordCredential.create({
    data: { userId: "owner", passwordHash: "stored" },
  });
  await db.personalNote.create({ data: { userId: "owner", body: "private" } });
  await db.imageAsset.create({
    data: {
      id: "avatar",
      uploadedBy: "owner",
      purpose: "AVATAR",
      storagePath: "owner/avatar.png",
    },
  });
  await db.imageAsset.create({
    data: {
      id: "illustration",
      uploadedBy: "owner",
      purpose: "CONTENT",
      storagePath: "owner/public.png",
    },
  });
  assert.equal(
    (
      await service.requestDeletion(
        "owner",
        { confirmation: "DELETE", currentPassword: "correct password" },
        request,
      )
    ).deleted,
    true,
  );
  assert.equal(tables.user.length, 0);
  assert.equal(tables.personalNote.length, 0);
  assert.equal(tables.session.length, 0);
  assert.deepEqual(
    tables.imageAsset.map((asset) => [asset.id, asset.uploadedBy]),
    [["illustration", null]],
  );
  assert.equal(tables.storageDeletion[0].path, "owner/avatar.png");
  assert.equal(tables.storageDeletion[0].attempts, 1);
});
test("deletion preserves content images and avatars referenced by published text, translations, drafts or history", async () => {
  const { service, db, tables, deleted } = await setup();
  await db.passwordCredential.create({
    data: { userId: "owner", passwordHash: "stored" },
  });
  await db.user.update({
    where: { id: "owner" },
    data: { image: "/api/images/content" },
  });
  for (const id of ["body", "zh", "en", "draft", "history", "unused"]) {
    await db.imageAsset.create({
      data: {
        id,
        uploadedBy: "owner",
        purpose: "AVATAR",
        url: `/api/images/${id}`,
        storagePath: `owner/${id}.png`,
      },
    });
  }
  await db.imageAsset.create({
    data: {
      id: "content",
      uploadedBy: "owner",
      purpose: "CONTENT",
      url: "/api/images/content",
      storagePath: "owner/content.png",
    },
  });
  await db.content.create({
    data: {
      body: "![image](/api/images/body?download=1)",
      translations: {
        zh: { body: "![图](/api/images/zh)" },
        en: { body: "![image](https://study.example/api/images/en)" },
      },
    },
  });
  await db.contentDraft.create({
    data: {
      userId: "editor",
      payload: { body: "![draft](/api/images/draft)" },
    },
  });
  await db.contentRevision.create({
    data: {
      snapshot: {
        translations: { en: { body: "![history](/api/images/history)" } },
      },
    },
  });
  await service.requestDeletion(
    "owner",
    { confirmation: "DELETE", currentPassword: "correct password" },
    request,
  );
  assert.deepEqual(
    tables.imageAsset.map((asset) => [asset.id, asset.uploadedBy]),
    ["body", "zh", "en", "draft", "history", "content"].map((id) => [id, null]),
  );
  assert.deepEqual(deleted, ["owner/unused.png"]);
  assert.equal(tables.storageDeletion.length, 0);
});
test("avatar reference checks return bounded ids instead of materializing large article or recovery payloads", async () => {
  const { service, db, queries, deleted } = await setup();
  await db.passwordCredential.create({
    data: { userId: "owner", passwordHash: "stored" },
  });
  await db.imageAsset.create({
    data: {
      id: "unreferenced",
      uploadedBy: "owner",
      purpose: "AVATAR",
      url: "/api/images/unreferenced",
      storagePath: "owner/unreferenced.png",
    },
  });
  await db.content.create({
    data: {
      body: "大".repeat(900000),
      translations: { zh: { body: "大".repeat(900000) } },
    },
  });
  await db.contentDraft.create({
    data: {
      userId: "editor",
      payload: { translations: { en: { body: "x".repeat(900000) } } },
    },
  });
  await db.contentRevision.create({
    data: { snapshot: { body: "x".repeat(900000) } },
  });
  await service.requestDeletion(
    "owner",
    { confirmation: "DELETE", currentPassword: "correct password" },
    request,
  );
  const referenceQueries = queries.filter((query) =>
    ["content", "contentDraft", "contentRevision"].includes(query.name),
  );
  assert.equal(referenceQueries.length, 3);
  for (const query of referenceQueries) {
    assert.equal(query.method, "findFirst");
    assert.deepEqual(query.select, { id: true });
  }
  assert.deepEqual(deleted, ["owner/unreferenced.png"]);
});
test("a database failure after queue insertion rolls back user, avatar and cleanup metadata together", async () => {
  const { service, db, tables, deleted } = await setup();
  await db.passwordCredential.create({
    data: { userId: "owner", passwordHash: "stored" },
  });
  await db.imageAsset.create({
    data: {
      id: "avatar",
      uploadedBy: "owner",
      purpose: "AVATAR",
      storagePath: "owner/avatar.png",
    },
  });
  db.user.delete = async () => {
    throw Error("database write failed");
  };
  await assert.rejects(() =>
    service.requestDeletion(
      "owner",
      { confirmation: "DELETE", currentPassword: "correct password" },
      request,
    ),
  );
  assert.equal(tables.user.length, 1);
  assert.equal(tables.imageAsset.length, 1);
  assert.equal(tables.storageDeletion.length, 0);
  assert.equal(deleted.length, 0);
});
test("expired deletion proof and a proof superseded by a new password cannot delete the account", async () => {
  let time = Date.now();
  const { service, db, tables, messages } = await setup({ now: () => time });
  await service.requestDeletion("owner", { confirmation: "DELETE" }, request);
  const first = messages[0].token;
  time += 1800001;
  await assert.rejects(
    () =>
      service.confirmDeletion(
        { token: first, confirmation: "DELETE" },
        request,
      ),
    { code: "TOKEN_EXPIRED" },
  );
  await service.requestDeletion("owner", { confirmation: "DELETE" }, request);
  await db.passwordCredential.create({
    data: { userId: "owner", passwordHash: "newly-set-password" },
  });
  await assert.rejects(
    () =>
      service.confirmDeletion(
        { token: messages.at(-1).token, confirmation: "DELETE" },
        request,
      ),
    { code: "REAUTH_REQUIRED" },
  );
  assert.equal(tables.user.length, 1);
});
