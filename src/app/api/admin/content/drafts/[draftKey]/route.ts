import { prisma } from "@/lib/db";
import {
  ContentHistoryError,
  deletePrivateDraft,
  expectedRevision,
  savePrivateDraft,
  validateDraftKey,
} from "@/lib/content-history";
import {
  adminContentActor,
  contentMutationBody,
  historyFailure,
  historyResponse,
} from "@/lib/content-history-http";
type Context = { params: Promise<{ draftKey: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await adminContentActor(request);
    const { draftKey } = await context.params;
    const draft = await prisma.contentDraft.findUnique({
      where: {
        userId_draftKey: {
          userId: actor.id,
          draftKey: validateDraftKey(draftKey),
        },
      },
      select: {
        payload: true,
        revision: true,
        baseVersion: true,
        updatedAt: true,
        contentId: true,
      },
    });
    return historyResponse({ ok: true, data: draft });
  } catch (error) {
    return historyFailure(error);
  }
}
export async function PUT(request: Request, context: Context) {
  try {
    const actor = await adminContentActor(request);
    const raw = await contentMutationBody(request);
    const { draftKey } = await context.params;
    const draft = await prisma.$transaction((tx) =>
      savePrivateDraft(tx, actor, draftKey, raw),
    );
    return historyResponse({
      ok: true,
      data: { revision: draft.revision, updatedAt: draft.updatedAt },
    });
  } catch (error) {
    return historyFailure(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const actor = await adminContentActor(request);
    const raw = await contentMutationBody(request);
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      Object.keys(raw).some((key) => key !== "expectedRevision")
    )
      throw new ContentHistoryError("VALIDATION_ERROR");
    const { draftKey } = await context.params;
    await prisma.$transaction((tx) =>
      deletePrivateDraft(
        tx,
        actor,
        draftKey,
        expectedRevision((raw as Record<string, unknown>).expectedRevision),
      ),
    );
    return historyResponse({ ok: true });
  } catch (error) {
    return historyFailure(error);
  }
}
