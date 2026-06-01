# 智能人事系统架构说明

## 1. 总体拓扑

系统采用单仓库双应用结构：

- `apps/api`：基于 NestJS 的后端服务，提供 REST 接口和 WebSocket 事件。
- `apps/web`：基于 React 和 Vite 的前端应用，面向系统管理员、人力资源管理员、部门经理、员工和候选人。

支撑基础设施：

- PostgreSQL 16：存储事务型人力资源数据。
- Redis：保存会话片段、聊天记忆和看板缓存。
- 本地文件存储：默认挂载在 `uploads`，用于简历、合同和工资单文件。
- Docker Compose：编排本地完整服务。

## 2. 后端分层

### 接口层

NestJS 控制器按资源和业务场景暴露接口，覆盖：

- 组织和员工生命周期管理
- 招聘流程管理
- 考勤、请假和加班管理
- 绩效管理
- 薪酬和工资单管理
- 员工自助服务
- 智能助手执行
- 知识中心治理

### 应用层

每个业务域都有独立服务，负责：

- 增删改查编排
- 跨表业务规则
- 按角色裁剪数据范围
- 文件上传和下载集成
- 薪酬计算和异常识别
- 文档治理和本地检索

### 基础设施层

基础设施服务包括：

- TypeORM 仓储访问 PostgreSQL
- Redis 缓存和会话服务
- 本地上传文件存储服务
- 访问令牌认证和角色守卫
- 实时智能助手 WebSocket 网关
- 基于 Markdown frontmatter 的本地知识文档治理

## 3. 前端分层

### 应用外壳

前端使用响应式 `AppLayout`，结合 Ant Design 导航和 Tailwind 样式组织页面布局、间距和面板视觉。

### 状态和数据

- Zustand 保存登录用户和访问令牌。
- 统一的请求客户端集中处理请求头、鉴权和错误提示。
- 通用资源页由配置驱动，保证组织、招聘、考勤、绩效和薪酬等模块的体验一致。

### 功能页面

- 管理端页面：管理组织数据、招聘、考勤、绩效和薪酬。
- 员工自助看板：查看个人资料、提交请假和加班、查看工资单和假期余额。
- 知识中心：维护知识条目、托管制度文档、结构化公司信息和检索诊断。
- 招聘工作台：查看招聘看板、候选人优先级、简历解析和面试邀请。
- 候选人门户：候选人注册、查看个人投递和下载简历。

## 4. 智能助手链路

平台内置四类智能助手：

1. 招聘助手
2. 员工服务助手
3. 绩效分析助手
4. 离职风险预警助手

执行流程：

1. 前端通过 REST 接口或 WebSocket 事件发起请求。
2. 后端控制器或网关校验用户身份、角色和请求参数。
3. 领域服务暴露可调用工具，并提供必要的业务数据。
4. 工具调用执行后组合最终回答。
5. 当 `AI_PROVIDER=mock` 或模型密钥不可用时，系统使用确定性规则回退。
6. 必要结果会写入 Redis，并返回给前端。

### Agent 控制面：AgentOrchestratorService

所有智能助手均通过 `AgentOrchestratorService` 统一运行，该服务承担以下职责：

1. **模型 provider 解析**（`resolveAiRuntime()`）：按 `AI_PROVIDER` 环境变量选择 provider。
   - `AI_PROVIDER=deepseek`：仅使用 `DEEPSEEK_API_KEY`，不回落到 OpenAI key。
   - `AI_PROVIDER=openai`：仅使用 `OPENAI_API_KEY`。
   - `AI_PROVIDER=auto`（默认）：优先 DeepSeek（需 `DEEPSEEK_API_KEY`），其次 OpenAI（需 `OPENAI_API_KEY`），否则 mock。
   - `AI_PROVIDER=mock`：强制使用确定性规则回退，即使环境中存在模型密钥。
