import { prisma } from "@/lib/db";
import {
  AccountError,
  accountFailure,
  getAccountMutation,
} from "@/lib/account-security";
import { getCurrentAccountSession } from "@/lib/account-sessions";
import {
  accountNameChange,
  accountProfileSelect,
  publicAccountProfile,
} from "@/lib/account-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getCurrentAccountSession(request);
    if (!session) throw new AccountError("UNAUTHENTICATED", 401);
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: accountProfileSelect,
    });
    if (!user) throw new AccountError("UNAUTHENTICATED", 401);
    return Response.json(
      { ok: true, data: publicAccountProfile(user) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return accountFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await getAccountMutation(request);
    const session = await getCurrentAccountSession(request);
    if (!session) throw new AccountError("UNAUTHENTICATED", 401);
    const user = await prisma.user.update({
      where: { id: session.userId },
      data: accountNameChange(body),
      select: accountProfileSelect,
    });
    return Response.json(
      { ok: true, data: publicAccountProfile(user) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return accountFailure(error);
  }
}
