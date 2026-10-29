import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  createContentVersion,
  deletePrivateDraft,
  expectedRevision,
  validateContentMutation,
} from "@/lib/content-history";
import {
  adminContentActor,
  contentMutationBody,
  historyFailure,
  historyResponse,
} from "@/lib/content-history-http";

export async function POST(request: Request) {
  try {
    const actor = await adminContentActor();
    const payload = validateContentMutation(await contentMutationBody(request));
    const content = await prisma.$transaction(
      async (tx) => {
        const created = await createContentVersion(tx, actor, payload);
        if (typeof payload.draftKey === "string")
          await deletePrivateDraft(
            tx,
            actor,
            payload.draftKey,
            expectedRevision(payload.draftRevision),
          );
        return created;
      },
      { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 },
    );
    revalidatePath("/", "layout");
    return historyResponse(
      { id: content.id, slug: content.slug, version: content.version },
      201,
    );
  } catch (error) {
    return historyFailure(error);
  }
}
