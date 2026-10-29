import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  REMEMBERED_SESSION_SECONDS,
  BROWSER_SESSION_SECONDS,
  createSessionToken,
  sessionPersistence,
  signLoginPreference,
  readLoginPreference,
  loginPreferenceCookie,
  withLoginPreferenceCookie,
  readRequestedRemember,
  googleOAuthState,
  createSessionPolicyAdapter,
  applySessionCookiePolicy,
} from "../src/lib/session-policy.ts";

const now = Date.parse("2026-10-28T12:00:00Z");
const secret = "a-test-only-secret-for-session-policy";
const oauthState = "test-oauth-state-random-value";

test("preference cleanup works on immutable redirect responses", () => {
  const response = withLoginPreferenceCookie(
    Response.redirect("https://study.example/login?error=unavailable", 303),
    "",
    true,
  );
  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("Location"),
    "https://study.example/login?error=unavailable",
  );
  assert.match(response.headers.getSetCookie()[0], /Max-Age=0/);
});

test("new session policy is scoped to a random opaque token", () => {
  const remembered = createSessionToken(true);
  const browser = createSessionToken(false);
  assert.match(remembered, /^r\.[A-Za-z0-9_-]{43}$/);
  assert.match(browser, /^s\.[A-Za-z0-9_-]{43}$/);
  assert.notEqual(createSessionToken(true), remembered);
  assert.equal(sessionPersistence(remembered), "persistent");
  assert.equal(sessionPersistence(browser), "browser");
  assert.equal(
    sessionPersistence("existing-legacy-session-token"),
    "persistent",
  );
});

test("login preference is signed and bound to the OAuth state", () => {
  const cookie = signLoginPreference(true, oauthState, secret, now);
  assert.equal(readLoginPreference(cookie, oauthState, secret, now), true);
  assert.equal(
    readLoginPreference(cookie, "another-login", secret, now),
    false,
  );
  assert.equal(
    readLoginPreference(cookie, oauthState, "wrong-key", now),
    false,
  );
  assert.equal(
    readLoginPreference(`${cookie}tampered`, oauthState, secret, now),
    false,
  );
  assert.equal(
    readLoginPreference(cookie.replace(".r.", ".s."), oauthState, secret, now),
    false,
  );
  assert.equal(readLoginPreference(undefined, oauthState, secret, now), false);
  assert.equal(readLoginPreference(cookie, oauthState, "", now), false);
});

test("login preference expires after fifteen minutes and unchecked remains false", () => {
  const cookie = signLoginPreference(true, oauthState, secret, now);
  assert.equal(
    readLoginPreference(cookie, oauthState, secret, now + 899_000),
    true,
  );
  assert.equal(
    readLoginPreference(cookie, oauthState, secret, now + 900_000),
    false,
  );
  assert.equal(
    readLoginPreference(
      signLoginPreference(false, oauthState, secret, now),
      oauthState,
      secret,
      now,
    ),
    false,
  );
});

test("preference cookies remain HttpOnly, SameSite Lax and secure in production", () => {
  const secure = loginPreferenceCookie("signed-value", true);
  assert.match(secure, /^__Host-chemistry\.login-preference=signed-value;/);
  assert.match(secure, /; HttpOnly/);
  assert.match(secure, /; Secure/);
  assert.match(secure, /; SameSite=Lax/);
  assert.match(secure, /; Path=\//);
  assert.match(secure, /; Max-Age=900/);
  const local = loginPreferenceCookie("signed-value", false);
  assert.match(local, /^chemistry\.login-preference=/);
  assert.doesNotMatch(local, /; Secure/);
  assert.match(loginPreferenceCookie("", true), /; Max-Age=0/);
});

test("remember choice accepts only the exact true sign-in form value", async () => {
  for (const value of [undefined, "false", "1", "TRUE"]) {
    const body = new URLSearchParams(
      value === undefined ? {} : { remember: value },
    );
    assert.equal(
      await readRequestedRemember(
        new Request("http://localhost/api/auth/signin/google", {
          method: "POST",
          body,
        }),
      ),
      false,
    );
  }
  const request = new Request("http://localhost/api/auth/signin/google", {
    method: "POST",
    body: new URLSearchParams({ remember: "true", csrfToken: "test" }),
  });
  assert.equal(await readRequestedRemember(request), true);
  assert.equal(
    (await request.formData()).get("csrfToken"),
    "test",
    "NextAuth still receives the original body",
  );
});

test("oversized remember forms stop reading their cloned stream before buffering the whole body", async () => {
  let pulls = 0;
  const chunk = new TextEncoder().encode("x".repeat(8192));
  const source = new ReadableStream({
    pull(controller) {
      pulls++;
      if (pulls === 64) controller.close();
      else controller.enqueue(chunk);
    },
  });
  const request = new Request("http://localhost/api/auth/signin/google", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: source,
    duplex: "half",
  });
  assert.equal(await readRequestedRemember(request), false);
  assert.ok(pulls < 10, `should stop at 16KiB; pulled ${pulls} chunks`);
  assert.equal(
    (await request.arrayBuffer()).byteLength,
    63 * chunk.length,
    "the original body remains available to NextAuth",
  );
});

