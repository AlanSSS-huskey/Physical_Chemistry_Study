import test from "node:test";
import assert from "node:assert/strict";
import {
  publicAccountProfile,
  accountNameChange,
  accountSessionView,
  revokeAccountSessions,
} from "../src/lib/account-settings.ts";

test("profile exposes only editable public identity and provider availability", () => {
  const result = publicAccountProfile({
    id: "u1",
    name: "Student",
    email: "s@example.com",
    image: null,
    emailVerified: new Date(),
    passwordCredential: { userId: "u1", passwordHash: "private" },
    accounts: [{ provider: "google", access_token: "private" }],
    role: "ADMIN",
  });
  assert.deepEqual(result, {
    id: "u1",
    name: "Student",
    email: "s@example.com",
    image: null,
    emailVerified: true,
    hasPassword: true,
    googleLinked: true,
  });
  assert.deepEqual(accountNameChange({ name: "  学习者  " }), {
    name: "学习者",
  });
  for (const body of [
    { name: "x", role: "ADMIN" },
    { name: "x", email: "other@example.com" },
    { name: "\n" },
    {},
  ])
    assert.throws(() => accountNameChange(body));
});

test("session views identify this browser without leaking the authentication token or raw agent", () => {
  const row = {
    id: "s1",
    userId: "u1",
    sessionToken: `s.${"a".repeat(43)}`,
    createdAt: new Date("2026-10-28T12:00:00Z"),
    lastActiveAt: new Date("2026-10-28T13:00:00Z"),
    expires: new Date("2026-10-29T00:00:00Z"),
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 private-marker",
  };
  assert.deepEqual(accountSessionView(row, "s1"), {
    id: "s1",
    current: true,
    device: "Chrome · macOS",
    createdAt: row.createdAt.toISOString(),
    lastActiveAt: row.lastActiveAt.toISOString(),
    expiresAt: row.expires.toISOString(),
    remembered: false,
  });
  assert.equal(
    JSON.stringify(accountSessionView(row, "s2")).includes("secret"),
    false,
  );
  assert.equal(
    accountSessionView(
      { ...row, userAgent: null, sessionToken: "r.secret" },
      "s2",
    ).remembered,
    true,
  );
});

test("session revocation constrains every delete by owner and preserves the current session for sign out others", async () => {
  const rows = [
    { id: "mine", userId: "u1" },
    { id: "other", userId: "u1" },
    { id: "foreign", userId: "u2" },
  ];
  const store = {
    deleteMany: async ({ where }) => {
      const ids = rows
        .filter(
          (row) =>
            row.userId === where.userId &&
            (typeof where.id === "string"
              ? row.id === where.id
              : row.id !== where.id.not),
        )
        .map((row) => row.id);
      for (const id of ids)
        rows.splice(
          rows.findIndex((row) => row.id === id),
          1,
        );
      return { count: ids.length };
    },
  };
  await assert.rejects(
    revokeAccountSessions(store, "u1", "mine", "foreign"),
    (error) => error.code === "NOT_FOUND",
  );
  assert.equal(rows.length, 3);
  assert.deepEqual(await revokeAccountSessions(store, "u1", "mine"), {
    currentRevoked: false,
  });
  assert.deepEqual(
    rows.map((row) => row.id),
    ["mine", "foreign"],
  );
  assert.deepEqual(await revokeAccountSessions(store, "u1", "mine", "mine"), {
    currentRevoked: true,
  });
  assert.deepEqual(
    rows.map((row) => row.id),
    ["foreign"],
  );
});
