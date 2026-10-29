import { AccountDataConfirmation } from "@/components/account/AccountDataConfirmation";
export const metadata = {
  title: "确认注销账户 · Confirm account deletion",
  robots: { index: false, follow: false },
};
export default function ConfirmAccountDeletionPage() {
  return <AccountDataConfirmation kind="delete" />;
}
