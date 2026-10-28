import test from "node:test";
import assert from "node:assert/strict";
import {
  validateImage,
  StorageError,
  getStorageConfig,
  uploadImageObject,
  deleteImageObject,
  uploadAndPersistImage,
  MAX_IMAGE_SIZE,
  MAX_IMAGE_REQUEST_SIZE,
} from "../src/lib/storage.ts";
const png = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
  0, 0, 1,
]);
const config = {
  url: "https://example.supabase.co",
  key: "secret-test",
  bucket: "chemistry-images",
};
test("images require matching binary signatures and nonzero bounded size", () => {
  assert.equal(validateImage(png, "image/png").extension, "png");
  assert.throws(() => validateImage(png, "image/jpeg"), StorageError);
  assert.throws(
    () => validateImage(new Uint8Array(), "image/png"),
    StorageError,
  );
  assert.throws(
    () => validateImage(new Uint8Array(4 * 1024 * 1024 + 1), "image/png"),
    StorageError,
  );
  assert.throws(
    () =>
      validateImage(
        new TextEncoder().encode('<svg onload="x"/>'),
        "image/svg+xml",
      ),
    StorageError,
  );
});
test("image limit accepts exactly 4 MiB and rejects one additional byte", () => {
  assert.equal(MAX_IMAGE_SIZE, 4 * 1024 * 1024);
  assert.equal(MAX_IMAGE_REQUEST_SIZE, MAX_IMAGE_SIZE + 65_536);
  assert.ok(
    MAX_IMAGE_REQUEST_SIZE < 4_500_000,
    "multipart guard stays within the hosting request-body limit",
  );
  const exact = new Uint8Array(4 * 1024 * 1024);
  exact.set(png);
  assert.equal(validateImage(exact, "image/png").extension, "png");
  const oversized = new Uint8Array(exact.length + 1);
  oversized.set(png);
  assert.throws(
    () => validateImage(oversized, "image/png"),
    (error) => error instanceof StorageError && error.status === 413,
  );
});
test("storage requires server credentials and validates configuration", () => {
  assert.throws(() => getStorageConfig({}), StorageError);
  assert.throws(
    () =>
      getStorageConfig({
        SUPABASE_URL: "http://example.com",
        SUPABASE_SECRET_KEY: "s",
      }),
    StorageError,
  );
  const value = getStorageConfig({
    SUPABASE_URL: config.url,
    SUPABASE_SECRET_KEY: "s",
  });
  assert.equal(value.bucket, "chemistry-images");
});
test("object uploads use authenticated durable storage and safe unique paths", async () => {
  let call;
  const object = await uploadImageObject(
    {
      bytes: png,
      mimeType: "image/png",
      filename: "../../hello.png",
      userId: "user1",
    },
    config,
    async (url, init) => {
      call = { url, init };
      return new Response("{}", { status: 200 });
    },
  );
  assert.match(object.path, /^user1\/[a-f0-9-]+-hello\.png$/);
  assert.match(call.url, /\/storage\/v1\/object\/chemistry-images\/user1\//);
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.headers.Authorization, "Bearer secret-test");
  assert.equal(call.init.headers["x-upsert"], "false");
  assert.ok(!object.url.includes("secret-test"));
});
test("storage rejection returns scrubbed actionable errors", async () => {
  await assert.rejects(
    () =>
      uploadImageObject(
        { bytes: png, mimeType: "image/png", filename: "a.png", userId: "u" },
        config,
        async () => new Response("secret remote details", { status: 500 }),
      ),
    (error) =>
      error instanceof StorageError && !error.message.includes("secret remote"),
  );
});
test("database failure compensates by deleting newly uploaded object", async () => {
  const calls = [];
  await assert.rejects(() =>
    uploadAndPersistImage(
      { bytes: png, mimeType: "image/png", filename: "a.png", userId: "u" },
      async () => {
        throw new Error("db unavailable");
      },
      config,
      async (url, init) => {
        calls.push({ url, init });
        return new Response("{}", { status: 200 });
      },
    ),
  );
  assert.deepEqual(
    calls.map((x) => x.init.method),
    ["POST", "DELETE"],
  );
  assert.match(calls[1].init.body, /prefixes/);
});
test("deletion rejects paths outside the configured bucket", async () => {
  await assert.rejects(
    () =>
      deleteImageObject("../escape", config, async () => {
        throw new Error("must not fetch");
      }),
    StorageError,
  );
});

test("multipart image reads enforce a streaming limit without content-length", async () => {
  const { readImageFormData } = await import("../src/lib/storage.ts");
  const request = new Request("https://study.example/api/upload-image", {
    method: "POST",
    body: new Uint8Array(4 * 1024 * 1024 + 65_537),
    headers: { "content-type": "multipart/form-data; boundary=x" },
  });
  await assert.rejects(
    () => readImageFormData(request),
    (error) => error instanceof StorageError && error.status === 413,
  );
  const form = new FormData();
  form.set("file", new File([png], "a.png", { type: "image/png" }));
  const parsed = await readImageFormData(
    new Request("https://study.example/api/upload-image", {
      method: "POST",
      body: form,
    }),
  );
  assert.equal(parsed.get("file").size, png.length);
});
test("a 4 MiB image fits the multipart envelope while an oversized envelope is rejected", async () => {
  const { readImageFormData } = await import("../src/lib/storage.ts");
  const exact = new Uint8Array(4 * 1024 * 1024);
  exact.set(png);
  const form = new FormData();
  form.set("file", new File([exact], "a.png", { type: "image/png" }));
  const parsed = await readImageFormData(
    new Request("https://study.example/api/upload-image", {
      method: "POST",
      body: form,
    }),
  );
  assert.equal(parsed.get("file").size, exact.length);
  const boundary = "upload-limit-boundary";
  const prefix = new TextEncoder().encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`,
  );
  const suffix = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);
  const envelope = new Uint8Array(4 * 1024 * 1024 + 65_536);
  envelope.set(prefix);
  envelope.set(suffix, envelope.length - suffix.length);
  const headers = {
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
  };
  const atCap = await readImageFormData(
    new Request("https://study.example/api/upload-image", {
      method: "POST",
      body: envelope,
      headers,
    }),
  );
  assert.equal(
    atCap.get("file").size,
    envelope.length - prefix.length - suffix.length,
  );
  const tooLarge = new Uint8Array(envelope.length + 1);
  tooLarge.set(envelope);
  await assert.rejects(
    () =>
      readImageFormData(
        new Request("https://study.example/api/upload-image", {
          method: "POST",
          body: tooLarge,
          headers,
        }),
      ),
    (error) => error instanceof StorageError && error.status === 413,
  );
});
test("successful persistence uses a stable app URL rather than requiring a public bucket", async () => {
  const saved = await uploadAndPersistImage(
    { bytes: png, mimeType: "image/png", filename: "a.png", userId: "u" },
    async (metadata) => metadata,
    config,
    async () => new Response("{}", { status: 200 }),
  );
  assert.equal(saved.url, `/api/images/${saved.id}`);
  assert.ok(saved.storagePath.startsWith("u/"));
  assert.equal(saved.mimeType, "image/png");
});
