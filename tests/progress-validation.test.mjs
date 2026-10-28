import test from "node:test";
import assert from "node:assert/strict";
import {
  validateProgressInput,
  updateAuthorizedProgress,
  progressApiResponse,
} from "../src/lib/progress-validation.ts";

test("progress uses one canonical slug for either reading language", () => {
  assert.deepEqual(validateProgressInput(" Thermodynamics/Intro ", true), {
    contentSlug: "thermodynamics/intro",
    status: "COMPLETED",
  });
});

test("malformed paths and nonboolean completion targets are rejected", () => {
  for (const slug of ["../intro", "thermo/%2e%2e", "", null]) {
    assert.equal(validateProgressInput(slug, true), null);
  }
  for (const target of ["true", "false", 1, null, undefined]) {
    assert.equal(validateProgressInput("thermo/intro", target), null);
  }
});

test("anonymous submissions never load content or save progress", async () => {
  const result = await updateAuthorizedProgress("thermo/intro", true, null, {
    resolveAccess: async () => {
      throw new Error("must not read");
    },
    save: async () => {
      throw new Error("must not write");
    },
  });
  assert.deepEqual(result, { ok: false, error: "unauthenticated" });
});

test("preview, unpublished and nonexistent chapters cannot receive progress", async () => {
  for (const access of ["preview", "denied"]) {
    let saved = false;
    const result = await updateAuthorizedProgress(
      "thermo/intro",
      true,
      "user-1",
      {
        resolveAccess: async () => access,
        save: async () => {
          saved = true;
        },
      },
    );
    assert.deepEqual(result, { ok: false, error: "forbidden" });
    assert.equal(saved, false);
  }
});

test("repeated submissions retain the requested target instead of toggling", async () => {
  const rows = new Map();
  const store = {
    resolveAccess: async () => "full",
    save: async (userId, slug, status) => {
      rows.set(`${userId}/${slug}`, status);
    },
  };
  await updateAuthorizedProgress("thermo/intro", true, "user-1", store);
  await updateAuthorizedProgress("thermo/intro", true, "user-1", store);
  assert.equal(rows.get("user-1/thermo/intro"), "COMPLETED");
  await updateAuthorizedProgress("thermo/intro", false, "user-1", store);
  await updateAuthorizedProgress("thermo/intro", false, "user-1", store);
  assert.equal(rows.get("user-1/thermo/intro"), "IN_PROGRESS");
  assert.equal(rows.size, 1);
});

test("database failures remain failures and do not report successful progress", async () => {
  await assert.rejects(
    updateAuthorizedProgress("thermo/intro", true, "user-1", {
      resolveAccess: async () => "full",
      save: async () => {
        throw new Error("database unavailable");
      },
    }),
    /database unavailable/,
  );
});

test("notes with one or several slug segments share the chapter progress policy", () => {
  assert.deepEqual(validateProgressInput("revision", true), {
    contentSlug: "revision",
    status: "COMPLETED",
  });
  assert.deepEqual(validateProgressInput("thermo/revision/intro", false), {
    contentSlug: "thermo/revision/intro",
    status: "IN_PROGRESS",
  });
});

test("an unavailable authoritative content lookup cannot authorize a recovered write", async () => {
  let saved = false;
  const result = await updateAuthorizedProgress(
    "thermo/intro",
    true,
    "user-1",
    {
      resolveAccess: async () => "unavailable",
      save: async () => {
        saved = true;
      },
    },
  );
  assert.deepEqual(result, { ok: false, error: "unavailable" });
  assert.equal(saved, false);
});

test("progress API maps validation, authentication, authorization and outages distinctly", async () => {
  for (const [error, status, code] of [
    ["invalid", 400, "VALIDATION_ERROR"],
    ["unauthenticated", 401, "UNAUTHENTICATED"],
    ["forbidden", 403, "FORBIDDEN"],
    ["unavailable", 503, "UNAVAILABLE"],
    ["unconfigured", 503, "AUTH_NOT_CONFIGURED"],
  ]) {
    const response = progressApiResponse({ ok: false, error });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.code, code);
    assert.equal(typeof body.error, "string");
    assert.equal(Object.hasOwn(body, "ok"), false);
  }
});

test("progress API acknowledges only successful saved states", async () => {
  for (const status of ["COMPLETED", "IN_PROGRESS"]) {
    const response = progressApiResponse({ ok: true, status });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});
