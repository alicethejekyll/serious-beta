# CloudBase 部署与运维

## 当前边界

2026-10-09 本轮已完成设备重新授权，云托管复核为 `normal`、已开通；共享 PG 当前执行角色仍缺少 CREATE ROLE 权限，不能直接套用当前角色迁移，项目表尚未创建。详细状态及用户操作见 [公网部署下一步](PUBLIC_DEPLOYMENT_NEXT.md)。匹配现为人工授权框架，算法和 AI 暂不启用。

已按官方流程安装 CloudBase 插件和 CLI，完成腾讯云国内站登录，并只读识别上海测试环境 `serious-beta-d6gh7kuno620932cf`。详见 [接入记录](CLOUDBASE_CONNECTION.md)。尚未创建收费资源或执行应用云端部署。以下配置与工具不代表已经部署成功；购买、备案及真实数据启用仍由项目负责人核验后进行。

官方依据（2026-10-08 核验）：[PG 模式](https://docs.cloudbase.net/quick-start/pg-overview)、[数据库连接](https://docs.cloudbase.net/database/postgresql/connecting-to-postgresql)、[云托管部署方式](https://docs.cloudbase.net/run/deploy/deploy/introduce)、[云托管 Node.js](https://docs.cloudbase.net/run/quick-start/dockerize-node)、[服务设置](https://docs.cloudbase.net/run/deploy/service-setting)。PG 模式需新环境；连接地址、数据库账户及权限以控制台实际展示为准。

## 1. 测试环境：已连接，数据库待验收

1. 先使用已识别的上海环境 `serious-beta-d6gh7kuno620932cf`，无需重复新建环境。核验 PostgreSQL 实例可用状态、数据库协议地址及可信 CA；请勿发送数据库口令或腾讯云 Secret 到聊天、Git 或前端。若现有环境能力不满足需求，先给出具体限制与费用，再由用户确认新建或升级。
2. 创建云托管服务，选择本项目根目录的 Dockerfile，本应用监听 `0.0.0.0:8080`，平台端口也填写 8080。CPU 0.25 / 内存 0.5GB / 1–2 实例为首轮测试起始配置，费用及可用规格以控制台为准。没有实际购买。
3. 核验云托管到 PostgreSQL 的内网互通。限制数据库到服务网络或固定批准来源，禁止公开前端数据库访问。不要把 `rr` schema 暴露给 PostgREST，核验 anon/authenticated/service_role 对该 schema 无 USAGE 或表授权。

## 2. 数据库迁移与最小权限

在**隔离的操作端**配置 `.env` 或注入环境变量：迁移账号 `MIGRATION_DATABASE_URL` 及 CA。迁移账号需要建角色、建表、GRANT 与管理 RLS 的权限，备份操作账号须经过核验能读取受保护表（如隔离管理员或 BYPASSRLS）。若 CloudBase 当前套餐的数据库管理员不具备此权限，停止并让平台管理员配置所需角色；不能改用超管运行应用或关闭 RLS。

```sh
pnpm db:migrate
```

迁移用事务和 advisory lock 防止并发执行。首次创建问卷草稿，不自动发布云端问卷。

`rr_runtime` 是 NOINHERIT、NOSUPERUSER、NOBYPASSRLS 的运行角色，仅可 SET ROLE 到受限业务角色。由数据库管理员通过安全控制台为它设置独立强口令，不把口令写进 SQL 文件。云托管只注入它的 `DATABASE_URL`，不能注入迁移账号或数据库超管 URL。

运行时自检会拒绝超管、BYPASSRLS、INHERIT 或表拥有者连接。迁移账号与业务账号要分离，应用不自动执行迁移。所有敏感表 FORCE RLS，用户身份在事务内设置并在归还连接前清除。

## 3. 后端环境变量及管理员

复制 `.env.example` 后在受控操作环境填写。仅 `DATABASE_URL`、`DATA_ENCRYPTION_KEY`、`TOKEN_HASH_KEY`、可信 CA 和非秘密配置注入云托管。

- `APP_ORIGIN`：实际 HTTPS 原点，包含协议与域名，不带路径；前后端同源。
- `DATA_ENCRYPTION_KEY` / `TOKEN_HASH_KEY`：分别生成独立随机 32 byte 的十六进制值，放入腾讯云批准的密钥管理或环境变量。备份密钥另行生成，不能复用。
- `DATABASE_SSL=true` 与 `DATABASE_CA_PEM`：生产环境要求证书校验，不支持跳过证书验证。
- `DATA_MODE=mock`，`LAUNCH_APPROVED=false`：测试默认值，保持模拟数据。
- `TRUST_PROXY_HOPS`：默认 0。核验 CloudBase 可信代理层数和覆盖客户端转发头行为后才能配置，防止客户端伪造 IP 绕过限流。没有核验前不得开放真实入口。
- `RETENTION_DAYS=90`：上线前确认实际期限及每日清理计划。

管理员由隔离的初始化操作端创建：

```sh
pnpm admin:create
```

交互输入用户名和至少 16 字符密码（不回显）。脚本生成 TOTP 导入文件于 `.local/`，导入离线验证器后删除文件。生产禁止复用本地模拟账号。管理员停用和密码重置仅由受控数据库操作端完成；停用 `admin_users.active` 后每次请求重新验证，会话立即失效。重置时撤销该管理员所有 sessions。

## 4. 构建和部署：应用发布已获授权，资源前提待完成

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
# 有 Docker 的授权环境中测试 amd64 镜像
# docker build --platform linux/amd64 -t renzhen-beta:test .
```

本机未安装 Docker，容器构建尚未执行。Dockerfile 使用 Node 22，多阶段构建，不以 root 运行服务，镜像不包含 `.env`、`.local` 或测试数据库。npm 默认国内镜像；Node 基础镜像可用 `NODE_IMAGE` 指向批准的腾讯 TCR 官方镜像副本，不使用未经核验的镜像。

推荐使用 CLI `tcb cloudrun deploy --source /absolute/path/to/renzhen` 上传自己的本地源码，或使用批准的 TCR 镜像部署。CLI 3.8.5 的 `--source`、`--service-name` 和 `--port` 参数已通过实际帮助输出核验，但完整发布仍需本节的数据库、网络和环境变量前提。控制台的 Git 部署入口会要求远程仓库地址；如果选此入口，需要先把干净项目源码放入自己控制的仓库。`cloudbaserc.example.json` 是框架插件参考配置，不能未经核验当作当前 CLI 的完整发布配置。没有执行云端构建或发布，不声称部署成功。

1. 部署模拟模式服务，健康检查 `/api/health`；确认数据库连接和启动安全自检。
2. 核验 HTTPS 公网访问开关及默认测试域名的可访问政策。采用**实际返回的**服务地址填写 `APP_ORIGIN`，更新配置再测试来源校验和 Cookie。
3. 管理员登录，检查初始草稿，发布问卷。
4. 使用各自浏览器模拟填写，后台确认新提交，重启实例再次读取，运行双账号越权测试。
5. 完成云备份、恢复、每日过期清理和审计告警验证。

## 5. 域名、HTTPS 和备案：需要用户人工办理

[腾讯云备案场景](https://cloud.tencent.com/document/product/243/18910)、[首次备案](https://cloud.tencent.com/document/api/243/37402)。根据主体、地区和服务内容核验首次或接入备案要求，不以免费测试域名作为规避备案的办法。购买域名、实名核验和提交备案均由用户操作。

1. 准备运营主体及合法域名，核验上海首轮服务内容是否适用于所选备案主体类型。
2. 办理首次/接入 ICP 备案，按当地规则核验公安联网备案等后续要求；未完成所需备案不开放正式入口。
3. 在服务中绑定域名及受信任 HTTPS 证书，按照控制台给出的 DNS 目标配置解析。禁止凭空猜 CNAME。
4. 设置 `APP_ORIGIN=https://实际域名`，核验 HTTP 访问跳转 HTTPS、证书有效、Secure Cookie 和 HSTS。服务端由可信 CloudBase HTTPS 网关暴露，容器 HTTP 端口不得直接公开。
5. 将核验后的真实备案号通过 `ICP_RECORD` 配置显示在页面页脚，并链接工信部查询网站。尚无号码时不显示伪造号码。

## 6. 自动清理与备份

`pnpm retention` 删除过期用户及级联记录，撤销过期会话并清理限流、180 天前审计。部署前在境内受控任务执行环境安装 Node 和依赖，配置仅 `rr_runtime` URL；安排每天 Asia/Shanghai 03:00 执行，失败告警并检查最近成功时间。当前未创建腾讯云定时任务。若用云托管触发器，需核验支持的任务执行方式；不要向公网暴露无认证清理接口。

补充逻辑快照工具直接使用 PostgreSQL 事务，无须 pg_dump。它把上述业务表、管理员和规则版本抓取成一致的加密快照；schema 由迁移重建。首轮限制每表 10,000 行、文件 100 MB。此工具不替代平台物理备份/PITR。

```sh
pnpm backup ./approved-backups/snapshot.enc
# 恢复前暂停所有写入；导出最新台账，不能只用旧备份同一时刻的台账
pnpm restore export-ledger ./approved-backups/latest-ledger.enc
# 在全新隔离库先用 MIGRATION_DATABASE_URL 执行迁移，再设置不同的 RESTORE_DATABASE_URL
pnpm restore restore ./approved-backups/snapshot.enc ./approved-backups/latest-ledger.enc
```

操作端需单独的 `BACKUP_DATABASE_URL`、`BACKUP_ENCRYPTION_KEY`、可信 CA 和原 `TOKEN_HASH_KEY`。恢复要求 `RESTORE_ISOLATED_CONFIRMED=true`、不同于线上/备份/迁移 URL 的隔离库、最近 1 小时导出且晚于快照的台账。上线前确认新库、迁移完成，不能在服务运行的库操作。恢复在单事务中重放删除/撤回、删除过期数据、撤销所有会话、暂停问卷；恢复后检验再切流量。

备份输出加密，0600；备份放在中国大陆批准的私有存储，单独权限和生命周期（默认方案 7 天，需人工确认），密钥独立安全保管。平台备份周期也必须匹配已告知规则。删除台账需在恢复前从当前活跃库或批准的独立持续记录取得，并保留时间覆盖最长备份；如活跃库丢失且没有比快照更新的可靠删除记录，**禁止开放恢复库给真实用户**，先人工核验删除请求。TOKEN_HASH_KEY 在所有相关备份过期前不能直接替换。

## 7. 公网地址与二维码

云端成功后记录实际：

- 用户端：`https://实际部署域名/`
- 管理员：`https://实际部署域名/admin`

这些当前都是待核验模板，尚不存在已确认的公网 URL。

```sh
pnpm qr https://实际部署域名/ ./questionnaire-qr.png
```

二维码脚本只接受根路径、无凭证参数、非本机/私网的公网 HTTPS 地址，并检查 HTTP 成功状态。管理员概览页也可生成当前实际公网入口二维码；本机模式会拒绝生成。不存在一次性邀请码。

真实数据启用应使用独立、干净的生产环境，不把本地或云端模拟数据拷入生产。服务端也按 mock/real 模式隔离用户认证、恢复及候选匹配，避免混合介绍。备份恢复只接受空的已迁移隔离库，拒绝覆盖现有用户、管理员或会话。
