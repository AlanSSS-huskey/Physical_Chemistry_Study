import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50 p-8 shadow-sm md:p-12">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-blue-200/35 blur-2xl" />
        <div className="absolute -bottom-10 left-1/3 h-40 w-40 rounded-full bg-amber-200/30 blur-2xl" />
        <div className="relative space-y-4">
          <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">
            University-Level Study Hub
          </div>
          <h1 className="max-w-3xl text-3xl font-black leading-tight tracking-tight text-slate-900 md:text-5xl">
            Physical Chemistry Study Workspace
          </h1>
          <p className="max-w-2xl text-slate-600">
            内容阅读、章节进度、权限控制、后台管理都已在同一套 Next.js + NextAuth +
            Prisma 架构里打通。
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/learn"
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-700"
            >
              打开学习中心
            </Link>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:border-amber-300 hover:text-amber-700"
            >
              进入 Admin
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Reader</div>
          <div className="mt-2 text-2xl font-black text-slate-900">MDX + KaTeX</div>
          <p className="mt-2 text-sm text-slate-600">章节按学科组织，支持公式渲染和预览裁剪。</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Auth</div>
          <div className="mt-2 text-2xl font-black text-slate-900">NextAuth</div>
          <p className="mt-2 text-sm text-slate-600">登录态、学习进度和 admin 二次密码都可联动。</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Data</div>
          <div className="mt-2 text-2xl font-black text-slate-900">Prisma</div>
          <p className="mt-2 text-sm text-slate-600">进度、订阅、授权映射等核心表结构可持续扩展。</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-500">
          环境准备
        </h2>
        <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <div className="rounded-lg bg-slate-50 px-3 py-2">Node.js + npm/pnpm</div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">PostgreSQL + DATABASE_URL</div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">Google OAuth 凭据</div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">Stripe 测试 Key + Webhook</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/account"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            查看账户页
          </Link>
        </div>
      </section>
    </div>
  );
}
