import { prisma } from "@/lib/db";
import {
  AccountError,
  accountFailure,
  assertAccountMutation,
} from "@/lib/account-security";
import {
  clearAccountSessionCookie,
  clearAccountSessionChunks,
  getCurrentAccountSession,
} from "@/lib/account-sessions";
import { revokeAccountSessions } from "@/lib/account-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertAccountMutation(request);
    const current = await getCurrentAccountSession(request);
    if (!current) throw new AccountError("UNAUTHENTICATED", 401);
    const { id } = await context.params;
    const result = await revokeAccountSessions(
      prisma.session,
      current.userId,
      current.id,
      id,
    );
    const response = Response.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
          ...(result.currentRevoked
            ? { "Set-Cookie": clearAccountSessionCookie(request) }
            : {}),
        },
      },
    );
    if (result.currentRevoked) clearAccountSessionChunks(response, request);
    return response;
  } catch (error) {
    return accountFailure(error);
  }
}
