import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as validation from "../src/lib/content-validation.ts";
import * as security from "../src/lib/account-security.ts";
import * as history from "../src/lib/content-history.ts";

process.env.NEXTAUTH_SECRET = "admin-history-http-signed-test-secret";
const source = readFileSync(
  new URL("../src/lib/content-history-http.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText;
function helpers(admin = { id: "admin" }) {
  const deps = {
    "@/lib/admin-access": {
      async getAdminUserOrNull() {
        return admin;
      },
    },
    "@/lib/account-security": security,
    "@/lib/content-validation": validation,
    "@/lib/content-history": history,
  };
  const helperModule = { exports: {} };
  runInNewContext(compiled, {
    Response,
    module: helperModule,
    exports: helperModule.exports,
    require: (name) => deps[name],
  });
  return helperModule.exports;
}
async function signedRequest(body) {
  const csrf = security.accountCsrfResponse(
    new Request("https://study.example/api/account/csrf"),
  );
  const token = (await csrf.json()).csrfToken;
  return new Request("https://study.example/api/admin/content", {
    method: "POST",
    headers: {
      origin: "https://study.example",
      "content-type": "application/json",
      cookie: csrf.headers.get("set-cookie").split(";")[0],
      "x-csrf-token": token,
    },
    body,
  });
}
test("the signed admin body limit accepts full-length bilingual UTF-8 content", async () => {
  const body = "中".repeat(300_000);
  const payload = {
    body,
    translations: {
      zh: { title: "中文", body },
      en: { title: "English", body },
    },
  };
  const request = await signedRequest(JSON.stringify(payload));
  assert.ok(
    Number(new TextEncoder().encode(JSON.stringify(payload)).length) >
      2_000_000,
  );
  const parsed = await helpers().contentMutationBody(request);
  assert.equal(parsed.translations.zh.body.length, 300_000);
  assert.equal(parsed.translations.en.body.length, 300_000);
});
test("admin JSON remains bounded at 6 MB and rejects cross-origin writes before parsing", async () => {
  await assert.rejects(
    helpers().contentMutationBody(
      await signedRequest(JSON.stringify({ body: "a".repeat(6_000_000) })),
    ),
    /too large/,
  );
  const foreign = new Request("https://study.example/api/admin/content", {
    method: "POST",
    headers: {
      origin: "https://attacker.example",
      "content-type": "application/json",
    },
    body: "{}",
  });
  await assert.rejects(
    helpers().contentMutationBody(foreign),
    (error) => error.code === "FORBIDDEN",
  );
});
test("administrative reads refuse users without an admin identity", async () => {
  await assert.rejects(
    helpers(null).adminContentActor(),
    (error) => error.code === "FORBIDDEN",
  );
  assert.equal(
    helpers().historyFailure(new Error("database credential should not leak"))
      .status,
    503,
  );
});

test("serializable write conflicts are recoverable without exposing database details", async () => {
  const response = helpers().historyFailure(
    Object.assign(new Error("private transaction details"), { code: "P2034" }),
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: "VERSION_CONFLICT",
  });
});

test("a stale admin tab cannot read or autosave into another administrator's drafts", async () => {
  const request = new Request(
    "https://study.example/api/admin/content/drafts/new",
    { headers: { "X-Admin-User": "admin-a" } },
  );
  await assert.rejects(
    helpers({ id: "admin-b" }).adminContentActor(request),
    (error) => error.code === "SESSION_CHANGED",
  );
  const matched = await helpers({ id: "admin-a" }).adminContentActor(request);
  assert.equal(matched.id, "admin-a");
});
