import test from "node:test";
import assert from "node:assert/strict";
import {
  AccountRequestError,
  accountRequest,
  passwordProblem,
  tokenFromFragment,
} from "../src/components/auth/account-client.ts";

test("password confirmation and supported length are checked before submission", () => {
  assert.equal(
    passwordProblem("a".repeat(11), "a".repeat(11)),
    "PASSWORD_LENGTH",
  );
  assert.equal(
    passwordProblem("a".repeat(129), "a".repeat(129)),
    "PASSWORD_LENGTH",
  );
  assert.equal(
    passwordProblem("a secure phrase", "different phrase"),
    "PASSWORD_CONFIRMATION",
  );
  assert.equal(
    passwordProblem(
      "这是一个很长的安全密码示例文本",
      "这是一个很长的安全密码示例文本",
    ),
    null,
  );
});

test("password length counts Unicode characters rather than UTF-16 units", () => {
  assert.equal(
    passwordProblem("🧪".repeat(6), "🧪".repeat(6)),
    "PASSWORD_LENGTH",
  );
  assert.equal(passwordProblem("🧪".repeat(128), "🧪".repeat(128)), null);
});

test("email tokens are read only from the fragment and malformed fragments are harmless", () => {
  assert.equal(tokenFromFragment("#token=abc_DEF-123"), "abc_DEF-123");
  assert.equal(tokenFromFragment("#section"), null);
  assert.equal(tokenFromFragment("#token="), null);
  assert.equal(tokenFromFragment("#token=" + "x".repeat(4097)), null);
});

test("account writes obtain CSRF protection and send credentials without leaking token into URLs", async () => {
  const requests = [];
  const fetcher = async (url, init) => {
    requests.push({ url, init });
    return new Response(
      JSON.stringify(
        url.endsWith("/csrf") ? { csrfToken: "test-csrf" } : { ok: true },
      ),
      { status: 200 },
    );
  };
  await accountRequest("/api/account/verify", {
    method: "POST",
    body: { token: "mail-secret" },
    fetcher,
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "/api/account/csrf");
  assert.equal(requests[1].url, "/api/account/verify");
  assert.equal(requests[1].init.credentials, "same-origin");
  assert.equal(requests[1].init.headers.get("X-CSRF-Token"), "test-csrf");
  assert.equal(JSON.parse(requests[1].init.body).token, "mail-secret");
});

test("service errors never appear as successful submissions", async () => {
  const fetcher = async (url) =>
    new Response(
      JSON.stringify(
        url.endsWith("/csrf")
          ? { csrfToken: "test-csrf" }
          : { ok: false, code: "MAIL_UNAVAILABLE" },
      ),
      { status: url.endsWith("/csrf") ? 200 : 503 },
    );
  await assert.rejects(
    accountRequest("/api/account/register", {
      method: "POST",
      body: {},
      fetcher,
    }),
    (error) =>
      error instanceof AccountRequestError && error.code === "MAIL_UNAVAILABLE",
  );
});

test("avatar uploads leave multipart content type to the browser", async () => {
  let upload;
  const fetcher = async (url, init) => {
    if (url.endsWith("/csrf"))
      return new Response(JSON.stringify({ csrfToken: "test-csrf" }));
    upload = init;
    return new Response(JSON.stringify({ ok: true }));
  };
  const body = new FormData();
  body.append("file", new Blob(["image"], { type: "image/png" }), "avatar.png");
  await accountRequest("/api/account/avatar", {
    method: "POST",
    body,
    fetcher,
  });
  assert.equal(upload.headers.has("Content-Type"), false);
  assert.equal(upload.body, body);
});
