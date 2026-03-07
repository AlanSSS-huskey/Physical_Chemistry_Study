## 技术栈选择（为什么）

- **Frontend/Backend**: **Next.js (App Router) + TypeScript**
  - 同一套语言体系、Server Actions/Route Handlers 适合做 MVP → 可扩展成完整产品
- **DB**: **PostgreSQL**（你选择用 **Supabase Postgres** 也完全 OK）
  - 生态成熟，支持权限/订阅/插件市场等复杂关系
- **ORM**: **Prisma**
  - 自带 migrations，可版本化、可迁移
- **Auth**: **NextAuth.js + Google OAuth**
  - MVP 能快速打通登录，后续可扩展更多 provider
- **Payments**: **Stripe（Subscriptions + Webhooks）**
  - webhook 骨架已放好（先验签 + 返回 200）
- **Content**: **MDX + KaTeX**
  - 文件系统内容先跑通；后续可接 CMS/数据库

> 你需要自己准备/安装/注册：Node.js、包管理器、Postgres（Supabase/本地）、Google OAuth、Stripe、并配置环境变量（见下文）。

## 数据库 schema（Prisma）

位置：`prisma/schema.prisma`

核心表（满足 “插件/内容包/订阅映射 entitlement” 骨架）：

- **`User`**：用户 + `role`（USER/ADMIN）
- **`Module`**：内容包/插件（PACK/PLUGIN），用 `key` 唯一标识（如 `thermo-pack`）
- **`Entitlement`**：权限原子单元（`module:thermo-pack` / `feature:mistake-book` 等）
- **`UserEntitlement`**：给用户授予 entitlement（来源可为订阅/购买/手动）
- **`Subscription` / `Purchase` / `PurchaseItem`**：Stripe 订阅/一次性购买骨架（用于未来映射 entitlement）
- **`Progress`**：学习进度（按 `userId + contentSlug` 唯一）
- **NextAuth 必需表**：`Account` / `Session` / `VerificationToken`

## 项目目录结构

```
content/                          # MDX 内容（MVP：文件系统）
  thermodynamics/
    intro.mdx
    first-law.mdx
prisma/
  schema.prisma                   # Prisma schema（Postgres）
src/
  app/
    api/
      auth/[...nextauth]/route.ts # NextAuth 路由（Google）
      webhooks/stripe/route.ts    # Stripe webhook（验签骨架）
    account/page.tsx              # 个人页（需登录）
    learn/
      [subject]/[chapter]/
        actions.ts                # 进度写库 server action
        page.tsx                  # 章节页（含预览 20% + Mark complete）
      layout.tsx                  # Learn 区域布局（sidebar）
      page.tsx                    # Learn 首页
    layout.tsx                    # 全局 layout（含登录按钮）
    page.tsx                      # 首页
    providers.tsx                 # SessionProvider
  components/
    AuthNav.tsx                   # 顶部登录/登出
    MarkCompleteForm.tsx          # 章节完成按钮（写 DB）
    MdxRenderer.tsx               # MDX + KaTeX 渲染
    Sidebar.tsx                   # 左侧导航（读 frontmatter）
  lib/
    auth.ts                       # NextAuth 配置
    content.ts                    # 读取 MDX + 预览裁剪
    db.ts                         # PrismaClient 单例
    entitlements.ts               # entitlement 判断（模块解锁）
```

## 关键代码文件（可复制）

- **Google 登录**：`src/app/api/auth/[...nextauth]/route.ts` + `src/lib/auth.ts`
- **章节渲染**：`src/app/learn/[subject]/[chapter]/page.tsx`
- **“免费仅预览 20%”示例**：
  - MDX frontmatter：`moduleKey: thermo-pack` + `previewRatio: 0.2`
  - 逻辑：章节页中若用户没有 `module:thermo-pack` entitlement → 只渲染前 20%
