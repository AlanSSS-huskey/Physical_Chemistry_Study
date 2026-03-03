import { prisma } from "@/lib/db";

export async function userHasEntitlement(params: {
  userId: string;
  entitlementKey: string;
}): Promise<boolean> {
  const now = new Date();
  const hit = await prisma.userEntitlement.findFirst({
    where: {
      userId: params.userId,
      entitlement: { key: params.entitlementKey },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    select: { id: true }
  });
  return Boolean(hit);
}

export async function userIsAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });
  return user?.role === "ADMIN";
}

export async function canAccessModule(params: {
  userId: string;
  moduleKey: string;
}): Promise<boolean> {
  if (await userIsAdmin(params.userId)) return true;
  return userHasEntitlement({
    userId: params.userId,
    entitlementKey: `module:${params.moduleKey}`
  });
}

