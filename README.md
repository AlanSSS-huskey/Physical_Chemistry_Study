# Physical Chemistry Study

中英文物理化学学习网站。使用 Next.js 15、React 19、Prisma 6、NextAuth 4 与 Supabase Postgres / Storage。

本轮重构的本地验收已完成：87 项行为测试、lint、类型检查、生产构建、格式检查及隔离数据库 HTTP 集成均通过。真实 Google 授权、已登录管理员的浏览器操作、真实 Storage 和 Production 环境仍待验证。本轮尚未对既有应用 schema 执行迁移，也未部署本次改动。详见[验收记录](docs/verification/2026-10-28-site-refactor.md)。

## 当前实现

- 中英文界面切换，语言偏好通过 cookie 保留；章节翻译共用内容 slug 和学习进度。
- 首页、课程目录、笔记搜索、统一阅读页与前后章节导航。
- 同一内容服务读取数据库文章与随站课程；数据库中的私有或未发布记录始终覆盖同名样例。
- 后台双语编辑、预览、公开设置、发布状态、图片上传及确认删除。
- Google 数据库会话、管理员检查与真实学习进度；重复提交完成状态不会再次切换。
- Markdown、数学公式、表格和图片共用安全渲染；不执行存储内容中的 JSX、import 或 JavaScript。
- 已接入 Supabase 私有 bucket 的持久图片存储实现；稳定的应用 URL 可公开分享。真实 Storage 读写尚未验证。

## 本地启动

需要 Node.js 24 或更新的受支持版本。

```sh
npm ci
cp -n .env.example .env
npm run dev
```

默认数据库地址为空时可阅读随站样例，不会伪造后台保存或进度成功。已有 `.env` 时请逐项核对，不要覆盖自己的凭据。

显式只读样例预览：

```sh
CHEMISTRY_CONTENT_MODE=bundled DISABLE_GOOGLE_LOGIN=true npm run dev
```

`CHEMISTRY_CONTENT_MODE=bundled` 不读取数据库内容，也不允许保存学习进度。生产环境应清除此设置后验证实际数据库连接。配置了数据库但连接失败时，文章服务会关闭读取并显示恢复提示，防止同名私有内容被本地样例替代。

