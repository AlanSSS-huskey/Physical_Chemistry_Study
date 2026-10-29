import test from "node:test";
import assert from "node:assert/strict";
import {
  readBackupImportMutation,
  MAX_IMPORT_REQUEST_BYTES,
} from "../src/lib/backup-import-http.ts";
import { accountCsrfResponse } from "../src/lib/account-security.ts";

process.env.NEXTAUTH_SECRET = "backup-import-parser-test-only-secret";
const origin = "https://study.example";
async function request(body, additions = {}) {
  const response = accountCsrfResponse(
    new Request(`${origin}/api/account/csrf`),
  );
  const { csrfToken } = await response.json();
  return new Request(`${origin}/api/account/import/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: response.headers.get("set-cookie").split(";")[0],
      "X-CSRF-Token": csrfToken,
      ...additions,
    },
    body,
    duplex: "half",
  });
}
test("backup JSON accepts a real signed request above the small account-form limit", async () => {
  const input = { backup: { notes: [{ body: "x".repeat(50000) }] } };
  assert.deepEqual(
    await readBackupImportMutation(await request(JSON.stringify(input))),
    input,
  );
});
test("backup mutations reject cross-origin or unsigned requests and malformed object/UTF-8 input", async () => {
  await assert.rejects(
    () =>
      readBackupImportMutation(
        new Request(`${origin}/api/account/import/preview`, {
          method: "POST",
          body: "{}",
          headers: { Origin: origin, "Content-Type": "application/json" },
        }),
      ),
    { code: "CSRF_INVALID" },
  );
  await assert.rejects(
    async () =>
      readBackupImportMutation(
        await request("{}", { Origin: "https://other.example" }),
      ),
    { code: "FORBIDDEN" },
  );
  for (const body of ["null", "[]", "{", new Uint8Array([0xff])])
    await assert.rejects(
      async () => readBackupImportMutation(await request(body)),
      { code: "BACKUP_INVALID" },
    );
  await assert.rejects(
    async () =>
      readBackupImportMutation(
        await request("{}", { "Content-Type": "text/plain" }),
      ),
    { code: "BACKUP_INVALID" },
  );
});
test("backup streaming stops and cancels at two MiB without trusting Content-Length", async () => {
  let pulls = 0;
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      pulls++;
      controller.enqueue(new Uint8Array(512 * 1024));
      if (pulls === 20) controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(() => request(stream).then(readBackupImportMutation), {
    code: "BACKUP_TOO_LARGE",
    status: 413,
  });
  assert.equal(MAX_IMPORT_REQUEST_BYTES, 2 * 1024 * 1024);
  assert.equal(cancelled, true);
  assert.ok(pulls < 20);
});
