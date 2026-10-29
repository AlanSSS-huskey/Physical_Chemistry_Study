import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isBundledContent } from "@/lib/content-service";
import {
  ContentHistoryError,
  expectedRevision,
  restoreContentVersion,
} from "@/lib/content-history";
import {
  adminContentActor,
  contentMutationBody,
  historyFailure,
  historyResponse,
} from "@/lib/content-history-http";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const actor = await adminContentActor();
    const raw = await contentMutationBody(request);
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      Object.keys(raw).some(
        (key) => !["expectedVersion", "version"].includes(key),
      )
    )
      throw new ContentHistoryError("VALIDATION_ERROR");
    const payload = raw as Record<string, unknown>;
    const { id } = await context.params;
    const current = await prisma.content.findUnique({
      where: { id },
      select: { slug: true, version: true },
    });
    if (!current) throw new ContentHistoryError("NOT_FOUND", 404);
    if (current.version !== expectedRevision(payload.expectedVersion))
      throw new ContentHistoryError("VERSION_CONFLICT", 409);
    const bundled = await isBundledContent(current.slug);
    const content = await prisma.$transaction(
      (tx) =>
        restoreContentVersion(
          tx,
          actor,
          id,
          expectedRevision(payload.expectedVersion),
          payload.version === undefined
            ? undefined
            : expectedRevision(payload.version),
          bundled,
        ),
      { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 },
    );
    revalidatePath("/", "layout");
    return historyResponse({
      ok: true,
      id: content.id,
      slug: content.slug,
      version: content.version,
      isPublished: false,
    });
  } catch (error) {
    return historyFailure(error);
  }
}
