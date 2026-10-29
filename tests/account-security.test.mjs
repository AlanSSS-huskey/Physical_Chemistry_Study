import test from "node:test";
import assert from "node:assert/strict";
import {
  accountCsrfResponse,
  assertAccountMutation,
  getAccountMutation,
  AccountError,
  normalizeAccountEmail,
  validatePassword,
  validateAccountName,
  accountSessionToken,
} from "../src/lib/account-security.ts";

process.env.NEXTAUTH_SECRET = "test-only-account-security-secret";
const origin = "https://study.example";
function issued() {
  const response = accountCsrfResponse(
    new Request(`${origin}/api/account/csrf`),
  );
  return { response, cookie: response.headers.getSetCookie()[0].split(";")[0] };
}
test("account mutations require matching Origin, signed cookie and CSRF header", async () => {
  const { response, cookie } = issued();
  const { csrfToken } = await response.json();
  const request = new Request(`${origin}/api/account/login`, {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookie,
      "X-CSRF-Token": csrfToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: "person@example.com" }),
  });
  assert.deepEqual(await getAccountMutation(request), {
    email: "person@example.com",
  });
  for (const headers of [
    { Origin: origin },
    { Cookie: cookie, "X-CSRF-Token": csrfToken },
    {
      Origin: "https://evil.example",
      Cookie: cookie,
      "X-CSRF-Token": csrfToken,
    },
    { Origin: origin, Cookie: `${cookie}tampered`, "X-CSRF-Token": csrfToken },
  ])
    assert.throws(
      () =>
        assertAccountMutation(
          new Request(`${origin}/api/account/login`, {
            method: "POST",
            headers,
          }),
        ),
      AccountError,
    );
});
test("CSRF endpoint reuses a valid cookie across tabs and emits secure no-store cookies", async () => {
  const first = issued();
  const firstToken = (await first.response.json()).csrfToken;
  const next = accountCsrfResponse(
    new Request(`${origin}/api/account/csrf`, {
      headers: { Cookie: first.cookie },
    }),
  );
  assert.equal((await next.json()).csrfToken, firstToken);
  assert.equal(next.headers.get("Cache-Control"), "no-store");
  const cookie = first.response.headers.getSetCookie()[0];
  assert.match(cookie, /^__Host-chemistry\.account-csrf=/);
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
});
test("account JSON is bounded, object-only and never trusts browser field validation", async () => {
  const { response, cookie } = issued();
  const { csrfToken } = await response.json();
  for (const body of [
    "[]",
    "null",
    "broken",
    JSON.stringify({ text: "x".repeat(17000) }),
  ])
    await assert.rejects(
      () =>
        getAccountMutation(
          new Request(`${origin}/api/account/register`, {
            method: "POST",
            headers: {
              Origin: origin,
              Cookie: cookie,
              "X-CSRF-Token": csrfToken,
              "Content-Type": "application/json",
            },
            body,
          }),
        ),
      AccountError,
    );
});
test("account identity inputs normalize emails and bound passwords without trimming passwords", () => {
  assert.equal(
    normalizeAccountEmail(" Person@Example.COM "),
    "person@example.com",
  );
  assert.equal(validatePassword("  long password  "), "  long password  ");
  assert.equal(validateAccountName("  Test Person  "), "Test Person");
  for (const email of ["a", "a@@example.com", "person\n@example.com"])
    assert.throws(() => normalizeAccountEmail(email), AccountError);
  for (const password of ["short", "x".repeat(129), null])
    assert.throws(() => validatePassword(password), AccountError);
});
test("session lookup reconstructs legacy chunks and rejects incomplete or lookalike cookies", () => {
  assert.equal(
    accountSessionToken(
      new Request(origin, {
        headers: {
          Cookie:
            "__Secure-next-auth.session-token.1=second; __Secure-next-auth.session-token.0=first",
        },
      }),
    ),
    "firstsecond",
  );
  assert.equal(
    accountSessionToken(
      new Request("http://localhost:3000", {
        headers: { Cookie: "next-auth.session-token=legacy" },
      }),
    ),
    "legacy",
  );
  assert.equal(
    accountSessionToken(
      new Request(origin, {
        headers: { Cookie: "__Secure-next-auth.session-token.1=second" },
      }),
    ),
    null,
  );
  assert.equal(
    accountSessionToken(
      new Request(origin, {
        headers: { Cookie: "__Secure-next-auth.session-token.evil=wrong" },
      }),
    ),
    null,
  );
});
