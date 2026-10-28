import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getAdminUserOrNull } from "@/lib/admin-access";
import { isTrustedMutationRequest } from "@/lib/content-validation";
import {
  StorageError,
  deleteImageObject,
  readImageObject,
} from "@/lib/storage";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function imageFailure(error: unknown): Response {
  if (error instanceof StorageError)
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  return Response.json(
    { error: "Image service is unavailable. Try again.", code: "UNAVAILABLE" },
    { status: 503 },
  );
}

// Uploaded illustrations have stable shareable URLs; the storage bucket stays private.
export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const asset = await prisma.imageAsset.findUnique({
      where: { id },
      select: { storagePath: true, mimeType: true },
    });
    if (
      !asset?.storagePath ||
      !asset.mimeType ||
      !["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType)
    )
      return Response.json(
        { error: "Image not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    const object = await readImageObject(asset.storagePath);
    return new Response(object.body, {
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return imageFailure(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!isTrustedMutationRequest(request))
    return Response.json(
      { error: "Forbidden", code: "FORBIDDEN" },
      { status: 403 },
    );
  try {
    const user = await getAdminUserOrNull();
    if (!user)
      return Response.json(
        { error: "Forbidden", code: "FORBIDDEN" },
        { status: 403 },
      );
    const { id } = await context.params;
    const asset = await prisma.imageAsset.findUnique({
      where: { id },
      select: { id: true, storagePath: true },
    });
    if (!asset)
      return Response.json(
        { error: "Image not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    // Admin authorization above permits managing any asset; never delete by client-supplied path.
    if (asset.storagePath) await deleteImageObject(asset.storagePath);
    await prisma.imageAsset.delete({ where: { id: asset.id } });
    revalidatePath("/admin/images");
    return Response.json({ ok: true });
  } catch (error) {
    return imageFailure(error);
  }
}
