import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userIsAdmin } from "@/lib/entitlements";

export async function getAdminUserOrNull() {
  const user = await getCurrentUser();
  if (!user?.id) return null;
  const isAdmin = await userIsAdmin(user.id);
  if (!isAdmin) return null;
  return user;
}

export async function requireAdminUser() {
  const user = await getCurrentUser();
  if (!user?.id) {
    redirect("/api/auth/signin?callbackUrl=/admin");
  }

  const isAdmin = await userIsAdmin(user.id);
  if (!isAdmin) {
    redirect("/");
  }

  return user;
}
