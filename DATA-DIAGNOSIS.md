# HR Agent System — 数据驱动诊断报告

**日期**: 2026-05-04  
**方法**: 日志分析 + 代码审计 + 验证脚本覆盖度 + 现有数据结构审查

---

## 一、现有数据源清单

| 数据源 | 位置 | 能回答的问题 |
|--------|------|-------------|
| `api.err.log` | 项目根目录 | 运行时错误、连接失败 |
| `api.runtime.err.log` | 项目根目录 | 编译警告、弃用提示 |
| `api.e2e.err.log` | 项目根目录 | E2E 测试失败原因 |
| `audit_logs` 表 | PostgreSQL | 谁在什么时候做了什么 |
| `verify-full-flow.js` | scripts/ | 19 个资源端点 × CRUD + 4 种角色 + 看板 + 知识库 + AI |
| `verify-robustness.js` | scripts/ | 路径遍历防护、伪造文件拒绝、局部更新 |
| `verify-surface.js` | scripts/ | 前端路由 + 列表/详情/选项源/下载全覆盖 |
| seed.sql | infra/postgres/ | 初始数据量、部门/岗位/员工/用户分布 |

---

## 二、已发现的硬伤（按严重度排序）

### P0 — 线上会炸

| # | 问题 | 证据 | 影响 |
|---|------|------|------|
| 1 | **Redis 连接 ECONNREFUSED 大量刷屏** | `api.err.log` 全文 144 行全是 `ioredis Unhandled error event: AggregateError [ECONNREFUSED]` | 无 Redis 时 session/login-failure/缓存全部失效；日志风暴会吃满磁盘 |
| 2 | **Zod `.optional()` 不兼容 OpenAI structured output** | `api.e2e.err.log:33-42` 5 个 warning：`uses .optional() without .nullable()` | DeepSeek 可能忽略，但 OpenAI provider 会直接报错；AI 功能在 OpenAI 模式下不可用 |
| 3 | **E2E 脚本 PowerShell 环境变量语法错误** | `api.e2e.err.log:1-31` 全是 `=mock : 无法识别` | CI/CD 跑不起来，E2E 形同虚设 |

### P1 — 体验差

| # | 问题 | 证据 | 影响 |
|---|------|------|------|
| 4 | **审计日志 fire-and-forget，失败静默吞掉** | `audit.service.ts:26` `.catch(() => {})` | 审计丢失无感知，合规风险 |
| 5 | **文件上传目录在容器内 mkdir 但无持久化卷** | Dockerfile `RUN mkdir -p uploads` 但 docker-compose 只挂载 `./uploads:/app/uploads` | 首次部署时宿主机目录不存在会创建空目录，但 CI/CD 场景可能丢失 |
| 6 | **`NODE_ENV` 未在 docker-compose 设置** | `docker-compose.yml` api 服务无 `NODE_ENV=production` | 安全头、JWT 校验、错误详细度全部走开发分支 |

### P2 — 技术债

| # | 问题 | 证据 | 影响 |
|---|------|------|------|
| 7 | **`synchronize: false` 但无 migration runner** | `app.module.ts:40` + 手动 SQL 文件 | 新环境部署需要手动跑 SQL，容易遗漏 |
| 8 | **`require('dotenv')` 在 ESM 模式下的 fallback** | `config/env.ts:21` 动态 require | Node 22+ 可能移除 `process.loadEnvFile`，fallback 失效 |
| 9 | **覆盖索引 migration 未在 seed.sql 中** | seed.sql 在 init.sql 之前执行 | 新部署 seed 数据不在覆盖索引内，首次查询慢 |

---

## 三、已有的验证覆盖度

### verify-full-flow.js 覆盖的场景（1251 行）

```
✓ 4 种角色登录 + /auth/me
✓ 25 个前端路由可达性
✓ 19 个资源端点 CRUD
✓ 看板（管理/员工视角）
✓ 招聘看板 + 部门树 + 考勤异常
✓ 员工自助（假期余额、工资单、资料变更）
✓ 知识库 + 文档管理 + 公司事实
✓ 绩效洞察 + 离职风险预测
✓ 简历上传 + 知识文档导入预览
✓ 文件下载（工资单、合同、简历）
✓ 未授权下载拒绝
✓ AI 聊天 + RAG 来源验证
```

### verify-robustness.js 覆盖的场景（202 行）

