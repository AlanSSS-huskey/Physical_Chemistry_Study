import { prisma } from "@/lib/db";
import { AccountError } from "@/lib/account-security";
import { loadContent } from "@/lib/content-service";
import { resolveContentAccess } from "@/lib/content-access";
import { studyUser, studyResponse, studyFailure } from "@/lib/study-server";
import type { StudyLocale } from "@/lib/study-state";
import { studyCollectionItem } from "@/lib/study-privacy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const userId = await studyUser(request);
    const params = new URL(request.url).searchParams;
    const kind = params.get("kind") || "bookmarks";
    const locale = (params.get("locale") || "zh") as StudyLocale;
    const page = Number(params.get("page") || 1);
    if (
      !["bookmarks", "notes", "recent"].includes(kind) ||
      !["zh", "en"].includes(locale) ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 10000
    )
      throw new AccountError("VALIDATION_ERROR", 400);
    const take = 12,
      skip = (page - 1) * take;
    let total: number;
    let records: {
      contentSlug: string;
      locale?: string;
      body?: string;
      anchor?: string | null;
      progress?: number;
      updatedAt?: Date;
      createdAt?: Date;
    }[];
    if (kind === "bookmarks")
      [total, records] = await Promise.all([
        prisma.bookmark.count({ where: { userId } }),
        prisma.bookmark.findMany({
          where: { userId },
          take,
          skip,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
      ]);
    else if (kind === "notes")
      [total, records] = await Promise.all([
        prisma.personalNote.count({ where: { userId, body: { not: "" } } }),
        prisma.personalNote.findMany({
          where: { userId, body: { not: "" } },
          take,
          skip,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        }),
      ]);
    else
      [total, records] = await Promise.all([
        prisma.readingPosition.count({ where: { userId } }),
        prisma.readingPosition.findMany({
          where: { userId },
          take,
          skip,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        }),
      ]);
    const items = await Promise.all(
      records.map(async (record) => {
        const contentLocale =
          record.locale === "en"
            ? "en"
            : record.locale === "zh"
              ? "zh"
              : locale;
        const { content } = await loadContent(
          record.contentSlug,
          contentLocale,
        );
        const available = Boolean(
          content && (await resolveContentAccess(content, userId)) === "full",
        );
        return studyCollectionItem(record, available ? content : null, locale);
      }),
    );
    return studyResponse(
      { items, page, pageSize: take, total, pages: Math.ceil(total / take) },
      userId,
    );
  } catch (error) {
    return studyFailure(error);
  }
}
