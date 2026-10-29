import test from "node:test";
import assert from "node:assert/strict";
import { limitAccountAvatar } from "../src/lib/account-avatar-rate.ts";

test("avatar storage limits are per owner, bounded by hour and day, and use no raw identity keys", async () => {
  const rows = new Map();
  const store = {
    upsert: async ({ where, create }) => {
      const count = (rows.get(where.key) || 0) + 1;
      rows.set(where.key, count);
      return { ...create, count };
    },
  };
  const secret = "isolated-avatar-test-secret";
  const firstHour = Date.parse("2026-10-28T10:00:01Z");
  for (let i = 0; i < 5; i++)
    await limitAccountAvatar(store, "private-owner", secret, firstHour);
  await assert.rejects(
    limitAccountAvatar(store, "private-owner", secret, firstHour),
    (error) =>
      error.code === "RATE_LIMITED" &&
      error.status === 429 &&
      error.retryAfter > 0,
  );
  await limitAccountAvatar(store, "another-owner", secret, firstHour);
  for (let i = 0; i < 5; i++)
    await limitAccountAvatar(
      store,
      "private-owner",
      secret,
      firstHour + 3600_000,
    );
  await assert.rejects(
    limitAccountAvatar(store, "private-owner", secret, firstHour + 7200_000),
    (error) => error.code === "RATE_LIMITED",
  );
  await limitAccountAvatar(
    store,
    "private-owner",
    secret,
    firstHour + 86400_000,
  );
  assert.equal(
    [...rows.keys()].every((key) => /^[a-f0-9]{64}$/.test(key)),
    true,
  );
});