```
✓ 路径遍历攻击（../../README.md）
✓ URL 编码绕过（%2F 逃逸）
✓ 无效 UTF-8 路径
✓ 伪造 PDF 文件头拒绝
✓ 伪造 DOCX 文件头拒绝
✓ 登录 → 注销 → 令牌失效链路
✓ 部门/岗位 PATCH 局部更新
```

### 未覆盖的盲区

| 盲区 | 风险 |
|------|------|
| **并发写入** | 两人同时编辑同一员工会怎样？ |
| **大文件上传** | 15MB 简历 + 20MB 文档的实际耗时？ |
| **Redis 断连降级** | 内存缓存降级后 TTL 是否正确？ |
| **试用期到期自动处理** | 到期后是否自动锁定？还是只读？ |
| **WebSocket 断线重连** | AI 聊天断线后 history 是否丢失？ |
| **多租户隔离** | A 公司用户能否访问 B 公司数据？ |

---

## 四、数据采集建议

### 立即可做（无需改代码）

```bash
# 1. 跑一遍 full-flow 验证，拿到基线数据
HR_DEMO_PASSWORD=<password> node scripts/verify-full-flow.js

# 2. 跑一遍 robustness 验证
HR_DEMO_PASSWORD=<password> node scripts/verify-robustness.js

# 3. 跑一遍 surface 验证（需要前端运行）
HR_DEMO_PASSWORD=<password> node scripts/verify-surface.js

# 4. 查审计日志分布
docker exec hr-agent-postgres psql -U hr_admin -d hr_agent -c \
  "SELECT action, COUNT(*) FROM audit_logs GROUP BY action ORDER BY count DESC;"

# 5. 查用户/员工数据量
docker exec hr-agent-postgres psql -U hr_admin -d hr_agent -c \
  "SELECT company_id, COUNT(*) as users FROM users GROUP BY company_id;"
docker exec hr-agent-postgres psql -U hr_admin -d hr_agent -c \
  "SELECT company_id, employment_status, COUNT(*) FROM employees GROUP BY company_id, employment_status;"
```

### 需要小幅改造

| 数据点 | 改造方式 | 工作量 |
|--------|---------|--------|
| API 响应时间 | 在 `rateLimitMiddleware` 中加 `response.on('finish')` 计时 | 15min |
| 慢查询日志 | PostgreSQL `log_min_duration_statement = 500` | 5min |
| Redis 命中率 | `redis-cli INFO stats` 或在 RedisService 加计数器 | 10min |
| AI 调用耗时 | 在 `runAgentOrFallback` 中记录 start/end | 10min |
| 文件上传大小分布 | 在 StorageService 加日志 | 5min |

---

## 五、下一步行动优先级矩阵

| 行动 | 痛点得分 | 实施成本 | 建议优先级 |
|------|---------|---------|-----------|
| **修复 Redis 降级日志风暴** | 🔴 10 | 15min | **立即** |
| **修复 Zod `.optional()` → `.nullable()`** | 🔴 8 | 30min | **立即** |
| **docker-compose 加 `NODE_ENV=production`** | 🟡 7 | 1min | **立即** |
| **添加 migration runner** | 🟡 7 | 2h | 本周 |
| **审计日志失败告警** | 🟡 6 | 30min | 本周 |
| **API 响应时间中间件** | 🟡 6 | 15min | 本周 |
| **并发写入测试** | 🟡 5 | 2h | 下周 |
| **多租户隔离测试** | 🔴 9 | 3h | 下周 |
| **大文件上传压测** | 🟡 4 | 1h | 下周 |
| **WebSocket 断线重连测试** | 🟡 4 | 2h | 下周 |

---

## 六、关键指标基线（待采集）

| 指标 | 当前值 | 目标值 | 数据来源 |
|------|--------|--------|---------|
| API P50 延迟 | ❓ | <200ms | 待加中间件 |
| API P99 延迟 | ❓ | <1s | 待加中间件 |
| 全量验证通过率 | ❓ | 100% | verify-full-flow |
| 审计日志完整性 | ❓ | 100% | audit_logs 查询 |
| Redis 命中率 | ❓ | >80% | redis-cli INFO |
| AI 调用成功率 | ❓ | >95% | agent.service 日志 |
| 文件上传成功率 | ❓ | >99% | storage.service 日志 |
