# 智能人事系统

面向企业人力资源场景的一体化管理系统，内置招聘筛选、员工服务问答、绩效分析和离职风险预警等智能能力。

## 功能范围

- 组织、岗位、员工档案和劳动合同管理
- 招聘岗位、候选人、简历、面试和录用通知管理
- 考勤、请假、加班和审批流转
- 绩效周期、绩效目标和绩效评审
- 薪酬配置、工资生成和工资单发放
- 员工自助看板、资料变更、假期余额和工资单下载
- 知识中心、托管制度文档、结构化公司信息和本地检索增强问答
- 基于工具调用的智能助手，并提供确定性规则回退能力
- 访问令牌认证、角色权限控制和敏感薪酬字段脱敏
- PostgreSQL、Redis 和 Docker Compose 本地部署支持

## 技术栈

- 前端：React、TypeScript、Vite、Ant Design、Tailwind CSS
- 后端：Node.js、NestJS、TypeORM、REST 接口、WebSocket
- 数据库：PostgreSQL 16
- 缓存和会话：Redis 7
- 智能运行时：LangChain.js，可接入 DeepSeek、OpenAI 或兼容模型服务
- 文件存储：默认使用本地 `uploads` 目录；仅用户头像目录对前端静态访问开放
- 部署方式：Docker 和 Docker Compose

## 项目结构

```text
hr-agent-system/
|-- apps/
|   |-- api/               # NestJS 后端服务
|   `-- web/               # React 前端应用
|-- docs/                  # 知识库、制度文档和架构说明
|-- infra/
|   |-- nginx/             # 前端静态服务和接口代理配置
|   `-- postgres/          # 数据库初始化和种子数据
|-- scripts/               # 样例文件准备和全流程验证脚本
|-- docker-compose.yml
`-- README.md
```

## 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本
- Docker Desktop 4.x 或更高版本

## Docker 快速启动

1. 复制环境变量：

```bash
cp .env.example .env
```

2. 启动完整服务：

```bash
docker compose up --build
```

3. 打开系统：

- 前端：`http://localhost:8080`
- 后端接口：`http://localhost:3000/api`
- 用户头像：`http://localhost:3000/uploads/user-photos/...`
- 合同、工资单和简历等敏感附件需通过带访问令牌的下载接口获取，不提供公开直链。

PostgreSQL 容器会自动执行：

- `infra/postgres/init.sql`
- `infra/postgres/seed.sql`

## 本地开发

1. 复制环境变量：

```bash
cp .env.example .env
```

2. 只启动基础设施：

```bash
docker compose up postgres redis -d
```

3. 安装依赖：

```bash
npm install
```

4. 启动后端：

```bash
npm run dev:api
```

5. 另开终端启动前端：

```bash
npm run dev:web
```

6. 打开：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3000/api`

## 数据库初始化

- 首次 Docker 启动会自动初始化表结构和种子数据。
- 如需手动初始化，可执行：

```bash
psql -h localhost -U hr_admin -d hr_agent -f infra/postgres/init.sql
psql -h localhost -U hr_admin -d hr_agent -f infra/postgres/seed.sql
```

`init.sql` 包含所有业务表和支撑表，例如：

- `users`
- `knowledge_base_articles`
- `profile_change_requests`

## 知识中心和本地检索增强

- `/knowledge-center` 汇总员工服务知识条目、制度文档来源和托管知识文档。
- 知识中心包含结构化公司信息工作区，可维护办公地点、工作时间、福利、组织服务、运营节奏和安全要求。
- 托管文档存储在：
  - `docs/policies/managed`
  - `docs/company/managed`
- 知识管理员可以导入 `pdf`、`docx`、`md` 和 `txt` 文件，先生成清洗预览，再保存为受治理的托管文档。
- 结构化公司信息存储在 `docs/company/managed/company-facts.json`，并自动渲染为 `docs/company/managed/company-facts-center.md`。
- 托管文档通过 Markdown frontmatter 保存治理元数据，例如状态、版本、负责人、生效日期和审核备注。
- 托管文档更新会在 `docs/.history/...` 下保留文件级历史快照，用于知识中心的审阅和差异比较。
- 只有状态为 `published` 且已到生效日期的托管文档会进入员工服务问答检索。
- 只有状态为 `published` 的结构化公司信息会同步到生成文档，并对员工服务助手可见。
- `docs/company` 和 `docs/policies` 下的静态种子文档仍作为兼容知识来源保留，直到迁移进托管文档池。
- 人力资源管理员可以通过文档检索诊断功能验证某个标题、关键词或问题是否命中预期文档。

## 环境变量

`.env.example` 中的关键变量：

- `DATABASE_URL`：后端连接 PostgreSQL 的地址
- `REDIS_URL`：Redis 连接地址
- `JWT_SECRET`：访问令牌签名密钥
- `FILE_STORAGE_ROOT`：上传文件根目录，默认是 `uploads`
- `AI_PROVIDER`：可设置为 `auto`、`deepseek`、`openai` 或 `mock`
- `DEEPSEEK_API_KEY`：DeepSeek 访问密钥
- `DEEPSEEK_MODEL`：DeepSeek 模型名称，默认 `deepseek-chat`
- `DEEPSEEK_BASE_URL`：DeepSeek 兼容接口地址，默认 `https://api.deepseek.com`
- `OPENAI_BASE_URL`：可选的 OpenAI 兼容网关地址
- `OPENAI_API_KEY`：使用 OpenAI 模式时需要配置
- `OPENAI_MODEL`：OpenAI 模型名称

