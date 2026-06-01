# 需求确认：Agent 运行契约与可观测性优化

## 背景

`hr-agent-system` 已经具备招聘、员工服务、绩效分析、离职风险和主动洞察等多个智能体能力。当前系统的主要问题不是缺少业务模块，而是 Agent 运行链路缺少统一、可审计、可排障的执行契约。

## 本轮目标

1. 保持现有 REST/WebSocket API 兼容，不破坏前端现有字段。
2. 在 Agent 编排层增加统一运行结果契约，能够区分：
   - 真实模型调用
   - 缺少模型密钥或 mock 模式导致的确定性回退
   - 模型调用异常后的确定性回退
   - 员工服务本地知识命中后的规则化回答
3. 修正 AI provider 选择逻辑，避免 `AI_PROVIDER=deepseek` 时误用 `OPENAI_API_KEY` 作为 DeepSeek 密钥。
4. 让主要 Agent 响应返回可观测元数据，例如 provider、model、mode、fallbackReason、latencyMs、toolNames。
5. 补充架构说明，方便后续扩展模型治理、审计和运营看板。

## 非目标

1. 不新增数据库表或迁移。
2. 不改前端页面。
3. 不引入新的 LLM SDK 或外部服务。
4. 不重写业务智能体算法。
5. 不打印或暴露任何 API key。

## 约束

1. 只修改 Agent 后端与必要文档。
2. 保留 `runAgentOrFallback()` 的字符串返回行为，避免大面积破坏现有调用。
3. 新增的可观测字段应为附加字段，不删除现有字段。
4. 运行验证至少包含 `npm run build:api`。
