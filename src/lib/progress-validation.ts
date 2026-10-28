export type CompletionStatus = "COMPLETED" | "IN_PROGRESS";
export type ProgressUpdateResult =
  | { ok: true; status: CompletionStatus }
  | {
      ok: false;
      error: "invalid" | "unauthenticated" | "forbidden" | "unavailable";
    };

/** Stable HTTP counterpart to the completion action's domain result. */
export function progressApiResponse(
  result: ProgressUpdateResult | { ok: false; error: "unconfigured" },
): Response {
  const headers = { "Cache-Control": "no-store" };
  if (result.ok) return Response.json({ ok: true }, { status: 200, headers });
  const failures = {
    invalid: {
      status: 400,
      code: "VALIDATION_ERROR",
      error: "A valid contentSlug and boolean completed value are required.",
    },
    unauthenticated: {
      status: 401,
      code: "UNAUTHENTICATED",
      error: "Sign in to save learning progress.",
    },
    forbidden: {
      status: 403,
      code: "FORBIDDEN",
      error: "Progress cannot be saved for this chapter.",
    },
    unavailable: {
      status: 503,
      code: "UNAVAILABLE",
      error: "Progress is temporarily unavailable. Try again shortly.",
    },
    unconfigured: {
      status: 503,
      code: "AUTH_NOT_CONFIGURED",
      error: "Sign-in has not been configured yet.",
    },
  };
  const { status, code, error } = failures[result.error];
  return Response.json({ error, code }, { status, headers });
}

export function validateProgressInput(
  contentSlug: unknown,
  completed: unknown,
): { contentSlug: string; status: CompletionStatus } | null {
  if (typeof contentSlug !== "string" || typeof completed !== "boolean")
    return null;
  const slug = contentSlug.trim().toLowerCase();
  if (
    slug.length > 240 ||
    !/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/.test(slug)
  )
    return null;
  return { contentSlug: slug, status: completed ? "COMPLETED" : "IN_PROGRESS" };
}

/** Authorization is repeated on every write; the form's visible state is never trusted. */
export async function updateAuthorizedProgress(
  contentSlug: unknown,
  completed: unknown,
  userId: string | null,
  dependencies: {
    resolveAccess: (
      slug: string,
      userId: string,
    ) => Promise<"full" | "preview" | "denied" | "unavailable">;
    save: (
      userId: string,
      slug: string,
      status: CompletionStatus,
    ) => Promise<void>;
  },
): Promise<ProgressUpdateResult> {
  const input = validateProgressInput(contentSlug, completed);
  if (!input) return { ok: false, error: "invalid" };
  if (!userId) return { ok: false, error: "unauthenticated" };
  const access = await dependencies.resolveAccess(input.contentSlug, userId);
  if (access === "unavailable") return { ok: false, error: "unavailable" };
  if (access !== "full") return { ok: false, error: "forbidden" };
  await dependencies.save(userId, input.contentSlug, input.status);
  return { ok: true, status: input.status };
}
