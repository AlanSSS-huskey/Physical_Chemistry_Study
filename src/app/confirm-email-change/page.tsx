import { AccountDataConfirmation } from "@/components/account/AccountDataConfirmation";
export const metadata = {
  title: "确认邮箱变更 · Confirm email change",
  robots: { index: false, follow: false },
};
export default function ConfirmEmailChangePage() {
  return <AccountDataConfirmation kind="email" />;
}
