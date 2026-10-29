import { prisma } from "@/lib/db";
import { ContentHistoryError, expectedRevision } from "@/lib/content-history";
import {
  adminContentActor,
  historyFailure,
  historyResponse,
} from "@/lib/content-history-http";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    await adminContentActor();
    const { id } = await context.params;
    const content = await prisma.content.findUnique({
      where: { id },
      select: { version: true },
    });
    if (!content) throw new ContentHistoryError("NOT_FOUND", 404);
    const rawBefore = new URL(request.url).searchParams.get("before");
    const before =
      rawBefore === null ? undefined : expectedRevision(Number(rawBefore));
    const revisions = await prisma.contentRevision.findMany({
      where: {
        contentId: id,
        ...(before === undefined ? {} : { version: { lt: before } }),
      },
      orderBy: { version: "desc" },
      take: 51,
      select: {
        version: true,
        action: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    });
    const page = revisions.slice(0, 50);
    return historyResponse({
      ok: true,
      data: {
        currentVersion: content.version,
        nextBefore: revisions.length > 50 ? page.at(-1)?.version : null,
        revisions: page.map(({ actor, ...revision }) => ({
          ...revision,
          actorName: actor?.name ?? null,
        })),
      },
    });
  } catch (error) {
    return historyFailure(error);
  }
}
