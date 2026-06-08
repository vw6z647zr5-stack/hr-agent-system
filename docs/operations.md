# 基础商用试点运维手册

本文档用于单机或小团队试点部署。它不替代正式生产运维体系，但覆盖基础商用前必须具备的启动、验收、备份和恢复入口。

## 运行前检查

1. 确认依赖：

```bash
node --version
npm --version
docker --version
docker compose version
```

2. 检查配置：

```bash
npm run verify:commercial
```

该命令会检查 `.env`、Docker Compose 配置、密钥强度、数据库和 Redis 地址、API 健康检查配置。服务已启动后可追加 live 检查：

```bash
npm run verify:commercial -- --live
```

3. 必须替换的配置：

- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- 生产或试点账号初始密码
- 如需真实 AI 能力，配置 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`

## 启动方式

本地试点推荐使用桌面脚本或根目录命令：

```bash
npm start
```

首次运行时，启动脚本会在缺少 `.env` 时自动生成随机密钥配置，启动 PostgreSQL/Redis，并执行 `npm run migrate:bootstrap` 对齐数据库结构和迁移记录。

Docker 完整部署：

```bash
docker compose up --build -d
docker compose ps
npm install
npm run migrate:bootstrap
```

默认宿主机端口：

- Web: `http://127.0.0.1:5173`，Docker 版为 `http://127.0.0.1:8080`
- API: `http://127.0.0.1:3000/api`
- PostgreSQL: `127.0.0.1:15432`
- Redis: `127.0.0.1:16379`

## 数据库迁移

迁移文件位于 `infra/postgres/migrations/`，迁移状态记录在 `schema_migrations` 表中。先查看当前状态：

```bash
npm run migrate:status
```

需要真正执行待处理迁移时使用：

```bash
npm run migrate:bootstrap
npm run migrate:up
```

如果数据库已经通过当前 `init.sql` 和 `seed.sql` 初始化到最新结构，但还没有迁移记录，可以补写基线：

```bash
npm run migrate:baseline
```

`bootstrap` 是日常推荐命令，会跳过已经由 `init.sql` 满足的早期结构转换，并执行仍待处理的幂等迁移。`baseline` 只写入迁移记录，不执行 SQL；旧结构数据库应使用 `migrate:bootstrap` 或 `migrate:up` 升级。

## 健康检查

后端提供两个公开健康端点：

- `GET /api/health/live`：进程存活检查，不做依赖探测。
- `GET /api/health/ready`：就绪检查，验证数据库和上传存储可用，并报告 Redis 状态。

Docker API 容器健康检查已绑定到 `/api/health/ready`。本地排查可执行：

```bash
curl http://127.0.0.1:3000/api/health/live
curl http://127.0.0.1:3000/api/health/ready
```

## 请求链路排查

API 会为每个请求返回 `X-Request-Id`。前端、接口错误响应、限流响应、后端日志和审计 metadata 会使用同一个 `requestId`，便于把用户截图、接口日志和数据库异常对应到同一次操作。

排查线上问题时先记录响应头或错误响应中的 `requestId`，再按该值检索 API 日志和 `audit_logs.metadata`。

## 验收命令

基础静态和构建验收：

```bash
npm run verify
```

发布候选验收：

```bash
npm run release:check
```

服务启动后的业务流验收：

```bash
set HR_DEMO_PASSWORD=admin123
npm run verify:full
```

如果试点环境使用了自定义地址：

```bash
set VERIFY_API_BASE=http://127.0.0.1:3000/api
set VERIFY_WEB_BASE=http://127.0.0.1:5173
npm run verify:full
```

服务已启动时可以让发布候选验收追加在线检查：

```bash
npm run release:check -- --live
```

需要把完整业务流也纳入发布门禁时：

```bash
set HR_DEMO_PASSWORD=admin123
npm run release:check -- --live --full
```

## 备份

执行本地备份：

```bash
npm run backup:local
```

备份会写入 `backups/<timestamp>/`，包含：

- `database.dump`：PostgreSQL 自定义格式备份。
- `uploads/`：上传文件。
- `docs/company/managed/`：结构化公司资料。
- `docs/policies/managed/`：托管制度文档。
- `docs/.history/`：托管文档历史快照。
- `manifest.json`：备份清单。

建议至少每日备份一次，并将 `backups/` 复制到机器外部存储。

## 恢复

恢复前先停止业务写入，并再次做一次当前备份。

默认只演练恢复计划，不修改任何数据：

```bash
npm run restore:local -- backups/<timestamp>
```

确认恢复：

```bash
npm run restore:local -- backups/<timestamp> --confirm-restore
```

恢复脚本会先自动执行一次当前数据安全备份，再恢复数据库和文件。只恢复文件或只恢复数据库时可使用：

```bash
npm run restore:local -- backups/<timestamp> --confirm-restore --files-only
npm run restore:local -- backups/<timestamp> --confirm-restore --database-only
```

数据库恢复示例：

```bash
docker cp backups/<timestamp>/database.dump hr-agent-postgres:/tmp/hr-agent-restore.dump
docker compose exec postgres pg_restore -U hr_admin -d hr_agent --clean --if-exists --no-owner --no-acl /tmp/hr-agent-restore.dump
```

文件恢复示例：

```bash
robocopy backups\<timestamp>\uploads uploads /MIR
robocopy backups\<timestamp>\docs\company\managed docs\company\managed /MIR
robocopy backups\<timestamp>\docs\policies\managed docs\policies\managed /MIR
robocopy backups\<timestamp>\docs\.history docs\.history /MIR
```

恢复完成后执行：

```bash
npm run verify:commercial -- --live
```

## 故障排查

- Docker 不可用：先确认 Docker Desktop 服务已启动，再执行 `docker info`。
- 数据库认证失败：确认 `.env` 的 `DATABASE_URL` 使用 `127.0.0.1:15432`，且容器内 `POSTGRES_PASSWORD` 与 `.env` 一致。
- API 未就绪：优先查看 `/api/health/ready` 返回的 `checks.database`、`checks.storage` 和 `checks.redis`。
- Redis 异常：系统会降级到进程内缓存，但多实例部署前必须恢复 Redis。
- AI 不可用：`AI_PROVIDER=auto` 会启用确定性规则回退；真实商用智能能力需要配置模型密钥。
