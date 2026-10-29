import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSessionState } from "@/lib/auth";
import { safeCallbackPath } from "@/lib/auth-config";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const [params, session] = await Promise.all([
    searchParams,
    getSessionState(),
  ]);
  const callbackUrl = safeCallbackPath(params.callbackUrl);
  if (session.status === "authenticated" && !params.error)
    redirect(callbackUrl);
  return <LoginForm callbackUrl={callbackUrl} initialError={params.error} />;
}