当前[本地预览](http://localhost:3000)已启用 Google 登录，使用 Supabase 的 `postgrese/chemistry_development` 持久开发数据区。该区域已应用三项迁移并导入两章双语课程，既有 `public` 的表和数据保持不变。Google 授权入口已实测；首次登录和进度保存仍需本人完成 Google 授权后验收。

本地连接覆盖保存在被 Git 忽略的 `.env.local`，原 `.env` 保留。使用 `http://localhost:3000` 访问并保持 `NEXTAUTH_URL` 一致，避免与 `127.0.0.1` 混用导致 OAuth cookie 丢失。Google 账户信息和开发学习进度保存在开发数据区，不会自动迁移到正式环境。

## 环境配置

模板全部使用空值或占位符，不包含真实数据库地址、密码或 API key。历史版本曾包含具体连接凭据；若那些凭据仍有效，应在所属服务中轮换。

| 环境变量                                    | 用途                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`                              | 已确认的 PostgreSQL 连接串；既有应用保留 `postgrese` 数据库的 `public` schema |
| `EXPECTED_SUPABASE_PROJECT_REF`             | 配置检查时要求匹配的项目 ref，可选                                            |
| `NEXTAUTH_URL`                              | 当前环境的网站 origin，例如本地地址或正式域名                                 |
| `NEXTAUTH_SECRET`                           | 足够随机的会话密钥                                                            |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 应用                                                             |
| `DISABLE_GOOGLE_LOGIN`                      | `true` 时停用登录                                                             |
| `SUPABASE_URL`                              | 同一 Supabase 项目的 HTTPS 地址                                               |
| `SUPABASE_SECRET_KEY`                       | 仅服务端使用的 Supabase secret key                                            |
| `SUPABASE_SERVICE_ROLE_KEY`                 | 兼容旧 service-role key；与 secret key 二选一                                 |
| `SUPABASE_STORAGE_BUCKET`                   | 现有的私有 bucket，默认 `chemistry-images`                                    |

Google OAuth 的授权回调必须包含 `https://YOUR_DOMAIN/api/auth/callback/google`；开发环境单独添加 `http://localhost:3000/api/auth/callback/google`。登录服务未配置、会话失效和数据库不可用是不同状态。

```sh
npm run config:check
npm run config:check -- --database
```

配置检查只输出状态与非敏感的目标标识；`--database` 仅做连接及必需表名的只读检查，不能替代迁移历史或字段结构核对。

## 数据库部署

本地、Preview 与 Production 的连接变量分别管理。2026-10-28 的只读核对已确认：既有应用位于真实存在的 `postgrese` 数据库、`public` schema，不能把数据库名自动改为 `postgres`。其迁移历史仅包含 `20260303054114_init`；当时 `User`、`Content`、`Progress` 的聚合行数均为 0。默认 `postgres` 数据库中的 `planner` schema 属于另一个应用，与上述应用目标不同。

Vercel Production 环境变量读取仍返回 403，线上实际连接尚未验证；不能据此认定 Production 一定使用本地目标。旧模板中的其他项目地址也不能作为部署依据。本次计划保留 `postgrese/public`，不把既有应用迁入新建的 `chemistry` schema。

1. 在 Vercel 确认正确团队、项目，以及 Production 的 `DATABASE_URL`；在 Supabase 确认相同项目 ref、数据库名和 schema。
2. 保留既有 `postgrese/public` 的表、账号、权限和链接；不改动默认 `postgres` 数据库的 `planner` 或 Supabase 管理的 schema。不要运行 reset。
3. 对已有应用数据先备份并检查迁移历史；既有后台编辑器迁移 `20260307120000_admin_content_editor` 与本轮迁移 `20261028110000_bilingual_content_and_durable_images` 尚未应用到此应用目标。三条迁移及读写流程已在隔离测试 schema 通过验证，但不能代替对既有应用目标的迁移审阅。
4. 以下为核对连接、备份并审阅迁移后的发布步骤，当前尚未在既有应用目标执行：

```sh
npm run prisma:generate
npm run db:deploy
npm run config:check -- --database
npm run db:seed
```

新迁移为应用表添加双语 JSON、排序、发布状态以及图片对象路径。它仅启用应用表的 RLS，不授予匿名 Data API 访问；服务端连接角色必须拥有这些表或具备所需权限。

`db:seed` 只添加不存在的双语入门课程，不覆盖已有文章、发布状态或权限。后台修改课程前先运行导入，之后数据库内容优先。若数据库中已管理某个内置课程，请在编辑器取消发布，不要删除覆盖记录使原样例重新出现。

首次 Google 登录后，可在已确认的应用 schema 中把你的用户 `role` 设置为 `ADMIN`。这一步需核对准确的用户邮箱和目标 schema，不在代码中硬编码管理员。

## 图片

先在同一 Supabase 项目创建私有 bucket `chemistry-images`，然后设置服务端 Storage 凭据。上传仅允许管理员，检查图片签名和 5 MB 限制。数据库记录失败会补偿删除刚上传的对象。

上传 URL 为 `/api/images/<id>`，可公开分享；私有 bucket 不代表这些应用链接私密。不要上传私密资料。旧 `/uploads/...` 文件若还可取回，需要单独迁移；新实现不会在部署文件系统写入图片，也不会声称已恢复不存在的旧文件。

持久存储目前完成单元测试与缺少 Storage 配置时的失败路径验证；没有声称真实上传、读取或重新部署后的图片保留已通过验收。

## 检查与发布

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm run format:check
npm audit
```

最终冻结源码的检查结果为：原生行为测试 87/87 通过，ESLint 和 TypeScript 均为 0 错误，生产构建及格式检查通过，`npm audit` 为 0 漏洞。基线没有测试或类型检查脚本，且使用已弃用的 `next lint`；本轮分别增加 Node 原生测试、无增量缓存的类型检查，并改用 ESLint CLI。

真实数据库的隔离 schema 已通过 13 组 HTTP 集成：数据库会话、管理员 CRUD、双语及编码 slug、拒绝越权写入、无效载荷与跨源保护、进度幂等及账户记录、草稿与私有内容保护、安全预览、Storage 缺配失败和内置内容改名/删除保护。测试 schema 应用了全部三条迁移，14 张应用表启用 RLS；测试记录清空后 schema 已删除，既有 `public` 的 `User` / `Content` / `Progress` 仍为 0 / 0 / 0，迁移历史仍仅包含初始化。

公开页面已在浏览器检查中英文搜索、切换后刷新、阅读与公式、旧链接，以及登录、账户和管理入口的安全状态；检查宽度为 320、768、1024 和 1440px。真实 Google OAuth、已登录管理员的浏览器操作及真实 Storage 未验证，不能由数据库会话测试或公开页面检查替代。

本轮锁定 Next.js 15.5.28、NextAuth 4.24.15、Prisma 6.19.2、React 19.2.4 与 TypeScript 5.9.3；审计基线为 Next.js 15.5.12、NextAuth 4.24.13、Prisma 6.19.2。真实 Google 授权、Storage、生产数据库和 Vercel 环境还需分别核验；隔离测试结果不等于生产连接或发布完成。

保留旧链接 `/learn/<subject>/<chapter>` 与 `/notes/<slug>`；笔记使用 catch-all 路由兼容 slug 中的 `/` 和旧编码路径。

Stripe webhook 保留为独立的原有计费模块，本次不启用支付；上线收费前应单独验证重复事件、乱序事件和永久购买权益。

## 实现资料

- 产品规格：`docs/specs/2026-10-28-site-refactor.md`
- 实现计划：`docs/plans/2026-10-28-site-refactor.md`
- 验收记录：[本地质量、隔离集成与外部限制](docs/verification/2026-10-28-site-refactor.md)
- Cookie API：https://nextjs.org/docs/15/app/api-reference/functions/cookies
- 安全数学渲染：https://github.com/rehypejs/rehype-sanitize
- 对象存储：https://supabase.com/docs/guides/storage/uploads/standard-uploads
