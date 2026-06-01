# 验收标准

## 功能验收

1. `AgentOrchestratorService.runAgentOrFallback()` 仍返回字符串，现有调用不会被破坏。
2. 新增 `runAgentWithTrace()`，主要 Agent 服务可获得 `{ output, trace }`。
3. `AI_PROVIDER=deepseek` 不再 fallback 到 `OPENAI_API_KEY`。
4. `AI_PROVIDER=auto` 仍按 DeepSeek > OpenAI > mock 的顺序选择。
5. 招聘、员工服务、绩效分析、单员工离职风险接口响应中附加 `aiTrace`。
6. 员工服务知识命中直接回答时，`aiTrace.mode` 为 `grounded`。

## 验证命令

```powershell
npm run build:api
```

如时间允许，再运行：

```powershell
npm run verify:commercial
```

## 不应发生

1. 不应修改 `.env` 或打印密钥。
2. 不应修改数据库迁移。
3. 不应删除现有 API 字段。
4. 不应改动本轮无关文件。
