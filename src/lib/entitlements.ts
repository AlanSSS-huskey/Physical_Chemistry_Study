import { prisma } from "@/lib/db";
import { cache } from "react";

function normalizeKey(input: string): string {
  return input.trim().toLowerCase();
}

export async function userHasEntitlement(params: {
  userId: string;
  entitlementKey: string;
}): Promise<boolean> {
  return userHasEntitlementByKeyCached(params.userId, params.entitlementKey);
}

async function userHasEntitlementByKey(
  userId: string,
  entitlementKey: string
): Promise<boolean> {
  const normalizedKey = normalizeKey(entitlementKey);
  if (!normalizedKey) return false;

  const now = new Date();
  const hit = await prisma.userEntitlement.findFirst({
    where: {
      userId,
      entitlement: { key: normalizedKey },
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
  const normalizedModuleKey = normalizeKey(params.moduleKey);
  if (!normalizedModuleKey) return false;

  if (await userIsAdminCached(params.userId)) return true;
  return userHasEntitlementByKeyCached(
    params.userId,
    `module:${normalizedModuleKey}`
  );
}

const userIsAdminCached = cache(userIsAdmin);
const userHasEntitlementByKeyCached = cache(userHasEntitlementByKey);
