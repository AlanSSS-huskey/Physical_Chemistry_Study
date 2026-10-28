import type { StudyContent } from "@/lib/content-service";

export type ContentAccess = "full" | "preview" | "denied";
type AccessContent = Pick<
  StudyContent,
  "isPublic" | "isPublished" | "moduleKey" | "previewRatio"
>;

export function contentAccessPolicy(
  content: AccessContent,
  permissions: { isAdmin: boolean; hasEntitlement: boolean },
): ContentAccess {
  if (permissions.isAdmin) return "full";
  if (!content.isPublished) return "denied";
  if (permissions.hasEntitlement) return "full";
  if (!content.isPublic) return "denied";
  if (!content.moduleKey) return "full";
  return content.previewRatio > 0 ? "preview" : "denied";
}

/** Permission lookup failures propagate so callers can distinguish outages from refusal. */
export async function resolveContentAccess(
  content: StudyContent,
  userId?: string,
): Promise<ContentAccess> {
  if (content.isPublished && content.isPublic && !content.moduleKey)
    return "full";
  if (!userId)
    return contentAccessPolicy(content, {
      isAdmin: false,
      hasEntitlement: false,
    });
  const { userIsAdmin, userHasEntitlement } =
    await import("@/lib/entitlements");
  const isAdmin = await userIsAdmin(userId);
  if (isAdmin) return "full";
  if (!content.isPublished) return "denied";
  const [contentEntitled, moduleEntitled] = await Promise.all([
    userHasEntitlement({ userId, entitlementKey: `content:${content.slug}` }),
    content.moduleKey
      ? userHasEntitlement({
          userId,
          entitlementKey: `module:${content.moduleKey}`,
        })
      : Promise.resolve(false),
  ]);
  return contentAccessPolicy(content, {
    isAdmin,
    hasEntitlement: contentEntitled || moduleEntitled,
  });
}
