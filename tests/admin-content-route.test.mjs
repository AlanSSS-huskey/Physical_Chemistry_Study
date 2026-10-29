import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as validation from "../src/lib/content-validation.ts";
import * as history from "../src/lib/content-history.ts";
import {
  AccountError,
  assertAccountMutation,
  accountCsrfResponse,
} from "../src/lib/account-security.ts";

process.env.NEXTAUTH_SECRET = "test-content-history-csrf-secret-32-bytes";

const routeSource = readFileSync(
  new URL("../src/app/api/admin/content/[id]/route.ts", import.meta.url),
  "utf8",
);
const compiledRoute = ts.transpileModule(routeSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText;

function routeWithContent(existing, bundled, isAdmin = true) {
  const writes = [];
  let row = { ...existing };
  const tx = {
    content: {
      async findUnique() {
        return row;
      },
      async findUniqueOrThrow() {
        return row;
      },
      async updateMany(input) {
        if (row.version !== input.where.version) return { count: 0 };
        writes.push(input);
        row = {
          ...row,
          ...input.data,
          translations:
            input.data.translations?.constructor?.name === "DbNull"
              ? null
              : input.data.translations,
        };
        return { count: 1 };
      },
    },
    contentRevision: { async upsert() {}, async create() {} },
  };
  const dependencies = {
    "@prisma/client": { Prisma: { DbNull: null } },
    "next/cache": { revalidatePath() {} },
    "@/lib/db": {
      prisma: {
        content: tx.content,
        async $transaction(operation) {
          return operation(tx);
        },
      },
    },
    "@/lib/content-history": history,
    "@/lib/content-history-http": {
      async adminContentActor() {
        if (!isAdmin) throw new history.ContentHistoryError("FORBIDDEN", 403);
        return { id: "admin", isAdmin: true };
      },
      async contentMutationBody(request) {
        assertAccountMutation(request);
        return validation.parseContentJson(request);
      },
      historyResponse(data, status = 200) {
        return Response.json(data, { status });
      },
      historyFailure(error) {
        if (
          error instanceof history.ContentHistoryError ||
          error instanceof AccountError
        )
          return Response.json({ code: error.code }, { status: error.status });
        return validation.contentApiFailure(error);
      },
    },
    "@/lib/content-service": {
      async isBundledContent(slug) {
        return bundled.has(slug);
      },
    },
    "@/lib/content-validation": validation,
  };
  const routeModule = { exports: {} };
  runInNewContext(compiledRoute, {
    exports: routeModule.exports,
    module: routeModule,
    Response,
    require(name) {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return {
    put: routeModule.exports.PUT,
    remove: routeModule.exports.DELETE,
    writes,
  };
}

const bundledNote = {
  id: "note-1",
  slug: "thermodynamics/intro",
  title: "Thermodynamics",
  body: "Notes",
  isPublished: false,
  translations: null,
  version: 1,
  deletedAt: null,
};

async function updateRequest(payload, csrf = true) {
  const csrfResponse = accountCsrfResponse(
    new Request("https://study.example/api/account/csrf"),
  );
  const token = (await csrfResponse.json()).csrfToken;
  return new Request("https://study.example/api/admin/content/note-1", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: "https://study.example",
      ...(csrf
        ? {
            cookie: csrfResponse.headers.get("set-cookie").split(";")[0],
            "x-csrf-token": token,
          }
        : {}),
    },
    body: JSON.stringify({ expectedVersion: 1, ...payload }),
  });
}

const context = { params: Promise.resolve({ id: "note-1" }) };

test("renaming a bundled override is rejected before its stored identity can be removed", async () => {
  const { put, writes } = routeWithContent(
    bundledNote,
    new Set([bundledNote.slug]),
  );
  const response = await put(
    await updateRequest({ slug: "revised-intro" }),
    context,
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "BUNDLED_SLUG");
  assert.equal(writes.length, 0);
});

test("bundled lessons can still save edits and publication state at their original slug", async () => {
  const { put, writes } = routeWithContent(
    bundledNote,
    new Set([bundledNote.slug]),
  );
  const response = await put(
    await updateRequest({ title: "Updated title", isPublished: false }),
    context,
  );
  assert.equal(response.status, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.slug, bundledNote.slug);
  assert.equal(writes[0].data.isPublished, false);
});

test("normalizing the same bundled slug does not block a save", async () => {
  const { put, writes } = routeWithContent(
    bundledNote,
    new Set([bundledNote.slug]),
  );
  const response = await put(
    await updateRequest({ slug: " THERMODYNAMICS/INTRO " }),
    context,
  );
  assert.equal(response.status, 200);
  assert.equal(writes[0].data.slug, bundledNote.slug);
});

test("standalone notes retain the ability to change their slug", async () => {
  const standalone = { ...bundledNote, slug: "my-original-note" };
  const { put, writes } = routeWithContent(
    standalone,
    new Set([bundledNote.slug]),
  );
  const response = await put(
    await updateRequest({ slug: "my-revised-note" }),
    context,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).slug, "my-revised-note");
  assert.equal(writes[0].data.slug, "my-revised-note");
});

test("history-backed writes require admin authorization and a signed CSRF token", async () => {
  const denied = routeWithContent(bundledNote, new Set(), false);
  const forbidden = await denied.put(
    await updateRequest({ title: "Changed" }),
    context,
  );
  assert.equal(forbidden.status, 403);
  assert.equal(denied.writes.length, 0);
  const csrf = routeWithContent(bundledNote, new Set(), true);
  const response = await csrf.put(
    await updateRequest({ title: "Changed" }, false),
    context,
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "CSRF_INVALID");
  assert.equal(csrf.writes.length, 0);
});

test("a stale trash request cannot remove a newer article version", async () => {
  const { remove, writes } = routeWithContent(
    { ...bundledNote, version: 2 },
    new Set(),
  );
  const response = await remove(await updateRequest({}), context);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "VERSION_CONFLICT");
  assert.equal(writes.length, 0);
});
