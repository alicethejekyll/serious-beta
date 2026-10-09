# 测试 API 访问说明

这些 API 就是本项目的后端接口，不需要购买第三方 API 或领取一个万能 API Key。页面已经调用它们；朋友通过用户网页测试即可，不需要了解 API。AI 接口保持关闭；匹配仅保留人工框架，不自动推荐或打分。

## 三个入口，共用一个服务

| 入口 | 本机开发地址（仅当前电脑） | 云端路径 |
| --- | --- | --- |
| 用户端 | http://127.0.0.1:5173/ | `/` |
| 管理员端 | http://127.0.0.1:5173/admin | `/admin` |
| API 健康检查 | http://127.0.0.1:5173/api/health | `/api/health` |

`pnpm dev` 必须持续运行，本机地址才能打开。Vite 将 `/api` 转发给本机 8080 后端；测试工具建议统一访问 5173。直接调用 8080 时，写请求的 `Origin` 仍须是 `http://127.0.0.1:5173`。

云端由同一个 Express 服务提供生产前端和 `/api`，不用给用户端、后台和 API 创建三个站点。部署后把 **控制台实际返回并验证过的 HTTPS 原点** 设为 `APP_ORIGIN`。目前还没有完成云部署，本文件没有可分享的公网地址。

## 如何取得公网测试 API

1. 在已授权的中国大陆 CloudBase PostgreSQL 测试环境部署本项目云托管服务，执行迁移并配置最小权限账户、TLS、服务端密钥及管理员。详细步骤见 [部署说明](DEPLOYMENT.md)。不要将云密钥或数据库管理账户交给浏览器。
2. 在服务网络访问设置取得实际 HTTPS 公网域名，或通过 HTTP 网关将根路径 `/` 映射到本服务；这样页面和 API 保持同源。随后更新 `APP_ORIGIN` 并部署该配置。
3. 管理员检查并发布初始问卷，保持 `DATA_MODE=mock`、`LAUNCH_APPROVED=false`。朋友只填写虚构信息，不填真实联系方式。
4. 运行下面的只读检查，再完成各自手机提交、后台读取、服务重启后读取、双用户隔离等验收。成功后将原点根地址发给朋友，管理员入口仅交给指定管理员。

