# 注册验证与密码重置邮件 / Transactional email

网站使用 Resend HTTP API 发送账户邮件，沿用现有 NextAuth 和 Prisma 账户。Google 登录可独立工作。当前还没有正式邮件服务和已验证发信域名，不能宣称邮件已经送达。

## 准备账户和域名

1. 由网站所有者创建 [Resend 账户](https://resend.com/signup)，先选择 [Free 方案](https://resend.com/pricing)。不要开启付费升级、超额计费或购买域名；这些操作需要单独确认。
2. 选择一个自己控制 DNS 的域名，可以使用专门的发信子域，例如 `auth.example.com`。这里的 `example.com` 只是示例。网站仍可继续使用 `physical-chemistry-study.vercel.app`，但这个共享部署域名不能作为自己控制的发信域名。[域名要求](https://resend.com/docs/dashboard/domains/introduction)
3. 在 Resend 的 **Domains → Add Domain** 添加选定域名，按页面实际生成的记录配置 DKIM、SPF 等 DNS。完整保留现有邮箱的 MX 记录；不要猜测或复用示例记录值。等待 Resend 显示 **Verified**。后续可补充 DMARC，并为验证、重置邮件关闭点击追踪。[官方 DNS 步骤](https://resend.com/docs/add-a-domain)

## 配置网站

在 Resend 创建专用于本网站的 API key，选择 **Sending access** 并限制到已验证的发信域名。密钥只显示一次，由所有者直接保存到 Vercel 的服务端 Secret；不要粘贴到聊天、代码、截图或日志。[密钥权限说明](https://resend.com/docs/create-an-api-key)

在 Vercel 项目 `physical-chemistry-study` 的对应环境配置：

| 名称              | 内容                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`  | 受限发送密钥，服务端 Secret                                                                     |
| `EMAIL_FROM`      | 已验证域名下的发件地址，例如 `Physical Chemistry <no-reply@auth.example.com>`；示例不能直接上线 |
| `NEXTAUTH_URL`    | 正式站 `https://physical-chemistry-study.vercel.app`                                            |
| `NEXTAUTH_SECRET` | 保留现有认证密钥；不要为了启用邮件而随意更换                                                    |
| `DATABASE_URL`    | 保留已核实的正式数据库配置                                                                      |

不要给密钥加 `NEXT_PUBLIC_` 前缀。Preview、Development 使用各自受控配置，避免误发正式邮件。环境变量更新后部署新版本，再验证链接域名和页面状态。

## 验收与故障处理

- 先确认域名 **Verified**、发件地址匹配、API key 为所选域名的 Sending access，并检查 Resend 的发送限制。[服务额度](https://resend.com/pricing)
- 获得明确的收件地址和测试许可后，再发送一封真实注册验证邮件，完成验证、登录、忘记密码和重置；同时保留原有 Google 登录测试。只记录脱敏结果，不记录密码、完整令牌或会话 cookie。
- `onboarding@resend.dev` 仅用于向 Resend 账户所有者本人测试，不能作为公众注册的正式发件地址。[测试域名限制](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)
- 邮件未配置或供应商报错时，网站应显示服务暂不可用；检查域名验证状态、密钥权限、Resend 日志和额度，不应把请求成功等同于邮件已送达。
- 隔离测试使用进程外的邮件捕获器，不发送真实邮件，也不能证明外部投递成功。任何捕获器、测试令牌或调试收件箱都不能进入正式网站。

Supabase 内置 Auth SMTP 有测试用途限制，而且本网站使用的是 NextAuth 的 `public.User`，不能把它直接当成本网站的通用生产邮件服务。[Supabase 说明](https://supabase.com/docs/guides/auth/auth-smtp)