test("OAuth state extraction supports NextAuth JSON and redirects but excludes error redirects", async () => {
  const url = `https://accounts.google.com/o/oauth2/v2/auth?state=${oauthState}`;
  assert.equal(await googleOAuthState(Response.json({ url })), oauthState);
  assert.equal(await googleOAuthState(Response.redirect(url)), oauthState);
  assert.equal(
    await googleOAuthState(
      Response.json({ url: "http://localhost:3000/login?csrf=true" }),
    ),
    null,
  );
  assert.equal(
    await googleOAuthState(
      Response.json({ url: "https://evil.example/?state=bad" }),
    ),
    null,
  );
  assert.equal(
    await googleOAuthState(
      Response.json({
        url: "https://accounts.google.com.evil.example/?state=bad",
      }),
    ),
    null,
  );
});

function sessionStore() {
  const rows = new Map();
  const deleted = [];
  const user = {
    id: "test-user",
    email: "test@example.invalid",
    emailVerified: null,
  };
  const adapter = {
    async createSession(row) {
      rows.set(row.sessionToken, { ...row });
      return { ...row };
    },
    async getSessionAndUser(token) {
      const session = rows.get(token);
      return session ? { session: { ...session }, user } : null;
    },
    async updateSession(data) {
      const row = rows.get(data.sessionToken);
      if (!row) return null;
      Object.assign(row, data);
      return { ...row };
    },
    async deleteSession(token) {
      deleted.push(token);
      const old = rows.get(token);
      rows.delete(token);
      return old;
    },
  };
  return { rows, deleted, adapter };
}

test("remembered and browser sessions have fixed thirty-day and twelve-hour database limits", async () => {
  assert.equal(REMEMBERED_SESSION_SECONDS, 30 * 86400);
  assert.equal(BROWSER_SESSION_SECONDS, 12 * 3600);
  for (const remember of [true, false]) {
    const store = sessionStore();
    let observed;
    const adapter = createSessionPolicyAdapter(store.adapter, {
      now: () => now,
      observe: (row) => {
        observed = row;
      },
    });
    const sessionToken = createSessionToken(remember);
    const session = await adapter.createSession({
      sessionToken,
      userId: "test-user",
      expires: new Date(now + 99 * 86400_000),
    });
    assert.equal(
      session.expires.getTime(),
      now + (remember ? 30 * 86400_000 : 12 * 3600_000),
    );
    assert.equal(observed.sessionToken, sessionToken);
    await adapter.updateSession({
      sessionToken,
      expires: new Date(now + 100 * 86400_000),
    });
    assert.equal(
      store.rows.get(sessionToken).expires.getTime(),
      session.expires.getTime(),
      "rolling refresh cannot extend the stored expiry",
    );
  }
});

test("Google-style adapter session creation records a bounded clean user agent and activity timestamps", async () => {
  const store = sessionStore();
  const adapter = createSessionPolicyAdapter(store.adapter, {
    now: () => now,
    userAgent: `Browser\r\n${"x".repeat(600)}`,
  });
  const session = await adapter.createSession({
    sessionToken: createSessionToken(true),
    userId: "test-user",
    expires: new Date(now + 1),
  });
  assert.equal(session.createdAt.getTime(), now);
  assert.equal(session.lastActiveAt.getTime(), now);
  assert.equal(session.userAgent.length, 512);
  assert.doesNotMatch(session.userAgent, /[\r\n]/);
});

