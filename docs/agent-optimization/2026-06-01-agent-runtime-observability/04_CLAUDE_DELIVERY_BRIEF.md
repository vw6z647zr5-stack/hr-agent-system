# Claude 交付 Brief

你是本项目的实现工程师。请严格按本目录下的 `01_REQUIREMENTS.md`、`02_SOLUTION_PLAN.md` 和 `03_ACCEPTANCE_CRITERIA.md` 修改代码。

## 必须先阅读

1. `apps/api/src/agents/services/agent-orchestrator.service.ts`
2. `apps/api/src/agents/services/recruitment-agent.service.ts`
3. `apps/api/src/agents/services/employee-agent.service.ts`
4. `apps/api/src/agents/services/performance-agent.service.ts`
5. `apps/api/src/agents/services/attrition-agent.service.ts`
6. `docs/architecture.md`

## 实施要求

1. 在 `AgentOrchestratorService` 中增加 `AgentRunTrace`、`AgentRunResult`、`runAgentWithTrace()` 和本地 grounded trace helper。
2. 保留 `runAgentOrFallback()` 原签名和字符串返回语义。
3. 修正 `resolveAiRuntime()`，不要让 DeepSeek provider 误用 OpenAI key。
4. 主要 Agent 响应附加 `aiTrace`，不删除原字段。
5. 员工服务本地知识命中时返回 `grounded` trace。
6. 更新 `docs/architecture.md` 中智能助手链路说明。
7. 不要改动无关文件，不要执行 destructive git 命令。

## 验证

完成后运行：

```powershell
npm run build:api
```

如果验证失败，请修复后重跑，并在输出里说明最终状态。
