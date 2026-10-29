import test from "node:test";
import assert from "node:assert/strict";
import {
  authConfiguration,
  hasSessionCookie,
  safeCallbackPath,
  resolveDatabaseSession,
  AuthenticationUnavailableError,
} from "../src/lib/auth-config.ts";

const ready = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/study",
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
  NEXTAUTH_SECRET: "test-session-secret",
};

test("authentication requires database sessions and never falls back to JWT", () => {
  assert.equal(authConfiguration(ready).status, "ready");
  assert.equal(
    authConfiguration({ ...ready, DATABASE_URL: "" }).status,
    "unconfigured",
  );
  assert.equal(
    authConfiguration({ ...ready, DATABASE_URL: "postgrese://localhost/study" })
      .status,
    "unconfigured",
  );
});

test("core sessions require a secret and remain available when Google is disabled", () => {
  assert.equal(
    authConfiguration({ ...ready, NEXTAUTH_SECRET: "" }).status,
    "unconfigured",
  );
  assert.equal(
    authConfiguration({ ...ready, DISABLE_GOOGLE_LOGIN: "true" }).status,
    "ready",
  );
  assert.equal(
    authConfiguration({
      DATABASE_URL: ready.DATABASE_URL,
      NEXTAUTH_SECRET: ready.NEXTAUTH_SECRET,
    }).status,
    "ready",
  );
});

test("supported credential aliases are accepted", () => {
  assert.equal(
    authConfiguration({
      DATABASE_URL: ready.DATABASE_URL,
      AUTH_GOOGLE_ID: "id",
      AUTH_GOOGLE_SECRET: "secret",
      AUTH_SECRET: "session",
    }).status,
    "ready",
  );
});

test("session checks recognize secure and chunked database session cookies only", () => {
  assert.equal(
    hasSessionCookie([
      { name: "__Secure-next-auth.session-token.0", value: "opaque" },
    ]),
    true,
  );
  assert.equal(
    hasSessionCookie([{ name: "next-auth.session-token", value: "opaque" }]),
    true,
  );
  assert.equal(
    hasSessionCookie([{ name: "next-auth.csrf-token", value: "opaque" }]),
    false,
  );
  assert.equal(
    hasSessionCookie([{ name: "next-auth.session-token", value: "" }]),
    false,
  );
});

test("login callbacks preserve internal chapter paths and reject external destinations", () => {
  assert.equal(
    safeCallbackPath("/learn/thermodynamics/intro?locale=en"),
    "/learn/thermodynamics/intro?locale=en",
  );
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%5cevil.example",
    "/login",
    "/api/auth/signin",
    "/\nlocation: evil",
  ]) {
    assert.equal(safeCallbackPath(value), "/account");
  }
});

test("normalized callback paths cannot loop back to the sign-in page", () => {
  assert.equal(safeCallbackPath("/learn/../login"), "/account");
  assert.equal(safeCallbackPath("/%2e/login"), "/account");
});

test("sign-in callbacks reject trailing-slash aliases of the login page", () => {
  for (const value of [
    "/login/",
    "/login///",
    "/learn/../login/",
    "/%6cogin/",
    "/login%2F",
    "/login/?callbackUrl=/notes/intro#sign-in",
  ]) {
    assert.equal(safeCallbackPath(value), "/account", value);
  }
});

test("sign-in callbacks preserve other paths beginning with login", () => {
  for (const value of [
    "/login-help",
    "/login-history/",
    "/login-success?next=1",
  ]) {
    assert.equal(safeCallbackPath(value), value);
  }
});

test("normalized callback paths cannot become protocol-relative redirects", () => {
  for (const value of [
    "/foo/..//evil.example",
    "/.//evil.example",
    "/foo/%2e%2e//evil.example",
    "/%2e//evil.example",
    "/foo/..//%65vil.example",
    "/foo/../%2fevil.example",
    "/%2e/%2fevil.example",
    "/%2e%2e/%2Fevil.example",
    "/foo/%2e%2e/%2F%2Fevil.example",
    "/foo/..//evil.example?next=/notes/intro#section",
  ]) {
    const callback = safeCallbackPath(value);
    assert.equal(callback, "/account", value);
    assert.equal(
      new URL(callback, "https://study.example").origin,
      "https://study.example",
    );
  }
});

test("safe normalized internal callbacks preserve query and fragment", () => {
  assert.equal(
    safeCallbackPath(
      "/foo/%2e%2e/notes/thermodynamics/intro?locale=en#entropy",
    ),
    "/notes/thermodynamics/intro?locale=en#entropy",
  );
});

test("an anonymous public visit does not touch the session store", async () => {
  const session = await resolveDatabaseSession({
    hasSession: false,
    configured: false,
    read: async () => {
      throw new Error("must not connect");
    },
  });
  assert.equal(session, null);
});

test("a session cannot authenticate when configuration is unavailable", async () => {
  await assert.rejects(
    resolveDatabaseSession({
      hasSession: true,
      configured: false,
      read: async () => ({
        session: { user: { id: "user-1" } },
        failed: false,
      }),
    }),
    (error) =>
      error instanceof AuthenticationUnavailableError &&
      error.kind === "unconfigured",
  );
});

test("session store failures cannot be mistaken for signed-out visits", async () => {
  await assert.rejects(
    resolveDatabaseSession({
      hasSession: true,
      configured: true,
      read: async () => {
        throw new Error("database password must not escape");
      },
    }),
    (error) =>
      error instanceof AuthenticationUnavailableError &&
      error.kind === "unavailable" &&
      !error.message.includes("password"),
  );
  await assert.rejects(
    resolveDatabaseSession({
      hasSession: true,
      configured: true,
      read: async () => ({ session: null, failed: true }),
    }),
    AuthenticationUnavailableError,
  );
});

test("real sessions and genuinely expired sessions keep distinct results", async () => {
  const authenticated = { user: { id: "user-1" } };
  assert.equal(
    await resolveDatabaseSession({
      hasSession: true,
      configured: true,
      read: async () => ({ session: authenticated, failed: false }),
    }),
    authenticated,
  );
  assert.equal(
    await resolveDatabaseSession({
      hasSession: true,
      configured: true,
      read: async () => ({ session: null, failed: false }),
    }),
    null,
  );
});
