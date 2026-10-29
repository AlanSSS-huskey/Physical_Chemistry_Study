import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isBundledContent } from "@/lib/content-service";
import {
  ContentHistoryError,
  deletePrivateDraft,
  expectedRevision,
  saveContentVersion,
  trashContentVersion,
  validateContentMutation,
} from "@/lib/content-history";
import {
  adminContentActor,
  contentMutationBody,
  historyFailure,
  historyResponse,
} from "@/lib/content-history-http";

type Context = { params: Promise<{ id: string }> };
async function bundledContent(id: string, version: number) {
  const content = await prisma.content.findUnique({
    where: { id },
    select: { slug: true, version: true },
  });
  if (!content) throw new ContentHistoryError("NOT_FOUND", 404);
  if (content.version !== version)
    throw new ContentHistoryError("VERSION_CONFLICT", 409);
  return isBundledContent(content.slug);
}
export async function PUT(request: Request, context: Context) {
  try {
    const actor = await adminContentActor();
    const payload = validateContentMutation(await contentMutationBody(request));
    const { id } = await context.params;
    const bundled = await bundledContent(
      id,
      expectedRevision(payload.expectedVersion),
    );
    const content = await prisma.$transaction(
      async (tx) => {
        const updated = await saveContentVersion(
          tx,
          actor,
          id,
          payload,
          bundled,
        );
        if (typeof payload.draftKey === "string")
          await deletePrivateDraft(
            tx,
            actor,
            payload.draftKey,
            expectedRevision(payload.draftRevision),
          );
        return updated;
      },
      { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 },
    );
    revalidatePath("/", "layout");
    return historyResponse({
      id: content.id,
      slug: content.slug,
      version: content.version,
    });
  } catch (error) {
    return historyFailure(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const actor = await adminContentActor();
    const payload = validateContentMutation(await contentMutationBody(request));
    const { id } = await context.params;
    const content = await prisma.$transaction(
      (tx) =>
        trashContentVersion(
          tx,
          actor,
          id,
          expectedRevision(payload.expectedVersion),
        ),
      { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 },
    );
    revalidatePath("/", "layout");
    return historyResponse({ ok: true, version: content.version });
  } catch (error) {
    return historyFailure(error);
  }
}
