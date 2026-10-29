import test from "node:test";
import assert from "node:assert/strict";
import { createEmailAuthService } from "../src/lib/account-email.ts";
import { hashEmailToken } from "../src/lib/passwords.ts";

process.env.NEXTAUTH_SECRET = "test-only-account-service-secret";
function database() {
  const tables = Object.fromEntries(
    [
      "user",
      "passwordCredential",
      "pendingRegistration",
      "emailActionToken",
      "authRateLimit",
      "session",
    ].map((name) => [name, []]),
  );
  let sequence = 0;
  function matches(row, where = {}) {
    return Object.entries(where).every(([key, expected]) => {
      if (key === "OR") return expected.some((item) => matches(row, item));
      if (
        expected &&
        typeof expected === "object" &&
        !(expected instanceof Date)
      ) {
        if ("equals" in expected) {
          if (expected.mode === "insensitive") {
            const pattern = [...expected.equals]
              .map((character) =>
                character === "%"
                  ? ".*"
                  : character === "_"
                    ? "."
                    : character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              )
              .join("");
            return new RegExp(`^${pattern}$`, "i").test(String(row[key]));
          }
          return row[key] === expected.equals;
        }
        if ("gt" in expected && !(row[key] > expected.gt)) return false;
        if ("lt" in expected && !(row[key] < expected.lt)) return false;
        if (
          "in" in expected &&
          !(expected.mode === "insensitive"
            ? expected.in.some(
                (value) =>
                  String(row[key]).toLowerCase() === value.toLowerCase(),
              )
            : expected.in.includes(row[key]))
        )
          return false;
        if ("not" in expected && row[key] === expected.not) return false;
        return true;
      }
      return row[key] === expected;
    });
  }
  const db = {};
  for (const [name, rows] of Object.entries(tables))
    db[name] = {
      async findFirst({ where } = {}) {
        const row = rows.find((row) => matches(row, where));
        if (row && name === "user")
          return {
            ...row,
            passwordCredential:
              tables.passwordCredential.find(
                (item) => item.userId === row.id,
              ) || null,
          };
        return row ? { ...row } : null;
      },
      async findUnique(query) {
        return this.findFirst(query);
      },
      async create({ data }) {
        const row = { id: `${name}-${++sequence}`, ...data };
        rows.push(row);
        return { ...row };
      },
      async deleteMany({ where } = {}) {
        const previous = rows.length;
        for (let index = rows.length - 1; index >= 0; index--)
          if (matches(rows[index], where)) rows.splice(index, 1);
        return { count: previous - rows.length };
      },
      async delete({ where }) {
        const row = await this.findFirst({ where });
        await this.deleteMany({ where });
        return row;
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const row of rows)
          if (matches(row, where)) {
            Object.assign(row, data);
            count++;
          }
        return { count };
      },
      async update({ where, data }) {
        const row = rows.find((row) => matches(row, where));
        if (!row) throw Error("not found");
        for (const [key, value] of Object.entries(data))
          row[key] =
            value && typeof value === "object" && "increment" in value
              ? row[key] + value.increment
              : value;
        return { ...row };
      },
      async upsert({ where, create, update }) {
        return rows.some((row) => matches(row, where))
          ? this.update({ where, data: update })
          : this.create({ data: create });
      },
    };
  db.$transaction = async (operation) => operation(db);
  return { db, tables };
}
function setup(options = {}) {
  const store = database();
  const messages = [];
  const service = createEmailAuthService({
    db: store.db,
    sendMail: async (mail) => {
      messages.push(mail);
    },
    mailReady: () => true,
    ...options,
  });
  return { ...store, messages, service };
}
const request = new Request("https://study.example/api/account/register");
const password = "a long test password";

