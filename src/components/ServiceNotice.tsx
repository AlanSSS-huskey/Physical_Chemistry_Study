import { textFor, type Locale } from "@/lib/i18n";

export function ServiceNotice({ locale }: { locale: Locale }) {
  const preview =
    process.env.CHEMISTRY_CONTENT_MODE === "bundled" ||
    !process.env.DATABASE_URL?.trim();
  return (
    <div className="notice service-notice" role="status">
      <span aria-hidden="true">ⓘ</span>
      <p>
        {textFor(
          locale,
          preview
            ? "当前为只读课程预览。连接在线服务后，即可发布笔记并保存学习进度。"
            : "在线笔记服务暂不可用。请稍后重试，已有内容和进度仍然保留。",
          preview
            ? "This is a read-only lesson preview. Connect the online services to publish notes and save your learning progress."
            : "The online library is temporarily unavailable. Please try again shortly; your saved content and progress are retained.",
        )}
      </p>
    </div>
  );
}