如果希望内置智能助手使用 DeepSeek，可配置：

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your-key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

`AI_PROVIDER=auto` 也可用。该模式会优先使用 DeepSeek 密钥，其次使用 OpenAI 密钥；如果没有可用密钥，则启用确定性规则回退。

## 测试账号

所有种子账号的默认密码：`admin123`

| 角色 | 用户名 | 邮箱 |
| --- | --- | --- |
| 系统管理员 | `admin` | `admin@company.local` |
| 人力资源管理员 | `hr_admin` | `hr@company.local` |
| 部门经理 | `manager_zhang` | `zhang@company.local` |
| 员工 | `employee_li` | `li@company.local` |

## 智能接口

招聘助手：

- `POST /api/agent/recruitment/parse-resume`
- `POST /api/agent/recruitment/match-score`
- `POST /api/agent/recruitment/generate-interview-email`

员工服务助手：

- `POST /api/agent/employee-service/chat`
- `GET /api/agent/employee-service/knowledge-base`
- `GET /api/agent/employee-service/knowledge-sources`
- WebSocket 命名空间：`/agents`
- 请求事件：`employee-service:message`
- 回复事件：`employee-service:reply`

知识管理：

- `GET /api/knowledge-management/articles`
- `POST /api/knowledge-management/articles`
- `PATCH /api/knowledge-management/articles/:id`
- `DELETE /api/knowledge-management/articles/:id`
- `GET /api/knowledge-management/documents`
- `GET /api/knowledge-management/documents/:id`
- `GET /api/knowledge-management/documents/:id/history`
- `GET /api/knowledge-management/documents/:id/diff?historyId=...`
- `POST /api/knowledge-management/documents`
- `PATCH /api/knowledge-management/documents/:id`
- `DELETE /api/knowledge-management/documents/:id`
- `POST /api/knowledge-management/document-imports/preview`
- `GET /api/knowledge-management/diagnostics/document-search?query=...`
- `GET /api/knowledge-management/company-facts`
- `GET /api/knowledge-management/company-facts/:id`
- `POST /api/knowledge-management/company-facts`
- `PATCH /api/knowledge-management/company-facts/:id`
- `DELETE /api/knowledge-management/company-facts/:id`

绩效分析：

- `POST /api/agent/performance/analyze`
- `GET /api/agent/performance/insights`

离职风险：

- `GET /api/agent/attrition/predict`
- `GET /api/agent/attrition/high-risk-list`

## 重要行为

- 薪酬相关接口会对无权限访问者隐藏敏感金额。
- 员工自助接口始终以当前登录员工为上下文。
- 简历上传支持 PDF 和 DOCX 文件。
- 智能助手优先使用模型工具调用；模型不可用时会使用确定性规则回退，保证核心流程可用。
- 草稿、审核中和归档状态的托管文档不会进入员工服务问答检索。

## 验证命令

```bash
npm run lint
npm run build
node scripts/verify-full-flow.js
```