test("registration creates only a hashed pending record until ownership and matching password are proved", async () => {
  const { service, tables, messages } = setup();
  await service.register(
    { name: "Test", email: "Person@Example.com", password, locale: "en" },
    request,
  );
  assert.equal(tables.user.length, 0);
  assert.equal(tables.pendingRegistration.length, 1);
  assert.notEqual(tables.pendingRegistration[0].passwordHash, password);
  const token = messages[0].token;
  assert.equal(tables.emailActionToken[0].tokenHash, hashEmailToken(token));
  assert.ok(!JSON.stringify(tables).includes(token));
  await assert.rejects(
    () => service.verify({ token, password: "wrong long password" }, request),
    { code: "PASSWORD_MISMATCH" },
  );
  assert.equal(tables.user.length, 0);
  const user = await service.verify({ token, password }, request);
  assert.ok(user.id);
  assert.equal(tables.user.length, 1);
  assert.equal(tables.passwordCredential.length, 1);
  assert.equal(
    user.passwordHash,
    tables.passwordCredential[0].passwordHash,
    "session issuance must recheck the verified hash against a racing reset",
  );
  await assert.rejects(() => service.verify({ token, password }, request), {
    code: "TOKEN_INVALID",
  });
});
test("password change rotates the current session without extending it and revokes other sessions", async () => {
  const { service, db, tables, messages } = setup();
  await service.register(
    { name: "Test", email: "person@example.com", password },
    request,
  );
  const user = await service.verify(
    { token: messages[0].token, password },
    request,
  );
  const expires = new Date(Date.now() + 3600000);
  await db.session.create({
    data: {
      id: "current",
      sessionToken: "legacy-current",
      userId: user.id,
      expires,
    },
  });
  await db.session.create({
    data: { sessionToken: "other-device", userId: user.id, expires },
  });
  const changed = await service.changePassword(
    { currentPassword: password, password: "new long owner password" },
    user.id,
    "legacy-current",
    request,
  );
  assert.equal(tables.session.length, 1);
  assert.notEqual(changed.sessionToken, "legacy-current");
  assert.equal(changed.expires.getTime(), expires.getTime());
  assert.equal(
    (
      await service.login(
        { email: "person@example.com", password: "new long owner password" },
        request,
      )
    ).id,
    user.id,
  );
});
test("reset tokens expire, can be consumed once and revoke every existing session", async () => {
  let time = Date.now();
  const { service, db, tables, messages } = setup({ now: () => time });
  await db.user.create({
    data: {
      id: "google-user",
      email: "person@example.com",
      emailVerified: null,
    },
  });
  await db.session.create({
    data: { sessionToken: "device-1", userId: "google-user" },
  });
  await service.forgotPassword({ email: "person@example.com" }, request);
  const expired = messages[0].token;
  time += 1800001;
  await assert.rejects(
    () => service.resetPassword({ token: expired, password }, request),
    { code: "TOKEN_EXPIRED" },
  );
  await service.forgotPassword({ email: "person@example.com" }, request);
  const token = messages.at(-1).token;
  await service.resetPassword({ token, password }, request);
  assert.equal(tables.session.length, 0);
  await assert.rejects(
    () => service.resetPassword({ token, password }, request),
    { code: "TOKEN_INVALID" },
  );
});
test("existing Google accounts gain no attacker-submitted password and reset requires a fresh owner-chosen password", async () => {
  const { service, tables, messages, db } = setup();
  await db.user.create({
    data: {
      id: "google-user",
      email: "person@example.com",
      emailVerified: null,
    },
  });
  await db.session.create({
    data: { sessionToken: "existing-session", userId: "google-user" },
  });
  await service.register(
    { name: "Attacker", email: "person@example.com", password },
    request,
  );
  assert.equal(tables.pendingRegistration.length, 0);
  assert.equal(tables.passwordCredential.length, 0);
  assert.equal(messages[0].purpose, "SET_PASSWORD");
  await service.resetPassword(
    { token: messages[0].token, password: "owner chosen new password" },
    request,
  );
  assert.equal(tables.passwordCredential.length, 1);
  assert.equal(tables.session.length, 0);
  const user = await service.login(
    { email: "person@example.com", password: "owner chosen new password" },
    request,
  );
  assert.equal(user.id, "google-user");
  await assert.rejects(
    () => service.login({ email: "person@example.com", password }, request),
    { code: "INVALID_CREDENTIALS" },
  );
});
test("Google signup during pending registration cannot inherit the pending password", async () => {
  const { service, db, messages, tables } = setup();
  await service.register(
    { name: "Test", email: "person@example.com", password },
    request,
  );
  await db.user.create({
    data: { id: "new-google-user", email: "person@example.com" },
  });
  await assert.rejects(
    () => service.verify({ token: messages[0].token, password }, request),
    { code: "USE_PASSWORD_RESET" },
  );
  assert.equal(tables.passwordCredential.length, 0);
});
test("unconfigured mail fails visibly before creating registration records", async () => {
  const { service, tables } = setup({ mailReady: () => false });
  await assert.rejects(
    () =>
      service.register(
        { name: "Test", email: "person@example.com", password },
        request,
      ),
    { code: "MAIL_UNAVAILABLE" },
  );
  assert.equal(tables.pendingRegistration.length, 0);
});