test("ordinary valid session reads touch activity at most every minute without changing expiry", async () => {
  let clock = now;
  const store = sessionStore();
  const touches = [];
  const adapter = createSessionPolicyAdapter(store.adapter, {
    now: () => clock,
    async touchSession(token, at) {
      touches.push(at);
      store.rows.get(token).lastActiveAt = at;
    },
  });
  const created = await adapter.createSession({
    sessionToken: createSessionToken(false),
    userId: "test-user",
    expires: new Date(now + 1),
  });
  await adapter.getSessionAndUser(created.sessionToken);
  clock += 59000;
  await adapter.getSessionAndUser(created.sessionToken);
  assert.equal(touches.length, 0);
  clock += 1000;
  await adapter.getSessionAndUser(created.sessionToken);
  assert.equal(touches.length, 1);
  clock += 59000;
  await adapter.getSessionAndUser(created.sessionToken);
  assert.equal(touches.length, 1);
  clock += 1000;
  await adapter.getSessionAndUser(created.sessionToken);
  assert.equal(touches.length, 2);
  assert.equal(
    store.rows.get(created.sessionToken).expires.getTime(),
    created.expires.getTime(),
  );
});

test("legacy sessions missing activity metadata are touched but expired sessions are never touched", async () => {
  const store = sessionStore();
  const touches = [];
  const adapter = createSessionPolicyAdapter(store.adapter, {
    now: () => now,
    userAgent: "Existing Browser",
    async touchSession(token, at, userAgent) {
      touches.push(token);
      Object.assign(store.rows.get(token), { lastActiveAt: at, userAgent });
    },
  });
  await store.adapter.createSession({
    sessionToken: "legacy-session",
    userId: "test-user",
    expires: new Date(now + 1000000),
  });
  await adapter.getSessionAndUser("legacy-session");
  assert.deepEqual(touches, ["legacy-session"]);
  assert.equal(store.rows.get("legacy-session").userAgent, "Existing Browser");
  await store.adapter.createSession({
    sessionToken: "expired-session",
    userId: "test-user",
    expires: new Date(now),
  });
  assert.equal(await adapter.getSessionAndUser("expired-session"), null);
  assert.deepEqual(touches, ["legacy-session"]);
});

test("later sign-in choices cannot change an existing session and legacy expiry is preserved", async () => {
  const store = sessionStore();
  const expires = new Date(now + 5 * 86400_000);
  await store.adapter.createSession({
    sessionToken: "legacy-token",
    userId: "test-user",
    expires,
  });
  const adapter = createSessionPolicyAdapter(store.adapter, { now: () => now });
  await adapter.updateSession({
    sessionToken: "legacy-token",
    expires: new Date(now + 30 * 86400_000),
  });
  assert.equal(
    (await adapter.getSessionAndUser("legacy-token")).session.expires.getTime(),
    expires.getTime(),
  );
});

test("expired and logged-out database sessions cannot authenticate", async () => {
  const store = sessionStore();
  await store.adapter.createSession({
    sessionToken: "expired",
    userId: "test-user",
    expires: new Date(now),
  });
  const adapter = createSessionPolicyAdapter(store.adapter, { now: () => now });
  assert.equal(await adapter.getSessionAndUser("expired"), null);
  assert.deepEqual(store.deleted, ["expired"]);
  const token = createSessionToken(true);
  await adapter.createSession({
    sessionToken: token,
    userId: "test-user",
    expires: new Date(now + 1),
  });
  await adapter.deleteSession(token);
  assert.equal(await adapter.getSessionAndUser(token), null);
});

test("concurrent expiry and repeated logout tolerate an already deleted session only", async () => {
  const store = sessionStore();
  const adapter = createSessionPolicyAdapter({
    ...store.adapter,
    async deleteSession() {
      throw Object.assign(new Error("already removed"), { code: "P2025" });
    },
  });
  assert.equal(await adapter.deleteSession("already-removed-token"), null);
  const unavailable = createSessionPolicyAdapter({
    ...store.adapter,
    async deleteSession() {
      throw Object.assign(new Error("database unavailable"), { code: "P1001" });
    },
  });
  await assert.rejects(unavailable.deleteSession("test-token"), {
    code: "P1001",
  });
});