- **进度写入 DB**：`src/app/learn/[subject]/[chapter]/actions.ts` + `src/components/MarkCompleteForm.tsx`
- **Stripe webhook（验签骨架）**：`src/app/api/webhooks/stripe/route.ts`

## .env.example

见：`.env.example`（你需要自己创建 `.env` 并填写；`.env` 已被 `.gitignore` 忽略，不要提交）

最低必须项（跑数据库 + Prisma migration）：

- `DATABASE_URL`

要启用 Google 登录还需要：

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

要启用 Stripe webhook 还需要：

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

要启用 Admin 编辑页（`/admin`）还需要：

- 确保登录用户在 `User.role` 中为 `ADMIN`

## 本地启动步骤（从 0 到跑起来）

### 1) 安装依赖（你需要自己准备）

- **Node.js**：建议 **Node 20+**
- **包管理器**：`npm`（或你也可以自己安装 `pnpm`）

### 2) 准备数据库（Supabase 也可以）

- 使用 Supabase：
  - 创建项目后拿到 Postgres 连接串
  - 若直连 `db.<ref>.supabase.co:5432` 在你的网络环境不通，改用 **Connection Pooler (session mode)** 的连接串

### 3) 配置环境变量

```
cp .env.example .env
```

编辑 `.env`，填好 `DATABASE_URL`（以及登录/Stripe 需要的变量）。

### 4) Prisma 建表

```
npx prisma migrate dev --name init
```

### 5) 启动开发服务器

```
npm run dev
```

然后打开：

- `/` 首页
- `/learn` 学科/章节导航
- `/learn/thermodynamics/intro`（默认会进入“预览模式”，除非你给当前用户授予了 `module:thermo-pack` entitlement）
- `/account`（会跳到 Google 登录）
- `/admin`（ADMIN 角色后台文章管理）
- `/admin/edit/new`（新建文章）
- `/admin/images`（图片资源管理）
- `/notes`（公开文章列表）

## 未来扩展路线（插件/内容包/订阅）

### “插件/内容包”机制（骨架已具备）

- **上架新内容包**：只需要新增 `Module` 记录（`key/type/title/isPublished`）
- **定义可售/可授予权限**：新增 `Entitlement`（如 `module:thermo-pack`）
- **用户启用/禁用模块**：用 `UserModule` 存储 “已安装且 enabled”

### 订阅/一次性购买 → entitlement

- Stripe webhook 收到订阅更新/支付成功事件后：
  - 写入 `Subscription` / `Purchase`
  - 根据 Price/产品映射规则，授予 `UserEntitlement`（source=SUBSCRIPTION/PURCHASE）
  - entitlement 可设置 `expiresAt` 支持到期回收

### 权限判断（最小规则）

- **模块访问**：`module:${moduleKey}`
- **功能开关**：`feature:${featureKey}`
- **内容解锁**：`content:${contentSlug}`（或 `Content` 表里细粒度策略）

## Admin 内容系统（新增）

- **后台入口**：`/admin`（仅 `User.role = ADMIN` 可访问）
- **文章管理**：新建、编辑、删除、列表查看（`/admin/edit/[id]`）
- **图片管理**：`/admin/images`，支持复制 URL 与删除资源
- **前台阅读**：`/notes`、`/notes/[slug]`

### 图片上传接口

- `POST /api/upload-image`
- 表单字段：`file`（multipart/form-data）
- 支持类型：`jpg` / `jpeg` / `png` / `webp`
- 单文件大小限制：5MB
- 存储目录：`public/uploads`
- 返回：`{ "url": "/uploads/..." }`

### 数据库新增

- `Content.body`（Markdown/MDX 正文）
- `Content.module`（模块/学科）
- `ImageAsset`（上传图片记录，关联 `User`）
- `User.role` 调整为 `USER | ADMIN`

### 设置管理员

首次需要手动把你的账号设为管理员，例如在数据库执行：

```sql
UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = 'your-email@example.com';
```
