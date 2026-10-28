import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

let database;
try {
  database = new URL(process.env.DATABASE_URL || "");
  if (!["postgres:", "postgresql:"].includes(database.protocol))
    database = null;
} catch {
  database = null;
}

const directRef = database?.hostname.match(
  /^db\.([a-z0-9]+)\.supabase\.co$/,
)?.[1];
const poolRef = database?.username.match(/^postgres\.([a-z0-9]+)$/)?.[1];
const projectRef = directRef || poolRef || null;
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF?.trim();
const targetMatches = !expectedRef || projectRef === expectedRef;
let storageProjectRef = null;
try {
  const storageUrl = new URL(process.env.SUPABASE_URL || "");
  storageProjectRef =
    storageUrl.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1] || null;
} catch {
  // Missing or malformed URLs are reported without exposing configuration values.
}
const required = [
  "User",
  "Account",
  "Session",
  "Content",
  "Progress",
  "ImageAsset",
];

console.log(
  JSON.stringify(
    {
      mode:
        process.env.CHEMISTRY_CONTENT_MODE === "bundled"
          ? "bundled-preview"
          : "database",
      database: database
        ? {
            host: database.hostname,
            database: database.pathname.slice(1),
            schema: database.searchParams.get("schema") || "public",
            projectRef,
            expectedProjectMatches: targetMatches,
          }
        : { configured: false },
      auth: {
        googleConfigured: Boolean(
          (process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID) &&
          (process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET),
        ),
        secretConfigured: Boolean(
          process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
        ),
        disabled: process.env.DISABLE_GOOGLE_LOGIN === "true",
      },
      storage: {
        urlConfigured: Boolean(process.env.SUPABASE_URL),
        projectRef: storageProjectRef,
        serverKeyConfigured: Boolean(
          process.env.SUPABASE_SECRET_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY,
        ),
        bucket: process.env.SUPABASE_STORAGE_BUCKET || "chemistry-images",
      },
    },
    null,
    2,
  ),
);

if (!targetMatches) {
  console.error("Configured database does not match the expected project.");
  process.exitCode = 1;
}
if (process.argv.includes("--database")) {
  if (!database || !targetMatches) {
    console.error("A verified database target is required.");
    process.exitCode = 1;
  } else {
    const { PrismaClient } = await import("@prisma/client");
    const client = new PrismaClient({ log: [] });
    try {
      const tables =
        await client.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`;
      const names = new Set(tables.map((row) => row.table_name));
      const missing = required.filter((name) => !names.has(name));
      console.log(
        JSON.stringify({
          databaseReachable: true,
          missingApplicationTables: missing,
        }),
      );
      if (missing.length) process.exitCode = 1;
    } catch (error) {
      console.error(
        JSON.stringify({
          databaseReachable: false,
          code: /^P\d{4}$/.test(error?.code || "")
            ? error.code
            : "CONNECTION_FAILED",
        }),
      );
      process.exitCode = 1;
    } finally {
      await client.$disconnect();
    }
  }
}