test("session-only cookies never gain persistence during callback or GET session refresh", () => {
  for (const name of [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
  ]) {
    const token = createSessionToken(false);
    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      `${name}=${token}; Path=/; Expires=Fri, 27 Nov 2026 12:00:00 GMT; Max-Age=2592000; HttpOnly; SameSite=Lax${name.startsWith("__Secure-") ? "; Secure" : ""}`,
    );
    headers.append("Set-Cookie", "next-auth.csrf-token=csrf; Path=/; HttpOnly");
    const response = applySessionCookiePolicy(new Response("{}", { headers }), {
      sessionToken: token,
      expires: new Date(now + 12 * 3600_000),
    });
    const cookies = response.headers.getSetCookie();
    assert.doesNotMatch(cookies[0], /Expires=|Max-Age=/i);
    assert.match(cookies[0], /HttpOnly; SameSite=Lax/);
    assert.equal(cookies[1], "next-auth.csrf-token=csrf; Path=/; HttpOnly");
  }
});

test("persistent cookie expiry matches the database and deletion cookies remain deletions", () => {
  for (const token of [createSessionToken(true), "legacy-token"]) {
    const response = new Response("{}", {
      headers: {
        "Set-Cookie": `__Secure-next-auth.session-token=${token}; Expires=Fri, 27 Nov 2026 12:00:00 GMT; HttpOnly; Secure; SameSite=Lax`,
      },
    });
    const rewritten = applySessionCookiePolicy(response, {
      sessionToken: token,
      expires: new Date(now + 86400_000),
    });
    assert.match(
      rewritten.headers.getSetCookie()[0],
      /Expires=Thu, 29 Oct 2026 12:00:00 GMT/,
    );
  }
  const deletion =
    "__Secure-next-auth.session-token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax";
  assert.equal(
    applySessionCookiePolicy(
      new Response(null, { headers: { "Set-Cookie": deletion } }),
      undefined,
    ).headers.getSetCookie()[0],
    deletion,
  );
});

test("installed NextAuth session JSON and cookies retain fixed database expiry for browser, remembered and legacy sessions", async () => {
  const require = createRequire(import.meta.url);
  const nextAuthSession =
    require("../node_modules/next-auth/core/routes/session.js").default;
  const { toResponse } = require("../node_modules/next-auth/next/utils.js");
  const timestamp = Date.now();
  for (const [sessionToken, createdAgo] of [
    [createSessionToken(false), 6 * 3600_000],
    [createSessionToken(true), 5 * 86400_000],
    ["existing-legacy-token", 0],
  ]) {
    let clock = timestamp - createdAgo;
    const store = sessionStore();
    let observed;
    const adapter = createSessionPolicyAdapter(store.adapter, {
      now: () => clock,
      observe: (session) => {
        observed = session;
      },
    });
    const original = await adapter.createSession({
      sessionToken,
      userId: "test-user",
      expires: new Date(timestamp + 2 * 86400_000),
    });
    clock = timestamp;
    for (let i = 0; i < 3; i++) {
      const internal = await nextAuthSession({
        options: {
          adapter,
          session: { strategy: "database", maxAge: 30 * 86400, updateAge: 0 },
          callbacks: { session: ({ session }) => session },
          cookies: {
            sessionToken: {
              name: "__Secure-next-auth.session-token",
              options: {
                secure: true,
                httpOnly: true,
                sameSite: "lax",
                path: "/",
              },
            },
          },
          logger: {
            error: (...args) =>
              assert.fail(`NextAuth session failed: ${args[0]}`),
          },
          events: {},
        },
        sessionStore: { value: sessionToken, clean: () => [] },
      });
      assert.equal(internal.body.user.email, "test@example.invalid");
      assert.equal(
        internal.body.expires,
        original.expires.toISOString(),
        "JSON reports the database expiry, never now plus the global maximum",
      );
      assert.equal(
        store.rows.get(sessionToken).expires.getTime(),
        original.expires.getTime(),
      );
      const response = applySessionCookiePolicy(toResponse(internal), observed);
      if (sessionPersistence(sessionToken) === "browser")
        assert.doesNotMatch(
          response.headers.getSetCookie()[0],
          /Expires=|Max-Age=/i,
        );
      else
        assert.ok(
          response.headers
            .getSetCookie()[0]
            .includes(`Expires=${original.expires.toUTCString()}`),
        );
    }
  }
});
