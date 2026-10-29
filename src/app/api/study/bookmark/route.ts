import { prisma } from "@/lib/db";
import { AccountError, getAccountMutation } from "@/lib/account-security";
import { validateStudyIdentity } from "@/lib/study-state";
import {
  requireStudyContent,
  studyIdentity,
  studyUser,
  studyResponse,
  studyFailure,
} from "@/lib/study-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const userId = await studyUser(request);
    const identity = await studyIdentity(request, userId);
    const bookmark = await prisma.bookmark.findUnique({
      where: {
        userId_contentSlug: { userId, contentSlug: identity.contentSlug },
      },
    });
    return studyResponse({ bookmarked: Boolean(bookmark) }, userId);
  } catch (error) {
    return studyFailure(error);
  }
}
export async function PUT(request: Request) {
  try {
    const body = await getAccountMutation(request);
    const userId = await studyUser(request);
    const identity = validateStudyIdentity(body);
    if (typeof body.bookmarked !== "boolean")
      throw new AccountError("VALIDATION_ERROR", 400);
    if (body.bookmarked)
      await requireStudyContent(identity.contentSlug, identity.locale, userId);
    const key = { userId, contentSlug: identity.contentSlug };
    if (body.bookmarked)
      await prisma.bookmark.upsert({
        where: { userId_contentSlug: key },
        create: key,
        update: {},
      });
    else await prisma.bookmark.deleteMany({ where: key });
    return studyResponse({ bookmarked: body.bookmarked }, userId);
  } catch (error) {
    return studyFailure(error);
  }
}