2. **带 trace 运行**（`runAgentWithTrace()`）：返回 `{ output, trace }`，trace 包含运行模式、provider、model、工具列表、延迟和回退原因。
3. **兼容运行**（`runAgentOrFallback()`）：内部调用 `runAgentWithTrace()`，只返回字符串，保持现有调用兼容。
4. **本地规则 trace**（`buildGroundedTrace()`）：供员工服务本地知识命中时生成 `grounded` 模式 trace。

### 运行元数据字段（AgentRunTrace）

每次智能助手调用会附加 `aiTrace` 字段，供可观测性和审计使用：

| 字段 | 说明 |
|---|---|
| `mode` | `llm`（真实模型调用）、`fallback`（确定性回退）、`grounded`（本地知识命中） |
| `provider` | `openai`、`deepseek`、`mock`、`local` |
| `model` | 使用的模型名称 |
| `toolNames` | 本次调用注册的工具列表 |
| `latencyMs` | 端到端延迟（毫秒） |
| `generatedAt` | ISO 8601 时间戳 |
| `fallbackReason` | 回退原因：`mock_provider`、`missing_api_key`、`llm_error`、`grounded_answer` |
| `errorMessage` | 模型调用异常时的错误摘要（不含密钥等敏感信息） |

### Agent 运行台账

系统会将主要智能体调用写入 `agent_run_logs`，用于运营、排障和审计复核。台账只保存运行元数据和短摘要，不保存完整原始输入、完整简历、薪酬明细或完整风险解释。

- 写入范围：招聘解析、招聘匹配、面试邀约、员工服务问答、绩效分析、单员工离职风险预测。
- 查询接口：`GET /api/agent/runs`，限 `admin` 和 `hr` 角色访问。
- 查询能力：按智能体类型、动作、运行模式、provider、回退原因和业务主体过滤。
- 前端入口：管理端侧边栏的“智能体运行”，展示回退比例、平均延迟、provider 分布、智能体分布和最近调用明细。

### 知识中心和本地检索增强

- 员工服务助手会检索两类内部知识：
  - PostgreSQL 中的结构化知识条目
  - `docs/` 下的 Markdown 文档
- 员工服务助手还会使用结构化公司信息中心，稳定回答办公、作息、福利、组织、运营和安全问题。
- 托管知识文档通过 `/api/knowledge-management/documents` 编辑，并存储在：
  - `docs/policies/managed`
  - `docs/company/managed`
- 导入的制度或公司资料会先经过 `/api/knowledge-management/document-imports/preview` 清洗为 Markdown，再进入治理流程。
- 结构化公司信息通过 `/api/knowledge-management/company-facts` 管理，持久化到 `docs/company/managed/company-facts.json`，并自动同步为生成文档。
- 托管文档的 frontmatter 保存状态、版本、负责人、生效日期、审核备注、标签等元数据。
- 本地检索索引包含：
  - `docs/company` 和 `docs/policies` 下的静态 Markdown 文档
  - 状态为 `published` 且已生效的托管文档
- 每次托管文档更新都会在 `docs/.history/...` 下保存历史快照，用于审阅和差异比较，不进入实时检索。
- 已发布公司信息会物化为托管 Markdown 文档，和其他公司知识采用同一检索路径。
- 草稿、审核中和归档文档仅在知识中心管理界面可见，不会被员工服务助手引用。
- 知识中心提供文档检索诊断功能，方便人力资源管理员验证关键词是否命中目标文档。

## 5. 安全模型

- 基于访问令牌的身份认证
- 角色权限：`admin`、`hr`、`manager`、`employee`、`candidate`
- 通过 NestJS 守卫执行路由级授权
- 薪酬敏感字段按权限脱敏
- 密码使用加盐 `scrypt` 哈希保存
- 上传文件按扩展名和内容类型限制

## 6. 部署说明

- PostgreSQL 通过 `infra/postgres/*.sql` 初始化表结构和种子数据。
- `docker-compose.yml` 可启动本地完整服务。
- 前端构建为静态资源后由 Nginx 提供服务。
- 后端提供接口、WebSocket、上传文件访问和知识库读取能力。
- 生产部署时需要确保 `docs` 和 `uploads` 目录随后端容器一起提供或挂载。
