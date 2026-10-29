import { prisma } from "@/lib/db";
import {
  AccountError,
  accountFailure,
  assertAccountMutation,
  accountSecret,
} from "@/lib/account-security";
import { getCurrentAccountSession } from "@/lib/account-sessions";
import { limitAccountAvatar } from "@/lib/account-avatar-rate";
import {
  readImageFormData,
  StorageError,
  uploadAndPersistImage,
  validateImage,
  getStorageConfig,
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertAccountMutation(request);
    const session = await getCurrentAccountSession(request);
    if (!session) throw new AccountError("UNAUTHENTICATED", 401);
    const form = await readImageFormData(request);
    const file = form.get("file");
    if (!(file instanceof File))
      throw new AccountError("VALIDATION_ERROR", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    validateImage(bytes, file.type);
    const storage = getStorageConfig();
    await limitAccountAvatar(
      prisma.authRateLimit,
      session.userId,
      accountSecret(),
    );
    const image = await uploadAndPersistImage(
      {
        bytes,
        mimeType: file.type,
        filename: file.name,
        userId: session.userId,
      },
      async (metadata) =>
        prisma.$transaction(async (tx) => {
          await tx.imageAsset.create({
            data: { ...metadata, purpose: "AVATAR" },
          });
          return tx.user.update({
            where: { id: session.userId },
            data: { image: metadata.url },
            select: { image: true },
          });
        }),
      storage,
    );
    return Response.json(
      { ok: true, data: image },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return accountFailure(
      error instanceof StorageError
        ? new AccountError(error.code, error.status)
        : error,
    );
  }
}
