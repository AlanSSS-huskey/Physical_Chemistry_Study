import { setChapterComplete } from "@/app/learn/[subject]/[chapter]/actions";
import { getSessionState, logAuthFailure } from "@/lib/auth";
import {
  ContentValidationError,
  isTrustedMutationRequest,
  parseContentJson,
} from "@/lib/content-validation";
import {
  progressApiResponse,
  validateProgressInput,
} from "@/lib/progress-validation";

export async function POST(request: Request): Promise<Response> {
  if (!isTrustedMutationRequest(request))
    return progressApiResponse({ ok: false, error: "forbidden" });
  try {
    const session = await getSessionState();
    if (session.status === "unconfigured")
      return progressApiResponse({ ok: false, error: "unconfigured" });
    if (session.status === "unavailable")
      return progressApiResponse({ ok: false, error: "unavailable" });
    if (session.status !== "authenticated")
      return progressApiResponse({ ok: false, error: "unauthenticated" });

    const payload = await parseContentJson(request, 4096);
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      !("contentSlug" in payload) ||
      !("completed" in payload)
    )
      return progressApiResponse({ ok: false, error: "invalid" });
    const input = validateProgressInput(payload.contentSlug, payload.completed);
    if (!input) return progressApiResponse({ ok: false, error: "invalid" });

    return progressApiResponse(
      await setChapterComplete(input.contentSlug, input.status === "COMPLETED"),
    );
  } catch (error) {
    if (error instanceof ContentValidationError)
      return progressApiResponse({ ok: false, error: "invalid" });
    logAuthFailure("PROGRESS_API", error);
    return progressApiResponse({ ok: false, error: "unavailable" });
  }
}
