# Physical Chemistry Study

中英文物理化学学习网站。使用 Next.js 15、React 19、Prisma 6、NextAuth 4 与 Supabase Postgres / Storage。

本轮重构及 Remember Me 的本地验收已完成：104 项行为测试、lint、类型检查、生产构建、格式检查及隔离数据库 HTTP 集成均通过。普通 Chrome 的真实 Google 授权、首次账号创建及刷新后保持会话也已验证。新版已通过 Vercel Preview 构建，正式数据库初始化与上线尚待完成。详见[登录与发布记录](docs/verification/2026-10-28-login-release.md)。

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

当前[本地预览](http://localhost:3000)已启用 Google 登录，使用 Supabase 的 `postgrese/chemistry_development` 持久开发数据区。该区域已应用三项迁移并导入两章双语课程，既有 `public` 的表和数据保持不变。普通 Chrome 已完成 Google 授权、账号关联及会话保存，刷新账户页仍保持登录；尚未修改用户的真实学习进度来测试完成操作。

本地连接覆盖保存在被 Git 忽略的 `.env.local`，原 `.env` 保留。使用 `http://localhost:3000` 访问并保持 `NEXTAUTH_URL` 一致，避免与 `127.0.0.1` 混用导致 OAuth cookie 丢失。Google 账户信息和开发学习进度保存在开发数据区，不会自动迁移到正式环境。

## 环境配置

模板全部使用空值或占位符，不包含真实数据库地址、密码或 API key。历史版本曾包含具体连接凭据；若那些凭据仍有效，应在所属服务中轮换。

| 环境变量                                    | 用途                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                              | 已确认的 PostgreSQL 连接串；Vercel 实际目标为 `postgres/public`，本地开发为 `postgrese/chemistry_development` |
| `EXPECTED_SUPABASE_PROJECT_REF`             | 配置检查时要求匹配的项目 ref，可选                                                                            |
| `NEXTAUTH_URL`                              | 当前环境的网站 origin，例如本地地址或正式域名                                                                 |
| `NEXTAUTH_SECRET`                           | 足够随机的会话密钥                                                                                            |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 应用                                                                                             |
| `DISABLE_GOOGLE_LOGIN`                      | `true` 时停用登录                                                                                             |
| `SUPABASE_URL`                              | 同一 Supabase 项目的 HTTPS 地址                                                                               |
| `SUPABASE_SECRET_KEY`                       | 仅服务端使用的 Supabase secret key                                                                            |
| `SUPABASE_SERVICE_ROLE_KEY`                 | 兼容旧 service-role key；与 secret key 二选一                                                                 |
| `SUPABASE_STORAGE_BUCKET`                   | 现有的私有 bucket，默认 `chemistry-images`                                                                    |

Google OAuth 的授权回调必须包含 `https://YOUR_DOMAIN/api/auth/callback/google`；开发环境单独添加 `http://localhost:3000/api/auth/callback/google`。登录服务未配置、会话失效和数据库不可用是不同状态。

登录页默认勾选“记住我（30 天）”。勾选后，会话从成功登录起固定有效 30 天；不勾选则使用浏览器会话 Cookie，服务端最多保留 12 小时。访问网站不会把期限无限向后延长。过期或主动退出后需重新登录，退出立即撤销对应数据库会话。浏览器的“恢复上次会话”功能可能恢复会话 Cookie，因此关闭窗口本身不作为服务端撤销凭据的保证。

Google 记住登录偏好只由通过 CSRF 校验的登录请求生成签名，绑定该次 OAuth state，并在回调或退出时清除。旧会话保留原有数据库期限。构建会先运行配置检查，只在构建日志记录非敏感的目标标识与配置状态。

```sh
npm run config:check
npm run config:check -- --database
```

配置检查只输出状态与非敏感的目标标识；`--database` 仅做连接及必需表名的只读检查，不能替代迁移历史或字段结构核对。

## 数据库部署

2026-10-28 的实际云端构建日志确认，Vercel 的 `DATABASE_URL` 指向项目 `xnegjifescpfenmzlsgv` 的 `postgres/public`；Dashboard 显示该变量适用于 All Environments。它与本地原 `.env` 的 `postgrese/public` 不同，不能从本地配置推断线上目标。

正式目标 `postgres/public` 初始化前没有应用表、枚举或迁移记录，只有两个原有 planner 函数；`planner` schema 属于另一个应用。原 `postgrese/public` 具有初始化迁移和空应用表，本次保留；真实开发账户位于 `postgrese/chemistry_development`，也不复制或修改。

1. 每次发布核对正确团队、项目，以及实际 `DATABASE_URL` 的项目 ref、数据库名和 schema。
2. 保留两个原有 public 函数、`planner` schema、`postgrese` 数据区和 Supabase 管理的 schema；不要运行 reset。
3. 原目标与正式目标已分别建立私人备份，保存无关数据、函数和权限的内容指纹。三条迁移及读写流程已在隔离测试 schema 通过验证。
4. 正式初始化脚本会先验证目标与保护基线，再执行以下步骤；自动审批要求用户明确确认生产数据写入，当前尚未执行：

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

同一 Supabase 项目已创建私有 bucket `chemistry-images`，限制 4 MiB 和 PNG/JPEG/WebP。Vercel Production 已有服务端 Storage 环境变量，仍须验证实际项目匹配和应用读写。上传仅允许管理员，并检查图片签名。数据库记录失败会补偿删除刚上传的对象。

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

最终源码的检查结果为：原生行为测试 104/104 通过，ESLint 和 TypeScript 均为 0 错误，生产构建及格式检查通过；依赖未再变动，已有 `npm audit` 为 0 漏洞。上传上限修正覆盖 4 MiB 精确边界和多一个字节被拒绝的情况。基线没有测试或类型检查脚本，且使用已弃用的 `next lint`；本轮分别增加 Node 原生测试、无增量缓存的类型检查，并改用 ESLint CLI。

真实数据库的隔离 schema 已通过 13 组 HTTP 集成：数据库会话、管理员 CRUD、双语及编码 slug、拒绝越权写入、无效载荷与跨源保护、进度幂等及账户记录、草稿与私有内容保护、安全预览、Storage 缺配失败和内置内容改名/删除保护。测试 schema 应用了全部三条迁移，14 张应用表启用 RLS；测试记录清空后 schema 已删除，既有 `public` 的 `User` / `Content` / `Progress` 仍为 0 / 0 / 0，迁移历史仍仅包含初始化。

公开页面已在浏览器检查中英文搜索、切换后刷新、阅读与公式、旧链接，以及登录、账户和管理入口的安全状态；检查宽度为 320、768、1024 和 1440px。随后在普通 Chrome 完成真实 Google OAuth 与持久会话验证；已登录管理员的浏览器操作及真实 Storage 未验证。

本轮锁定 Next.js 15.5.28、NextAuth 4.24.15、Prisma 6.19.2、React 19.2.4 与 TypeScript 5.9.3；审计基线为 Next.js 15.5.12、NextAuth 4.24.13、Prisma 6.19.2。生产 Google 回调、Storage、生产数据库和 Vercel 环境仍需分别核验；本地登录成功不等于生产连接或发布完成。

保留旧链接 `/learn/<subject>/<chapter>` 与 `/notes/<slug>`；笔记使用 catch-all 路由兼容 slug 中的 `/` 和旧编码路径。

Stripe webhook 保留为独立的原有计费模块，本次不启用支付；上线收费前应单独验证重复事件、乱序事件和永久购买权益。

## 实现资料

- 产品规格：`docs/specs/2026-10-28-site-refactor.md`
- 实现计划：`docs/plans/2026-10-28-site-refactor.md`
- 验收记录：[本地质量、隔离集成与外部限制](docs/verification/2026-10-28-site-refactor.md)
- Cookie API：https://nextjs.org/docs/15/app/api-reference/functions/cookies
- 安全数学渲染：https://github.com/rehypejs/rehype-sanitize
- 对象存储：https://supabase.com/docs/guides/storage/uploads/standard-uploads
