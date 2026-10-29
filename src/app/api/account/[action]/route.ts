import { prisma } from "@/lib/db";
import { getAuthAvailability, getGoogleOAuthConfig } from "@/lib/auth";
import { safeCallbackPath } from "@/lib/auth-config";
import { accountMailReady } from "@/lib/account-mail";
import { createEmailAuthService } from "@/lib/account-email";
import {
  AccountError,
  accountFailure,
  accountCsrfResponse,
  getAccountMutation,
  accountRequestOrigin,
} from "@/lib/account-security";
import {
  createAccountSession,
  getCurrentAccountSession,
  accountSessionCookie,
  clearAccountSessionCookie,
  clearAccountSessionChunks,
} from "@/lib/account-sessions";

export const runtime = "nodejs";
type Context = { params: Promise<{ action: string }> };
const ok = (data?: unknown) =>
  Response.json(
    { ok: true, ...(data !== undefined ? { data } : {}) },
    { headers: { "Cache-Control": "no-store" } },
  );
export async function GET(
  request: Request,
  context: Context,
): Promise<Response> {
  try {
    const { action } = await context.params;
    if (action === "csrf") return accountCsrfResponse(request);
    if (action === "capabilities") {
      const ready = getAuthAvailability().status === "ready";
      const google = getGoogleOAuthConfig(accountRequestOrigin(request));
      return ok({
        passwordLogin: ready,
        registration: ready && accountMailReady(),
        mail: accountMailReady(),
        google: ready && google.configured,
        googlePreviewUnavailable: google.previewUnavailable,
      });
    }
    throw new AccountError("NOT_FOUND", 404);
  } catch (error) {
    return accountFailure(error);
  }
}
export async function POST(
  request: Request,
  context: Context,
): Promise<Response> {
  try {
    const { action } = await context.params;
    if (
      ![
        "register",
        "resend-verification",
        "verify",
        "forgot-password",
        "reset-password",
        "login",
        "change-password",
        "token-status",
      ].includes(action)
    )
      throw new AccountError("NOT_FOUND", 404);
    const input = await getAccountMutation(request);
    if (getAuthAvailability().status !== "ready")
      throw new AccountError("UNAVAILABLE", 503);
    const service = createEmailAuthService({ db: prisma });
    if (action === "register") {
      await service.register(input, request);
      return ok();
    }
    if (action === "resend-verification") {
      await service.resendVerification(input, request);
      return ok();
    }
    if (action === "forgot-password") {
      await service.forgotPassword(input, request);
      return ok();
    }
    if (action === "token-status")
      return ok(await service.tokenStatus(input, request));
    if (action === "reset-password") {
      await service.resetPassword(input, request);
      const response = ok();
      response.headers.append("Set-Cookie", clearAccountSessionCookie(request));
      clearAccountSessionChunks(response, request);
      return response;
    }
    if (action === "change-password") {
      const current = await getCurrentAccountSession(request);
      if (!current) throw new AccountError("UNAUTHENTICATED", 401);
      const session = await service.changePassword(
        input,
        current.userId,
        current.sessionToken,
        request,
      );
      const response = ok();
      response.headers.append(
        "Set-Cookie",
        accountSessionCookie(session, request),
      );
      clearAccountSessionChunks(response, request);
      return response;
    }
    const remember = input.remember === true;
    const user =
      action === "verify"
        ? await service.verify(input, request)
        : await service.login(input, request);
    const issued = await prisma.$transaction(
      async (tx) => {
        // A password reset racing login must not issue a session for the old hash.
        if ("passwordHash" in user) {
          const credential = await tx.passwordCredential.findUnique({
            where: { userId: user.id },
          });
          if (!credential || credential.passwordHash !== user.passwordHash)
            throw new AccountError("INVALID_CREDENTIALS", 401);
        }
        return createAccountSession(user.id, remember, request, tx);
      },
      { isolationLevel: "Serializable" },
    );
    const response = Response.json(
      { ok: true, redirectTo: safeCallbackPath(input.callbackUrl) },
      { headers: { "Cache-Control": "no-store", "Set-Cookie": issued.cookie } },
    );
    clearAccountSessionChunks(response, request);
    return response;
  } catch (error) {
    return accountFailure(error);
  }
}