CloudBase 官方说明：[云托管 HTTPS 访问](https://docs.cloudbase.net/run/develop/access/client)、[HTTP 网关路径配置](https://docs.cloudbase.net/service/access-cloudrun)。默认域名适用于开发测试，可能带访问提示、限制或稳定性问题；正式浏览器访问要求绑定已备案的自定义域名，见 [默认域名规则](https://docs.cloudbase.net/service/introduce)。不要把默认测试域名当作已验收的正式服务。

## 马上验证本机 API

先在一个终端保持 `./scripts/run-local.sh` 运行，再在另一个终端执行：

```sh
curl --fail http://127.0.0.1:5173/api/health
# 预期：{"ok":true}

pnpm test:api http://127.0.0.1:5173
```

同一命令也接受部署成功后的实际 HTTPS 原点。它检查两个网页、健康检查、模拟模式配置、匿名读取拦截和不存在的 API，共 7 项；不创建用户、不读取敏感回答、不修改数据。单次通过不等于完成云端安全或持久化验收。

## 会话、Origin 和 CSRF

- 用户：阅读成年人要求和两项独立同意后，`POST /api/enroll` 设置 HttpOnly 会话 Cookie，并返回 `csrf` 与一次性展示的 `recovery` 恢复凭证。不需要邀请码、微信登录或传统注册。公共用户 ID 不能用于读取个人回答。
- 管理员：`POST /api/admin/login` 使用 `{username,password,otp}`，`otp` 为 6 位 TOTP 动态验证码。服务器设置独立 Cookie，返回 `csrf`。不得把管理密码或 TOTP 导入密钥写进源码或共享测试文件。
- 所有写请求：`Content-Type: application/json` 和 `Origin: APP_ORIGIN`；已登录的写请求还需自己的 `X-CSRF-Token`。调用工具必须保留响应 Cookie，用户和管理员 Cookie 不能混用。
- 浏览器同源调用自动发送 Origin；前端使用 `credentials: 'same-origin'`。后台保护在服务端执行，即使知道 `/api/admin` 地址也不能匿名访问。
- Postman/Apifox 测试时手动设置 Origin 和 JSON，启用 Cookie jar，从登录响应取得 CSRF 后用于后续请求。仅在批准的本地工具存储临时测试凭证，关闭含敏感凭证的同步、分享和日志输出。跨域页面调用尚未开放。
- 用户会话最长 24 小时，管理员最长 8 小时。管理员敏感读取、匹配、导出和删除还要求最近 10 分钟的 MFA 验证；过期后调用 `/api/admin/reauth`。已用过的动态验证码不能重放。

## 用户接口

| 方法 | 路径 | 权限与输入 |
| --- | --- | --- |
| GET | `/api/health` | 公开；数据库连接检查 |
| GET | `/api/meta` | 公开；模式、隐私版本和是否开放，不包含用户回答 |
| POST | `/api/enroll` | 公开；`adult/privacy/sensitive=true`、meta 中的两个文档版本、`mockAcknowledged=true` |
| POST | `/api/recover` | 公开；`{recovery}`，轮换会话并撤销该用户旧会话 |
| GET | `/api/me` | 用户会话；自己的问卷、回答、revision 和 CSRF |
| PUT | `/api/answers` | 用户会话 + CSRF；`{answers,revision}`，自动保存草稿 |
| POST | `/api/submit` | 用户会话 + CSRF；见下方提交输入 |
| POST | `/api/reopen` | 用户会话 + CSRF；`{}`，修改前转回草稿并清除旧匹配记录 |
| POST | `/api/recovery/rotate` | 用户会话 + CSRF；`{}`，返回新恢复凭证，撤销其他会话 |
| POST | `/api/withdraw` | 用户会话 + CSRF；`{confirm:true}`，撤回并清除回答、联系方式及匹配 |
| DELETE | `/api/me` | 用户会话 + CSRF；`{confirm:true}`，删除自己的在线数据及会话 |
| POST | `/api/logout` | 用户会话 + CSRF；`{}` |

报名输入示意；文档版本必须从 `/api/meta` 动态取得，不要硬编码旧版本：

```json
{
  "adult": true,
  "privacy": true,
  "sensitive": true,
  "privacyVersion": "从 meta 获取",
  "sensitiveVersion": "从 meta 获取",
  "mockAcknowledged": true
}
```

同意字段只可在测试者已阅读相应说明并明确勾选后发送，不能通过接口替他人同意。提交输入：

```json
{
  "answers": {},
  "revision": 0,
  "contact": null,
  "contactConsent": false,
  "confirm": true,
  "privacyVersion": "从 meta 获取",
  "sensitiveVersion": "从 meta 获取",
  "mockAcknowledged": true
}
```

这是结构示意，空 answers 不可成功提交。问题、选项和已保存 revision 从 `/api/me` 获取；答案使用问题 key 和选项 value，而非显示顺序。每次保存后更新 revision；提交前等待最后一次保存完成。同一用户重复提交返回相同 publicId，不新增第二份记录。409 表示草稿被更新、状态冲突、暂停或说明版本更新，应重新读取，不要盲目重试。

## 管理员接口

除登录外均需要管理员会话；写入还需要管理员 CSRF。`:id` 使用响应中的内部 UUID，不是 `RR-...` 公共 ID。

| 方法 | 路径 | 功能 / 输入 |
| --- | --- | --- |
| POST | `/api/admin/login` | `{username,password,otp}` |
| GET | `/api/admin/session` | 取得本会话 CSRF |
| POST | `/api/admin/reauth` | `{otp}`，更新最近 MFA 时间 |
| POST | `/api/admin/logout` | `{}` |
| GET | `/api/admin/users` | 搜索 `search`、状态 `status`、匹配状态 `matching`；列表和统计 |
| GET | `/api/admin/users/:id` | 回答明细，敏感读取审计与近期 MFA |
| GET | `/api/admin/users/:id/contact` | 联系方式单独读取，敏感审计与近期 MFA |
| PATCH | `/api/admin/users/:id` | `{matchingStatus: "pending"/"reviewed"/"paused"}` |
| DELETE | `/api/admin/users/:id` | `{confirm:true}`，近期 MFA |
| GET | `/api/admin/questionnaires` | 当前状态、问卷版本、匹配权重 |
| GET | `/api/admin/versions/:id` | 版本题目 |
| POST | `/api/admin/versions` | `{from: 已有版本UUID}` 复制草稿；也接受 `{}` |
| PUT | `/api/admin/versions/:id` | `{questions:[...]}`，仅草稿可修改 |
| POST | `/api/admin/versions/:id/publish` | `{}`，验证后发布不可变版本 |
| POST | `/api/admin/questionnaire/state` | `{accepting:true/false}`，恢复或暂停 |
| PUT | `/api/admin/weights` | 框架预留，当前返回 503，不启用算法 |
| GET | `/api/admin/suggestions` | 返回空建议及 `mode:manual`，当前不自动推荐 |
| POST | `/api/admin/matches` | `{a: UUID,b: UUID,save: true/false}`，指定两人建立/预览待审核候选；无分数，近期 MFA |
| GET | `/api/admin/matches` | 候选、人工授权及双方确认状态，近期 MFA |
| PUT | `/api/admin/matches/:id/feedback` | `{userId: UUID,decision: "pending"/"yes"/"no",confirmedExternally:true}` |
| POST | `/api/admin/matches/:id/authorization` | `{decision:"authorize"/"reject",confirmedManually:true,basicConditionsReviewed:true}`；管理员近期 MFA、审核通过、双方同意后才能批准 |
| POST | `/api/admin/export` | `{includeContacts:false,purpose:"manual_review"}`，敏感审计与近期 MFA；另支持 user_request/backup_review |
| GET | `/api/admin/audit` | 访问审计；没有原始敏感回答 |
| POST | `/api/admin/ai/analyze` | 默认 503，AI 未启用 |

## 错误与验收

JSON 错误结构通常为 `{error,requestId}`（未知 API 为 `{error}`）。401 需恢复或登录；403 检查 Origin、CSRF 或近期 MFA；400 检查输入；409 重新读取版本/状态；415 使用 JSON；429 等待限流窗口；500 可用 requestId 查询服务器错误，不能记录原始请求体。

完整自动化测试使用隔离的真实本机 PostgreSQL 和虚构数据：`pnpm test`。云端还须完成 [验收清单](ACCEPTANCE.md) 中的手机访问、提交后数据库持久化、后台查看、版本发布、双用户隔离、删除和备份恢复。未通过合规安全验收前不启用真实信息。

## 人工匹配流程

当前算法与 AI 暂缓设计，原型评分代码未连接到运行中的应用。基本成年、双向偏好、关系期待、参与意愿及拒绝限制仍由后端校验，但不产生相容性分数或候选排名。

1. 管理员逐一读取并审核回答，在参与者页记录审核状态。
2. 在匹配工作台选择两位参与者，建立待审核候选记录。建立记录不等于授权匹配。
3. 分别向双方核实意愿并记录。仅有双方同意仍不可介绍。
4. 管理员本人再次核对条件，点击明确授权；后端记录管理员、时间与审计。
5. `canIntroduce` 同时要求管理员明确授权、双方已审核、双方明确同意及当前基本条件通过。拒绝、意愿改变、修改回答、撤回或恢复备份都会使已有授权失效或需要重新核验。
