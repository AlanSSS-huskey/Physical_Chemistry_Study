import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";
import { safeCallbackPath } from "@/lib/auth-config";

export const metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  return <VerifyEmailForm callbackUrl={safeCallbackPath(params.callbackUrl)} />;
}
