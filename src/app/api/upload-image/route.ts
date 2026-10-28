import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getAdminUserOrNull } from "@/lib/admin-access";
import { isTrustedMutationRequest } from "@/lib/content-validation";
import {
  MAX_IMAGE_SIZE,
  MAX_IMAGE_REQUEST_SIZE,
  StorageError,
  readImageFormData,
  uploadAndPersistImage,
} from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
    const length = Number(request.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_IMAGE_REQUEST_SIZE)
      throw new StorageError("Image exceeds the 4 MiB upload limit", 413);
    const formData = await readImageFormData(request);
    const input = formData.get("file");
    if (!(input instanceof File))
      throw new StorageError("No image was uploaded");
    if (input.size > MAX_IMAGE_SIZE)
      throw new StorageError("Image exceeds the 4 MiB limit", 413);
    const saved = await uploadAndPersistImage(
      {
        bytes: new Uint8Array(await input.arrayBuffer()),
        mimeType: input.type,
        filename: input.name,
        userId: user.id,
      },
      (data) =>
        prisma.imageAsset.create({ data, select: { id: true, url: true } }),
    );
    revalidatePath("/admin/images");
    return Response.json(saved, { status: 201 });
  } catch (error) {
    if (error instanceof StorageError)
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    return Response.json(
      {
        error: "Image service is unavailable. Try again.",
        code: "UNAVAILABLE",
      },
      { status: 503 },
    );
  }
}
