# 正式发布与登录保持

用户已明确要求发布到现有 Vercel 网站，让其他人访问，同时完善 Google 登录和 Remember Me。本记录接续首次重构验收，不把本机预览当作正式发布。

## 登录策略

- 勾选：成功登录起固定 30 天，可跨浏览器会话保留。
- 不勾选：浏览器会话 Cookie，服务端绝对期限为 12 小时；浏览器恢复功能可能恢复该 Cookie。
- 到期、退出后失效；请求不会延长绝对期限。
- 每个数据库会话独立保存其策略；后续登录选择不改变原有会话。
- 旧会话继续使用原有有效期，无需数据库迁移或复制会话 token。
- OAuth 偏好为 HttpOnly、SameSite=Lax 的签名 Cookie，正式 HTTPS 下启用 Secure 并使用 Host 前缀；签名绑定当次 OAuth state，15 分钟过期。

## 已完成验证

最终应用源码的原生测试为 104 项通过，包括 15 项会话策略测试；ESLint、类型检查、生产构建和格式检查通过。直接运行已安装的 NextAuth 4.24.15 会话路由验证固定数据库期限、JSON 有效期与 Cookie 策略保持一致。

真实 HTTP 验证使用最终生产构建和独立 3002 测试服务，共 6 组通过：

1. 真实 CSRF 获取与 Google 登录初始化，覆盖两种勾选值和 JSON 跳转响应。
2. 签名偏好绑定 OAuth state，HttpOnly 属性正确；取消授权清除偏好。
3. 临时、30 天及旧会话反复读取时，数据库、JSON 与 Cookie 期限一致。
4. 真实 CSRF 退出请求删除对应会话，旧 token 随即无法认证。
5. 到期会话被拒绝并清理。
6. 测试账号与会话清理，原有开发用户、Google 关联、会话保持 1/1/1，具体记录及有效期未改动。

独立审查已核对 NextAuth 的回调、会话刷新、退出、适配器和 Cookie 路径，未发现阻塞问题。

## 正式发布结果

- 正式项目：`physical-chemistry-study`；现有域名：`https://physical-chemistry-study.vercel.app`。
- 正式部署 `dpl_FUawYc41iHUpP4ezBoEvmk9DTBmm` 已 READY，应用提交为 `6670002`，正式域名已指向新版。
- Vercel 连接器可以读取项目及部署，生产环境变量读取仍返回 403；Chrome 中已确认正确项目的管理页面可用。
- 现有 Git 自动部署已构建 `73a3035` 的云端 Preview，状态 READY；无需继续等待已过期的 CLI 设备授权。
- 实际云端构建的配置检查确认：目标为同一 Supabase 项目的 `postgres/public`。Dashboard 中 `DATABASE_URL` 是一个 All Environments 变量；不能继续把本地原配置 `postgrese/public` 当作正式目标。
- 正式公开的 Google provider 返回 `https://physical-chemistry-study.vercel.app/api/auth/callback/google`，域名正确；真实 Google 回调已成功创建正式用户、Google 关联及数据库会话。
- 对已知 `postgrese/public` 建立私有逻辑备份，实际恢复到独立 schema 后核对了 14 表、6 枚举、105 列、26 约束、35 索引和全部行数据，再清理该验证区域。
- 既有 public 的 13 张应用表为空，只有初始化迁移；开发数据区与真实开发会话保持不变。
- 实际 `postgres/public` 没有应用表、枚举或迁移记录，只有两个原有 planner 函数。已单独备份它们及无关数据的内容指纹；网站的三项迁移没有对象名冲突。
- 用户已明确回复“确认”，授权这次正式数据库初始化及后续发布。首次执行的写入前保护检查发现另一个应用的 `planner.state` 记录内容更新，因此在迁移前停止；函数、权限和其他数据未变。保留旧基线并重新取即时备份后继续，不覆盖该应用数据。
- 20:33 UTC 完成实际 `postgres/public` 初始化：三项迁移校验和一致，导入两章完整公开双语课程，14 张应用表均启用 RLS。即时前后检查证明 planner 的数据、函数、DDL、ACL，以及全部 postgrese 数据区保持不变。
- 20:42 UTC 追加 `20261028210000_protect_migration_history`，保护 Prisma 自动生成的迁移记录表。四项迁移校验和一致，15 张表全部启用 RLS；`anon`、`authenticated` 实际只读查询历史返回零行，所有者 Prisma 迁移正常。参见 [Supabase RLS 规则](https://supabase.com/docs/guides/database/postgres/row-level-security)。
- 云端 Preview 实际读取两章课程成功，已无服务不可用提示，中文阅读正常。随后将经过审查的 `6670002` 快进到 main，触发新的 Production 构建；没有复用缺少 Production Storage 配置的 Preview 构建。
- 已通过 Supabase Dashboard 创建私有 `chemistry-images` bucket，限制 4 MiB 和 PNG/JPEG/WebP；只读元数据确认 `public=false`、上限 `4194304` 字节。
- 上传前后端共用 4 MiB 限制；multipart 请求上限为 `4259840` 字节，低于 Vercel Functions 的请求体限制。精确边界及多一个字节被拒绝的测试通过，最终 Next.js 构建也通过；真实应用上传与读取仍待验证。

## 公网与真实登录验收

- 四组只读 HTTPS 检查通过：中英文公开页和阅读页、Remember Me 界面、匿名权限、跨源拒绝、两种 Google 偏好初始化的正式回调与安全 Cookie 标记、取消授权后清理。测试不加载生产数据库凭据，也不写入生产数据。
- 普通 Chrome 真实 Google 登录成功，默认勾选后数据库会话为固定 30 天，刷新账户页保持登录且绝对有效期不变。
- 点击退出后，正式会话记录立即清零。
- 取消勾选后再次真实 Google 登录成功，数据库策略为浏览器会话，绝对期限为 12 小时；刷新后仍保持登录。再次退出也立即删除该会话。
- 验收结束后重新勾选并登录，保留一个正常的 30 天正式会话。正式用户和 Google 关联均为 1；未伪造账号、写入学习进度或复制开发会话。
- 实际 Production 构建日志确认数据库与 Storage 均为项目 `xnegjifescpfenmzlsgv`，Google/会话密钥及服务端 Storage 凭据配置完整。

## 验证范围

自动审批拒绝了创建临时生产用户、会话、进度和图片后清理的写入联调，理由为缺少对这些具体测试写入的明确用户授权。该脚本未运行，没有通过其他通道绕过；已改用上述只读公网检查与正常 Google 登录。真实管理员图片上传、读取、删除仍未验证。

内置浏览器中的 Google passkey 卡顿尚未确认修复；普通 Chrome 的正式登录已经通过。登录页新增中英文提示，在授权页持续加载时于 Chrome 打开本站并重新发起登录，避免复制跨浏览器无效的 Google 授权网址。
