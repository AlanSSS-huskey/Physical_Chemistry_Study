# 如何使用和开启网站功能

正式网站：[physical-chemistry-study.vercel.app](https://physical-chemistry-study.vercel.app)。
本次已发布在原来的 Vercel 项目，数据库继续使用原来的 Supabase。

## 登录后即可使用

1. 打开[登录页](https://physical-chemistry-study.vercel.app/login)，使用 Google 登录。勾选“记住我”可保留登录最多 30 天。若内置浏览器的 Google passkey 页面卡住，在普通 Chrome 中重新打开正式站并发起登录。
2. 打开一篇笔记，使用“阅读设置”“收藏本章”和“我的本章笔记”。文字输入后自动保存，以“已同步”为准；失败时保留当前文字并显示重试，冲突需要自己选择保留哪版。
3. 在[我的收藏与笔记](https://physical-chemistry-study.vercel.app/account/library)查看收藏、私人笔记和最近阅读。收藏共享；中英文笔记和阅读位置分别保存。在“私人笔记”分类使用“搜索笔记内容”，可查找自己的笔记文字。
4. 点击页头“搜索”，或按 **⌘K / Ctrl K**，搜索中英文课程标题和正文。Tab 浏览结果，Enter 打开首项，Esc 关闭。也可以打开[全部笔记](https://physical-chemistry-study.vercel.app/notes)使用完整搜索；有匹配小节时直接定位，并使用结果实际对应的语言。
5. 阅读页侧栏的“本章小节”可直接跳到某个小节；手机上可展开目录。目录只列出当前可见正文中的小节。
6. 在[账户设置](https://physical-chemistry-study.vercel.app/account/settings)管理资料、登录设备和个人数据导出。注销需要明确确认，并要求当前密码或邮箱证明。

以上功能部署后即可使用，不需要另开服务或运行本地电脑。

## 从备份恢复笔记和收藏

在[账户设置](https://physical-chemistry-study.vercel.app/account/settings)的个人数据区域先导出备份，保管好下载的 JSON 文件。要恢复时：

1. 选择本网站导出的 JSON 备份，点击“预览导入”。目前每次最多 1 MiB、100 条笔记和 500 个收藏，每条笔记最多 5000 个字符。
2. 核对页面显示的当前账户、新增记录和冲突原文。默认保留当前已有的冲突笔记；只有明确选择替换时才会用备份文字覆盖。
3. 勾选核对确认，再点击“确认导入笔记与收藏”。提交成功后，可到“我的收藏与笔记”查看结果。

预览十分钟内有效；预览后若相关记录改变，需要重新预览。只恢复笔记和收藏，不恢复账户资料、密码、权限、阅读进度或设置。来自其他账户的自有备份也可恢复到当前账户；恢复文字不会获得课程访问权限。即使章节已不可用，自己写的文字仍可保留和搜索。

仅用 Google 登录且未设置密码的账户，邮件服务开启前暂不能通过邮件注销；最后一个管理员也受到保留保护。

## 管理员后台

用现有管理员账户打开[管理后台](https://physical-chemistry-study.vercel.app/admin)。普通用户没有后台权限。

编辑时会自动保存自己的私人草稿。文章本身仍需点击“保存文章”才更新。历史版本与回收站恢复后都会先处于未发布状态，检查内容后再发布。

## 开启邮箱注册、验证、找回密码和更换邮箱

这些流程已经部署，真实发信还需要下列配置。

1. 准备一个自己拥有、能管理 DNS 的域名；可以专门使用发信子域，例如 `auth.example.com`。`example.com` 是示例，需要换成自己的域名。网站仍可使用当前 Vercel 网址。
2. 创建 [Resend 账户](https://resend.com/signup)。进入 **Domains → Add Domain** 添加发信子域，将 Resend 实际给出的 DKIM、SPF 等记录填入域名服务商的 DNS 设置，等待显示 **Verified**。记录值须逐项照填，保留原有邮箱记录。[官方域名步骤](https://resend.com/docs/add-a-domain)
3. 在 Resend 的 **API Keys** 创建 **Sending access** 密钥，并限制到该发信域名。[官方密钥步骤](https://resend.com/docs/create-an-api-key)
4. 打开 [Vercel 项目环境变量](https://vercel.com/alans-projects-a91dc9b2/physical-chemistry-study/settings/environment-variables)，选择 **Production**，填写下面两项，并核对已有的网站地址。

| 名称             | 填写内容                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY` | 刚创建的发送密钥，直接填写到 Vercel，不发到聊天或提交到代码                                   |
| `EMAIL_FROM`     | 已验证域名下的发件地址，例如 `Physical Chemistry <no-reply@auth.example.com>`，换成自己的域名 |
| `NEXTAUTH_URL`   | 保持 `https://physical-chemistry-study.vercel.app`                                            |

5. 保存后，在 Vercel 的 **Deployments** 对正式版本执行 **Redeploy**。新部署会读取这些配置，网站会自动提供邮箱注册和邮件相关操作。[环境变量官方步骤](https://vercel.com/docs/environment-variables/managing-environment-variables)
6. 用自己的邮箱实际完成一次注册验证、登录和密码重置，再开放公众使用。配置齐全不等于邮件一定送达，需要实际收信确认。

保留现有的 `DATABASE_URL`、`NEXTAUTH_SECRET` 和 Google 配置即可。
更详细的发信限制与故障处理见[邮件服务准备](transactional-email.md)。
