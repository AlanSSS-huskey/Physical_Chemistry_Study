/**
 * HTTP integration checks against task-owned, isolated PostgreSQL fixtures.
 * Requires a separately started local server and an explicit TEST_DATABASE_URL
 * whose schema starts with chemistry_refactor_verification_. Never falls back to
 * DATABASE_URL. The caller creates/migrates and drops the temporary schema.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const rawUrl = process.env.TEST_DATABASE_URL;
if (!rawUrl)
  throw new Error(
    "TEST_DATABASE_URL is required; ordinary DATABASE_URL is never used",
  );
const url = new URL(rawUrl);
const schema = url.searchParams.get("schema") || "";
if (
  !/^chemistry_refactor_verification_[a-z0-9_]+$/.test(schema) ||
  url.pathname !== "/postgrese"
) {
  throw new Error(
    "Refusing integration fixtures outside an isolated postgrese verification schema",
  );
}
const base = new URL(process.env.TEST_BASE_URL || "http://127.0.0.1:3001");
if (
  base.protocol !== "http:" ||
  !["127.0.0.1", "localhost"].includes(base.hostname) ||
  base.port !== "3001"
) {
  throw new Error("Integration checks require a loopback server on port 3001");
}
const db = new PrismaClient({ datasourceUrl: url.href, log: [] });
const run = randomBytes(6).toString("hex");
const adminId = `verification-admin-${run}`;
const userId = `verification-user-${run}`;
const adminToken = randomBytes(32).toString("hex");
const userToken = randomBytes(32).toString("hex");
const ids = [];
let passed = 0;
let schemaVerified = false;
const cookie = (token, locale = "en") =>
  [token && `next-auth.session-token=${token}`, `chemistry-locale=${locale}`]
    .filter(Boolean)
    .join("; ");
const headers = (token, locale = "en") => ({
  cookie: cookie(token, locale),
  origin: base.origin,
});
const label = `Verification lesson ${run}`;
const slug = `verification-${run}/lesson`;
const markerZh = `ZH_BODY_${run}`;
const markerEn = `EN_BODY_${run}`;
const updatedMarker = `UPDATED_TRANSLATION_${run}`;
const titleEn = `${label} English`;
const updatedTitle = `${label} updated`;
const input = {
  title: `验证章节 ${run}`,
  slug,
  body: markerZh,
  module: "Physical chemistry / 物理化学",
  subjectSlug: `verification-${run}`,
  chapterSlug: "lesson",
  order: 17,
  isPublic: true,
  isPublished: true,
  translations: {
    zh: { title: `验证章节 ${run}`, body: `中文验证 **${markerZh}**` },
    en: { title: titleEn, body: `English verification **${markerEn}**` },
  },
};

async function request(
  path,
  { token, locale = "en", method = "GET", body, raw, origin, form } = {},
) {
  const requestHeaders = headers(token, locale);
  if (origin !== undefined) requestHeaders.origin = origin;
  if (body !== undefined || raw !== undefined)
    requestHeaders["content-type"] = "application/json";
  return fetch(new URL(path, base), {
    method,
    headers: requestHeaders,
    redirect: "manual",
    body:
      form ?? raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    signal: AbortSignal.timeout(120_000),
  });
}
async function json(path, options, status, code) {
  const response = await request(path, options);
  const payload = await response.json().catch(() => ({}));
  assert.equal(
    response.status,
    status,
    `${options?.method || "GET"} ${path}: expected ${status}, received ${response.status} (${payload.code || "no code"})`,
  );
  if (code) assert.equal(payload.code, code, `${path}: unexpected error code`);
  return payload;
}
async function page(path, options, included = [], excluded = []) {
  const response = await request(path, options);
  const html = await response.text();
  assert.ok(
    response.status < 500,
    `${path}: unexpected server error ${response.status}`,
  );
  for (const value of included)
    assert.ok(
      html.includes(value),
      `${path}: expected fixture content missing`,
    );
  for (const value of excluded)
    assert.ok(
      !html.includes(value),
      `${path}: restricted or wrong-language fixture content leaked`,
    );
  return { response, html };
}
async function check(name, operation) {
  await operation();
  passed++;
  console.log(`PASS ${name}`);
}
async function progress(completed, token = userToken, expected = 200, code) {
  return json(
    "/api/progress",
    { token, method: "POST", body: { contentSlug: slug, completed } },
    expected,
    code,
  );
}

try {
  const [current] = await db.$queryRaw`SELECT current_schema() AS name`;
  assert.equal(
    current.name,
    schema,
    "Database schema guard failed; fixtures were not created",
  );
  schemaVerified = true;
  assert.equal(
    await db.user.count(),
    0,
    "Verification schema must be empty before fixtures",
  );
  await db.user.createMany({
    data: [
      {
        id: adminId,
        name: "Verification admin",
        email: `admin-${run}@example.invalid`,
        role: "ADMIN",
      },
      {
        id: userId,
        name: "Verification learner",
        email: `learner-${run}@example.invalid`,
        role: "USER",
      },
    ],
  });
  await db.session.createMany({
    data: [
      {
        sessionToken: adminToken,
        userId: adminId,
        expires: new Date(Date.now() + 3_600_000),
      },
      {
        sessionToken: userToken,
        userId,
        expires: new Date(Date.now() + 3_600_000),
      },
    ],
  });

  await check("database sessions and administrator page guards", async () => {
    const admin = await json("/api/auth/session", { token: adminToken }, 200);
    const learner = await json("/api/auth/session", { token: userToken }, 200);
    assert.equal(
      admin.user?.id,
      adminId,
      "Admin database session was not read",
    );
    assert.equal(
      learner.user?.id,
      userId,
      "Learner database session was not read",
    );
    await page("/admin", { token: adminToken }, ["Manage your library"]);
    const anonymous = await request("/admin");
    const anonymousHtml = await anonymous.text();
    assert.ok(
      anonymous.headers.get("location")?.startsWith("/login") ||
        /<meta[^>]+http-equiv="refresh"[^>]+content="[^\"]*url=\/login/.test(
          anonymousHtml,
        ),
      `Anonymous admin page must redirect to login (status ${anonymous.status})`,
    );
    assert.ok(
      !anonymousHtml.includes("Manage your library"),
      "Anonymous admin page must not expose the content studio",
    );
    const ordinary = await request("/admin", { token: userToken });
    const ordinaryHtml = await ordinary.text();
    assert.ok(
      ordinary.headers.get("location") === "/" ||
        /<meta[^>]+http-equiv="refresh"[^>]+content="[^\"]*url=\//.test(
          ordinaryHtml,
        ),
      `Ordinary admin page must redirect (status ${ordinary.status})`,
    );
    assert.ok(
      !ordinaryHtml.includes("Manage your library"),
      "Ordinary admin page must not expose the content studio",
    );
  });

  let article;
  await check(
    "administrator creates bilingual content with canonical slash slug",
    async () => {
      article = await json(
        "/api/admin/content",
        { token: adminToken, method: "POST", body: input },
        201,
      );
      ids.push(article.id);
      assert.equal(article.slug, slug);
      const record = await db.content.findUniqueOrThrow({
        where: { id: article.id },
      });
      assert.equal(record.order, 17);
      assert.equal(record.module, input.module);
      assert.equal(record.translations.en.title, titleEn);
    },
  );
  await check(
    "canonical public reader serves the requested language",
    async () => {
      await page(`/notes/${slug}`, {}, [markerEn, titleEn], [markerZh]);
      await page(
        `/notes/${encodeURIComponent(slug)}`,
        {},
        [markerEn, titleEn],
        [markerZh],
      );
      await page("/notes/thermodynamics%2Fintro", {}, ["reader-article"]);
      await page(`/notes/${slug}`, { locale: "zh" }, [markerZh], [markerEn]);
      await page("/learn", {}, [titleEn]);
    },
  );
  await check(
    "ordinary and anonymous users cannot mutate administrator resources",
    async () => {
      for (const token of [userToken, undefined]) {
        await json(
          "/api/admin/content",
          { token, method: "POST", body: input },
          403,
          "FORBIDDEN",
        );
        await json(
          `/api/admin/content/${article.id}`,
          { token, method: "PUT", body: { title: "Blocked" } },
          403,
          "FORBIDDEN",
        );
        await json(
          `/api/admin/content/${article.id}`,
          { token, method: "DELETE" },
          403,
          "FORBIDDEN",
        );
        await json(
          "/api/admin/preview-mdx",
          { token, method: "POST", body: { source: "Blocked" } },
          403,
          "FORBIDDEN",
        );
        await json(
          "/api/upload-image",
          { token, method: "POST" },
          403,
          "FORBIDDEN",
        );
      }
    },
  );
  await check(
    "malformed payloads, duplicate slugs and foreign origins are rejected",
    async () => {
      await json(
        "/api/admin/content",
        { token: adminToken, method: "POST", raw: "{" },
        400,
        "VALIDATION_ERROR",
      );
      await json(
        "/api/admin/content",
        {
          token: adminToken,
          method: "POST",
          body: { ...input, slug: "../invalid" },
        },
        400,
        "VALIDATION_ERROR",
      );
      await json(
        "/api/admin/content",
        { token: adminToken, method: "POST", body: input },
        409,
        "CONFLICT",
      );
      await json(
        "/api/admin/content",
        {
          token: adminToken,
          method: "POST",
          body: input,
          origin: "https://foreign.invalid",
        },
        403,
        "FORBIDDEN",
      );
      await json(
        `/api/admin/content/${article.id}`,
        {
          token: adminToken,
          method: "DELETE",
          origin: "https://foreign.invalid",
        },
        403,
        "FORBIDDEN",
      );
      await json(
        "/api/progress",
        { token: userToken, method: "POST", raw: "{" },
        400,
        "VALIDATION_ERROR",
      );
      await json(
        "/api/progress",
        {
          token: userToken,
          method: "POST",
          body: { contentSlug: slug, completed: true },
          origin: "https://foreign.invalid",
        },
        403,
        "FORBIDDEN",
      );
      await json(
        "/api/progress",
        { method: "POST", body: { contentSlug: slug, completed: true } },
        401,
        "UNAUTHENTICATED",
      );
    },
  );
  await check(
    "administrator translation updates preserve the other language and metadata",
    async () => {
      await json(
        `/api/admin/content/${article.id}`,
        {
          token: adminToken,
          method: "PUT",
          body: {
            translations: { en: { title: updatedTitle, body: updatedMarker } },
          },
        },
        200,
      );
      const record = await db.content.findUniqueOrThrow({
        where: { id: article.id },
      });
      assert.equal(record.translations.zh.body, input.translations.zh.body);
      assert.equal(record.order, 17);
      await page(
        `/notes/${slug}`,
        {},
        [updatedMarker, updatedTitle],
        [markerZh, markerEn],
      );
      await page(
        `/notes/${slug}`,
        { locale: "zh" },
        [markerZh],
        [updatedMarker],
      );
    },
  );
  await check(
    "progress completion retries preserve the original timestamps and one row",
    async () => {
      await progress(true);
      const initial = await db.progress.findUniqueOrThrow({
        where: { userId_contentSlug: { userId, contentSlug: slug } },
      });
      await progress(true);
      const repeated = await db.progress.findUniqueOrThrow({
        where: { userId_contentSlug: { userId, contentSlug: slug } },
      });
      assert.equal(repeated.status, "COMPLETED");
      assert.equal(
        repeated.completedAt.toISOString(),
        initial.completedAt.toISOString(),
      );
      assert.equal(
        repeated.updatedAt.toISOString(),
        initial.updatedAt.toISOString(),
      );
      assert.equal(
        await db.progress.count({ where: { userId, contentSlug: slug } }),
        1,
      );
      await page("/account", { token: userToken }, [updatedTitle, "Completed"]);
      await progress(false);
      const incomplete = await db.progress.findUniqueOrThrow({
        where: { userId_contentSlug: { userId, contentSlug: slug } },
      });
      assert.equal(incomplete.status, "IN_PROGRESS");
      assert.equal(incomplete.completedAt, null);
      await progress(false);
      const retried = await db.progress.findUniqueOrThrow({
        where: { userId_contentSlug: { userId, contentSlug: slug } },
      });
      assert.equal(
        retried.updatedAt.toISOString(),
        incomplete.updatedAt.toISOString(),
      );
      await page("/account", { token: userToken }, [
        updatedTitle,
        "In progress",
      ]);
    },
  );
  await check(
    "draft bodies remain hidden and draft progress is denied even to administrators",
    async () => {
      await json(
        `/api/admin/content/${article.id}`,
        { token: adminToken, method: "PUT", body: { isPublished: false } },
        200,
      );
      for (const token of [undefined, userToken])
        await page(
          `/notes/${slug}`,
          { token },
          [],
          [markerZh, updatedMarker, updatedTitle],
        );
      await page(`/notes/${slug}`, { token: adminToken }, [updatedMarker]);
      await progress(true, adminToken, 403, "FORBIDDEN");
      await page("/learn", {}, [], [updatedTitle]);
    },
  );
  await check(
    "private bodies and account chapter titles stay hidden without entitlement",
    async () => {
      await json(
        `/api/admin/content/${article.id}`,
        {
          token: adminToken,
          method: "PUT",
          body: { isPublished: true, isPublic: false },
        },
        200,
      );
      for (const token of [undefined, userToken])
        await page(
          `/notes/${slug}`,
          { token },
          [],
          [markerZh, updatedMarker, updatedTitle],
        );
      await page(`/notes/${slug}`, { token: adminToken }, [updatedMarker]);
      await page("/account", { token: userToken }, [], [updatedTitle]);
      await progress(true, userToken, 403, "FORBIDDEN");
      const saved = await db.progress.findUniqueOrThrow({
        where: { userId_contentSlug: { userId, contentSlug: slug } },
      });
      assert.equal(saved.status, "IN_PROGRESS");
    },
  );
  await check(
    "safe preview produces HTML without executable MDX or unsafe HTML",
    async () => {
      const result = await json(
        "/api/admin/preview-mdx",
        {
          token: adminToken,
          method: "POST",
          body: {
            source:
              "# Preview\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))\n\n\\[x^2\\]\n\n{globalThis.verification = true}",
          },
        },
        200,
      );
      assert.equal(typeof result.html, "string");
      assert.ok(!result.html.includes("<script"));
      assert.ok(!result.html.includes('href="javascript:'));
      assert.ok(result.html.includes("katex"));
    },
  );
  await check(
    "unconfigured durable image storage returns an honest failure without metadata",
    async () => {
      const form = new FormData();
      form.set(
        "file",
        new File(
          [
            Uint8Array.from([
              137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0,
              0, 0, 1, 0, 0, 0, 1,
            ]),
          ],
          "verification.png",
          { type: "image/png" },
        ),
      );
      await json(
        "/api/upload-image",
        { token: adminToken, method: "POST", form },
        503,
        "STORAGE_UNAVAILABLE",
      );
      assert.equal(await db.imageAsset.count(), 0);
    },
  );
  await check(
    "bundled database overrides cannot be deleted and republish their samples",
    async () => {
      const override = await json(
        "/api/admin/content",
        {
          token: adminToken,
          method: "POST",
          body: {
            ...input,
            slug: "thermodynamics/intro",
            subjectSlug: "thermodynamics",
            chapterSlug: "intro",
            isPublic: false,
            isPublished: false,
          },
        },
        201,
      );
      ids.push(override.id);
      await json(
        `/api/admin/content/${override.id}`,
        { token: adminToken, method: "DELETE" },
        409,
        "BUNDLED_CONTENT",
      );
      await json(
        `/api/admin/content/${override.id}`,
        {
          token: adminToken,
          method: "PUT",
          body: { slug: `verification-${run}/renamed-bundle` },
        },
        409,
        "BUNDLED_SLUG",
      );
      await json(
        `/api/admin/content/${override.id}`,
        { token: adminToken, method: "PUT", body: { isPublished: false } },
        200,
      );
      assert.ok(await db.content.findUnique({ where: { id: override.id } }));
      await page(
        "/notes/thermodynamics/intro",
        {},
        [],
        [markerZh, markerEn, "reader-article"],
      );
    },
  );
  await check(
    "administrator can rename and delete ordinary database content",
    async () => {
      const renamed = `verification-${run}/renamed`;
      await json(
        `/api/admin/content/${article.id}`,
        {
          token: adminToken,
          method: "PUT",
          body: { slug: renamed, isPublic: true },
        },
        200,
      );
      await page(`/notes/${renamed}`, {}, [updatedMarker, updatedTitle]);
      await json(
        `/api/admin/content/${article.id}`,
        { token: adminToken, method: "DELETE" },
        200,
      );
      assert.equal(
        await db.content.findUnique({ where: { id: article.id } }),
        null,
      );
      await page(`/notes/${slug}`, {}, [], [updatedMarker, updatedTitle]);
    },
  );
  console.log(
    JSON.stringify({
      integrationChecksPassed: passed,
      oauthExchange: "not exercised",
      externalStorage: "not configured; honest failure verified",
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      integrationChecksPassed: passed,
      failure:
        error instanceof assert.AssertionError
          ? error.message
          : "Integration service operation failed",
      kind: error.name,
      code: error.code || null,
    }),
  );
  process.exitCode = 1;
} finally {
  try {
    if (!schemaVerified)
      throw new Error("Cleanup refused because schema was not verified");
    await db.progress.deleteMany({
      where: { userId: { in: [adminId, userId] } },
    });
    await db.session.deleteMany({
      where: { userId: { in: [adminId, userId] } },
    });
    await db.content.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: [adminId, userId] } } });
    console.log(
      JSON.stringify({
        fixtureCleanup: "complete",
        remainingUsers: await db.user.count(),
        remainingContent: await db.content.count(),
        remainingProgress: await db.progress.count(),
      }),
    );
  } catch {
    console.error(
      "Verification fixture cleanup failed; temporary schema must be removed by its owner",
    );
    process.exitCode = 1;
  }
  await db.$disconnect();
}
