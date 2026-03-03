import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Physical Chemistry Study（MVP 骨架）
        </h1>
        <p className="max-w-2xl text-zinc-700">
          这是一个可扩展架构的最小可用版本：公开内容浏览、学科/章节导航、MDX
          + LaTeX 渲染、登录/订阅/插件与权限系统的骨架。
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/learn"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            开始学习
          </Link>
          <Link
            href="/account"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            个人页面（需登录）
          </Link>
        </div>
      </section>

      <section className="rounded-lg border bg-zinc-50 p-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">
          你需要自己准备/安装的依赖
        </h2>
        <ul className="list-inside list-disc text-sm text-zinc-700">
          <li>Node.js、npm/pnpm</li>
          <li>PostgreSQL + DATABASE_URL</li>
          <li>Google OAuth Client（Client ID / Secret）</li>
          <li>Stripe 账号与测试 key（订阅 + webhook）</li>
        </ul>
      </section>
    </div>
  );
}

