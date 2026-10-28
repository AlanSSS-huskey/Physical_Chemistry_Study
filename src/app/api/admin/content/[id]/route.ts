import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getAdminUserOrNull } from "@/lib/admin-access";
import { isBundledContent } from "@/lib/content-service";
import {
  contentApiFailure,
  isTrustedMutationRequest,
  parseContentJson,
  validateContentInput,
} from "@/lib/content-validation";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
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
    const existing = await prisma.content.findUnique({ where: { id } });
    if (!existing)
      return Response.json(
        { error: "Content not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    const input = validateContentInput(
      await parseContentJson(request),
      existing,
    );
    if (input.slug !== existing.slug && (await isBundledContent(existing.slug)))
      return Response.json(
        {
          error:
            "Keep the original slug for a bundled lesson. Create a separate note to use a new slug.",
          code: "BUNDLED_SLUG",
        },
        { status: 409 },
      );
    const { translations, ...fields } = input;
    const updated = await prisma.content.update({
      where: { id },
      data: {
        ...fields,
        translations: translations
          ? (translations as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
      select: { id: true, slug: true },
    });
    revalidatePath("/", "layout");
    return Response.json(updated);
  } catch (error) {
    return contentApiFailure(error);
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
    const existing = await prisma.content.findUnique({
      where: { id },
      select: { slug: true },
    });
    if (!existing)
      return Response.json(
        { error: "Content not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    if (await isBundledContent(existing.slug))
      return Response.json(
        {
          error:
            "Bundled lessons cannot be deleted. Unpublish this lesson in the editor.",
          code: "BUNDLED_CONTENT",
        },
        { status: 409 },
      );
    await prisma.content.delete({ where: { id } });
    revalidatePath("/", "layout");
    return Response.json({ ok: true });
  } catch (error) {
    return contentApiFailure(error);
  }
}
