import { prisma } from "@/lib/db";
import { ContentHistoryError, expectedRevision } from "@/lib/content-history";
import {
  adminContentActor,
  historyFailure,
  historyResponse,
} from "@/lib/content-history-http";
type Context = { params: Promise<{ id: string; version: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    await adminContentActor();
    const { id, version } = await context.params;
    const revision = await prisma.contentRevision.findUnique({
      where: {
        contentId_version: {
          contentId: id,
          version: expectedRevision(Number(version)),
        },
      },
      select: { version: true, snapshot: true, action: true, createdAt: true },
    });
    if (!revision) throw new ContentHistoryError("NOT_FOUND", 404);
    return historyResponse({ ok: true, data: revision });
  } catch (error) {
    return historyFailure(error);
  }
}
