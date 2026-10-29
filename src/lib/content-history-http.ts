import { getAdminUserOrNull } from "@/lib/admin-access";
import { AccountError, assertAccountMutation } from "@/lib/account-security";
import { contentApiFailure, parseContentJson } from "@/lib/content-validation";
import { ContentHistoryError, type ContentActor } from "@/lib/content-history";

// Two 300k-character translations plus the canonical body can exceed the
// previous 2 MB cap in UTF-8. This is still a bounded, signed admin-only body.
export const ADMIN_CONTENT_MAX_BYTES = 6_000_000;

export async function adminContentActor(
  request?: Request,
): Promise<NonNullable<ContentActor>> {
  const user = await getAdminUserOrNull();
  if (!user?.id) throw new ContentHistoryError("FORBIDDEN", 403);
  if (request && request.headers.get("x-admin-user") !== user.id)
    throw new ContentHistoryError("SESSION_CHANGED", 409);
  return { id: user.id, isAdmin: true };
}
export async function contentMutationBody(request: Request) {
  assertAccountMutation(request);
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new ContentHistoryError("VALIDATION_ERROR");
  return parseContentJson(request, ADMIN_CONTENT_MAX_BYTES);
}
export function historyResponse(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function historyFailure(error: unknown): Response {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2034"
  )
    return historyResponse({ ok: false, code: "VERSION_CONFLICT" }, 409);
  if (error instanceof ContentHistoryError || error instanceof AccountError)
    return historyResponse({ ok: false, code: error.code }, error.status);
  const response = contentApiFailure(error);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