test("resending near registration expiry renews both the pending registration and its bound token", async () => {
  let time = Date.now();
  const { service, tables, messages } = setup({ now: () => time });
  await service.register(
    { name: "Test", email: "person@example.com", password },
    request,
  );
  time += 23 * 3600000;
  await service.resendVerification({ email: "person@example.com" }, request);
  const token = messages.at(-1).token;
  time += 2 * 3600000;
  assert.equal(
    (await service.tokenStatus({ token, purpose: "verify" }, request)).valid,
    true,
  );
  assert.equal(
    (await service.verify({ token, password }, request)).id,
    tables.user[0].id,
  );
});
test("verification tokens are bound to the exact pending password revision", async () => {
  const { service, tables, messages } = setup();
  await service.register(
    { name: "Test", email: "person@example.com", password },
    request,
  );
  assert.equal(
    tables.emailActionToken[0].registrationHash,
    hashEmailToken(tables.pendingRegistration[0].passwordHash),
  );
  const oldToken = messages[0].token;
  await service.register(
    {
      name: "Test",
      email: "person@example.com",
      password: "a replacement long password",
    },
    request,
  );
  await assert.rejects(
    () => service.tokenStatus({ token: oldToken, purpose: "verify" }, request),
    { code: "TOKEN_INVALID" },
  );
  const currentToken = messages.at(-1).token;
  await assert.rejects(
    () => service.verify({ token: currentToken, password }, request),
    { code: "PASSWORD_MISMATCH" },
  );
  assert.ok(
    (
      await service.verify(
        { token: currentToken, password: "a replacement long password" },
        request,
      )
    ).id,
  );
});

test("unknown and existing recovery addresses both use real mail and report provider failures alike", async () => {
  for (const action of ["forgotPassword", "resendVerification"]) {
    for (const existing of [false, true]) {
      const calls = [];
      const { service, db, tables } = setup({
        sendMail: async (mail) => {
          calls.push(mail);
          throw Object.assign(new Error("MAIL_UNAVAILABLE"), {
            code: "MAIL_UNAVAILABLE",
            status: 503,
          });
        },
      });
      if (existing)
        await db.user.create({
          data: {
            id: "existing-google-user",
            email: "person@example.com",
            emailVerified: null,
          },
        });
      await assert.rejects(
        () => service[action]({ email: "person@example.com" }, request),
        { code: "MAIL_UNAVAILABLE", status: 503 },
      );
      assert.equal(calls.length, 1);
      assert.equal(
        tables.emailActionToken.length,
        0,
        "failed delivery leaves no usable action token",
      );
      assert.equal(tables.user.length, existing ? 1 : 0);
      assert.equal(tables.pendingRegistration.length, 0);
    }
  }
});
test("unknown address recovery sends neutral help without creating an account or action token", async () => {
  const { service, tables, messages } = setup();
  await service.forgotPassword(
    { email: "person@example.com", locale: "en" },
    request,
  );
  await service.resendVerification(
    { email: "person@example.com", locale: "zh" },
    request,
  );
  assert.equal(messages.length, 2);
  assert.ok(
    messages.every(
      (mail) => mail.purpose === "ACCOUNT_HELP" && !("token" in mail),
    ),
  );
  assert.equal(tables.user.length, 0);
  assert.equal(tables.pendingRegistration.length, 0);
  assert.equal(tables.emailActionToken.length, 0);
});
test("literal underscore and percent emails never match another account or bind its recovery token", async () => {
  for (const email of ["a_b@example.com", "a%b@example.com"]) {
    const { service, db, tables, messages } = setup();
    await db.user.create({
      data: {
        id: "another-google-user",
        email: "axb@example.com",
        emailVerified: null,
      },
    });
    await service.forgotPassword({ email }, request);
    assert.equal(messages.at(-1).purpose, "ACCOUNT_HELP");
    assert.equal(tables.emailActionToken.length, 0);
    await service.register(
      { name: "Literal mailbox owner", email, password },
      request,
    );
    assert.equal(messages.at(-1).purpose, "VERIFY_EMAIL");
    const created = await service.verify(
      { token: messages.at(-1).token, password },
      request,
    );
    assert.notEqual(created.id, "another-google-user");
    assert.equal(tables.user.length, 2);
  }
});
