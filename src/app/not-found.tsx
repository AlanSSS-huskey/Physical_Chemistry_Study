import Link from "next/link";
import { getLocale } from "@/lib/locale-server";
import { textFor } from "@/lib/i18n";

export default async function NotFound() {
  const locale = await getLocale();
  return (
    <div className="empty-state panel">
      <span className="eyebrow">404 / NOT FOUND</span>
      <h1 className="page-heading">
        {textFor(locale, "这一页还没有找到。", "We could not find this page.")}
      </h1>
      <p className="muted">
        {textFor(
          locale,
          "内容可能已移动，或暂时未公开。可以从学习中心继续探索。",
          "The content may have moved or is not publicly available. Continue exploring the study library.",
        )}
      </p>
      <Link href="/learn" className="button">
        {textFor(locale, "返回学习中心", "Back to the library")}
      </Link>
    </div>
  );
}
