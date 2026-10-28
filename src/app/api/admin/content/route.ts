import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getAdminUserOrNull } from "@/lib/admin-access";
import {
  contentApiFailure,
  isTrustedMutationRequest,
  parseContentJson,
  validateContentInput,
} from "@/lib/content-validation";

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
    const input = validateContentInput(await parseContentJson(request));
    const { translations, ...fields } = input;
    const created = await prisma.content.create({
      data: {
        ...fields,
        translations: translations
          ? (translations as Prisma.InputJsonValue)
          : Prisma.DbNull,
        sourcePath: null,
      },
      select: { id: true, slug: true },
    });
    revalidatePath("/", "layout");
    return Response.json(created, { status: 201 });
  } catch (error) {
    return contentApiFailure(error);
  }
}
