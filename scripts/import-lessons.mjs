import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { loadLibrary } from "../src/lib/content-service.ts";

for (const file of [".env.local", ".env"])
  if (existsSync(file)) process.loadEnvFile(file);
if (!process.env.DATABASE_URL?.trim())
  throw new Error(
    "Configure and verify DATABASE_URL before importing lessons.",
  );
process.env.CHEMISTRY_CONTENT_MODE = "bundled";
const [zh, en] = await Promise.all([loadLibrary("zh"), loadLibrary("en")]);
const client = new PrismaClient({ log: [] });
try {
  for (const chapter of zh.items) {
    const translation = en.items.find(
      (item) => item.slug === chapter.slug && item.sourceLocale === "en",
    );
    await client.content.upsert({
      where: { slug: chapter.slug },
      update: {},
      create: {
        slug: chapter.slug,
        title: chapter.title,
        body: chapter.body,
        module: chapter.subjectTitle,
        subjectSlug: chapter.subjectSlug,
        chapterSlug: chapter.chapterSlug,
        order: chapter.order,
        isPublic: true,
        isPublished: true,
        previewRatio: 1,
        translations: {
          zh: {
            title: chapter.title,
            body: chapter.body,
            subjectTitle: chapter.subjectTitle,
          },
          ...(translation
            ? {
                en: {
                  title: translation.title,
                  body: translation.body,
                  subjectTitle: translation.subjectTitle,
                },
              }
            : {}),
        },
      },
    });
    console.log(`Imported or preserved: ${chapter.slug}`);
  }
} catch (error) {
  console.error(
    JSON.stringify({
      error: "Lesson import failed; existing records are preserved.",
      code: /^P\d{4}$/.test(error?.code || "") ? error.code : "IMPORT_FAILED",
    }),
  );
  process.exitCode = 1;
} finally {
  await client.$disconnect();
}
