import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as validation from "../src/lib/content-validation.ts";

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

function routeWithContent(existing, bundled) {
  const writes = [];
  const dependencies = {
    "@prisma/client": { Prisma: { DbNull: null } },
    "next/cache": { revalidatePath() {} },
    "@/lib/db": {
      prisma: {
        content: {
          async findUnique() {
            return existing;
          },
          async update(input) {
            writes.push(input);
            return { id: existing.id, slug: input.data.slug };
          },
        },
      },
    },
    "@/lib/admin-access": {
      async getAdminUserOrNull() {
        return { id: "admin" };
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
  return { put: routeModule.exports.PUT, writes };
}

const bundledNote = {
  id: "note-1",
  slug: "thermodynamics/intro",
  title: "Thermodynamics",
  body: "Notes",
  isPublished: false,
};

function updateRequest(payload) {
  return new Request("https://study.example/api/admin/content/note-1", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: "https://study.example",
    },
    body: JSON.stringify(payload),
  });
}

const context = { params: Promise.resolve({ id: "note-1" }) };

test("renaming a bundled override is rejected before its stored identity can be removed", async () => {
  const { put, writes } = routeWithContent(
    bundledNote,
    new Set([bundledNote.slug]),
  );
  const response = await put(updateRequest({ slug: "revised-intro" }), context);
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
    updateRequest({ title: "Updated title", isPublished: false }),
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
    updateRequest({ slug: " THERMODYNAMICS/INTRO " }),
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
    updateRequest({ slug: "my-revised-note" }),
    context,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).slug, "my-revised-note");
  assert.equal(writes[0].data.slug, "my-revised-note");
});
