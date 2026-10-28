import { getAdminUserOrNull } from "@/lib/admin-access";
import { renderMarkdown } from "@/lib/markdown";
import {
  ContentValidationError,
  MAX_CONTENT_LENGTH,
  contentApiFailure,
  isTrustedMutationRequest,
  parseContentJson,
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
    const payload = await parseContentJson(request);
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      !("source" in payload) ||
      typeof payload.source !== "string" ||
      payload.source.length > MAX_CONTENT_LENGTH
    ) {
      throw new ContentValidationError(
        "Preview source must be text up to 300000 characters",
      );
    }
    return Response.json(
      { html: await renderMarkdown(payload.source) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return contentApiFailure(error);
  }
}
