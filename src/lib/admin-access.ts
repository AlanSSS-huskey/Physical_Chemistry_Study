import { redirect } from "next/navigation";
import {
  AuthenticationUnavailableError,
  getCurrentUser,
  getSessionState,
  logAuthFailure,
} from "@/lib/auth";
import { userIsAdmin } from "@/lib/entitlements";

/** API callers must convert service failures to a generic 503 response. */
export async function getAdminUserOrNull() {
  try {
    const user = await getCurrentUser();
    if (!user?.id || !(await userIsAdmin(user.id))) return null;
    return user;
  } catch (error) {
    if (!(error instanceof AuthenticationUnavailableError))
      logAuthFailure("ADMIN_LOOKUP", error);
    throw new AuthenticationUnavailableError();
  }
}

export async function requireAdminUser() {
  const session = await getSessionState();
  if (session.status === "unavailable")
    redirect("/login?error=unavailable&callbackUrl=%2Fadmin");
  if (session.status !== "authenticated")
    redirect("/login?callbackUrl=%2Fadmin");
  let isAdmin = false;
  try {
    isAdmin = await userIsAdmin(session.user.id);
  } catch (error) {
    logAuthFailure("ADMIN_PAGE_LOOKUP", error);
    redirect("/login?error=unavailable&callbackUrl=%2Fadmin");
  }
  if (!isAdmin) redirect("/");
  return session.user;
}
