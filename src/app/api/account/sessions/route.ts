import { prisma } from "@/lib/db";
import {
  AccountError,
  accountFailure,
  assertAccountMutation,
} from "@/lib/account-security";
import { getCurrentAccountSession } from "@/lib/account-sessions";
import { SESSION_ACTIVITY_INTERVAL_MS } from "@/lib/session-policy";
import {
  accountSessionView,
  revokeAccountSessions,
} from "@/lib/account-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const current = await getCurrentAccountSession(request);
    if (!current) throw new AccountError("UNAUTHENTICATED", 401);
    const now = new Date();
    const cutoff = new Date(now.getTime() - SESSION_ACTIVITY_INTERVAL_MS);
    if (current.lastActiveAt <= cutoff) {
      const userAgent =
        request.headers
          .get("user-agent")
          ?.replace(/[\x00-\x1f\x7f]/g, "")
          .slice(0, 512) || current.userAgent;
      const changed = await prisma.session.updateMany({
        where: {
          id: current.id,
          userId: current.userId,
          expires: { gt: now },
          lastActiveAt: { lte: cutoff },
        },
        data: {
          lastActiveAt: now,
          userAgent,
        },
      });
      if (changed.count) {
        current.lastActiveAt = now;
        current.userAgent = userAgent;
      }
    }
    const rows = await prisma.session.findMany({
      where: {
        userId: current.userId,
        expires: { gt: now },
        id: { not: current.id },
      },
      orderBy: { lastActiveAt: "desc" },
      take: 99,
    });
    return Response.json(
      {
        ok: true,
        data: {
          sessions: [current, ...rows].map((session) =>
            accountSessionView(session, current.id),
          ),
          currentSessionId: current.id,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return accountFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertAccountMutation(request);
    const current = await getCurrentAccountSession(request);
    if (!current) throw new AccountError("UNAUTHENTICATED", 401);
    await revokeAccountSessions(prisma.session, current.userId, current.id);
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return accountFailure(error);
  }
}
