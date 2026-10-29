# 正式发布与功能开启

2026-10-29，所有者明确要求“发布发布”，并希望获得功能开启说明。本次在已有项目和正式域名发布，不创建新的生产项目或改变预览访问限制。

## 版本与目标

- 正式站：<https://physical-chemistry-study.vercel.app>
- Vercel：`alans-projects-a91dc9b2 / physical-chemistry-study`
- 已验收源码：`4bf30308760b91c4e5fe337c1de3d49afef9a88b`
- PR 1 已合并；生产合并提交：`479768fbd533fa387e5abca0eccece34ddd56bd5`
- 首次功能生产部署：`dpl_8Z94YLWTWbudC2xNQyCeyUsEJ1an`，READY，正式域名已分配，无 alias error。
- 数据库：Supabase 项目 `xnegjifescpfenmzlsgv` 的 `postgres/public`。

## 数据库

执行前创建了私有逻辑数据及目录元数据备份，核对原有五项迁移及校验和。只应用第六项 `20261029003000_study_workspace_and_recovery`，SHA-256 为 `867fd1620b2d8318e2257e20d78d47441abe9b3d810bc1b655eebeae37591908`。

应用后六项迁移均完成；28 张内部表启用 RLS，九张新增私人表对 PUBLIC、anon 和 authenticated 撤销直接权限；应用外键均留在 public。原有一位用户、一项 Google 关联、一个会话及两篇文章的原有数据保留。其他应用的 planner 函数、结构、权限与独立开发数据库校验通过。

未创建生产测试用户，未复制或重置会话，未发送真实邮件。回退时切换应用部署并保留新增数据库结构和数据，不执行 reset 或破坏性 down migration。

## 发布验证

发布前再次运行 205 项测试，全部通过；原功能分支已通过 lint、类型、格式、构建和隔离数据库联调。线上五组、51 项检查通过：

- 中英文首页、登录、注册及正文页面。
- Google 与密码登录能力；生产环境不会被误判为 Preview。
- 中英文正文搜索、数据库可用性及真实小节锚点。
- 私人资料、导出和阅读接口拒绝匿名请求，响应不缓存。
- Google 授权初始化使用正式域名 `/api/auth/callback/google`；CSRF 和记住登录偏好 Cookie 具有安全属性。

本次没有代替所有者完成 Google passkey 或最终授权。正式浏览器检查确认中英文新版登录界面可见。完整隔离保存/恢复验证见[学习空间验收](2026-10-29-study-workspace.md)。

## 配置与实际可用范围

生产构建确认数据库目标正确，Google 和认证密钥已配置，Storage 服务端配置及项目匹配。Vercel 环境变量列表接口返回权限不足，因此没有读取或输出任何凭据；通过脱敏构建状态和线上接口核对配置。

阅读同步、收藏、私人笔记、正文搜索、账户资料/设备/导出及管理员恢复功能已上线。邮箱能力接口实际返回 `mail:false`、`registration:false`；构建也确认 Resend key 和发件地址尚未配置。真实邮件验证、找回密码和换邮箱仍需开启邮件服务。

参阅[功能开启指南](../setup/feature-activation.md)和[发信服务准备](../setup/transactional-email.md)。密钥直接填写到 Vercel；域名验证和真实收信测试完成后，才能确认邮件可用于公众注册。
