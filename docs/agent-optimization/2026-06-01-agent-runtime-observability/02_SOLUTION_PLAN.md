# 方案：Agent 运行契约与可观测性优化

## 架构判断

当前系统已经从单个 `AgentService` 逐步拆成多个专家智能体服务，这是正确方向。下一步应把 `AgentOrchestratorService` 固化为所有智能体的运行控制面，承担以下职责：

1. 模型 provider 解析。
2. 工具调用代理。
3. LLM 失败后的确定性回退。
4. 运行元数据生成。
5. 输出文本规整。

## 代码修改范围

优先修改：

1. `apps/api/src/agents/services/agent-orchestrator.service.ts`
   - 新增 `AgentRunTrace` 和 `AgentRunResult` 类型。
   - 新增 `runAgentWithTrace()`，返回 `{ output, trace }`。
   - 保留 `runAgentOrFallback()`，内部调用新方法并只返回 `output`。
   - 修正 `resolveAiRuntime()` provider 选择逻辑：
     - `AI_PROVIDER=deepseek` 只使用 `DEEPSEEK_API_KEY`。
     - `AI_PROVIDER=openai` 只使用 `OPENAI_API_KEY`。
     - `AI_PROVIDER=auto` 优先 DeepSeek，其次 OpenAI，否则 mock。
   - 增加本地规则 trace helper，供 grounded answer 使用。

2. `apps/api/src/agents/services/recruitment-agent.service.ts`
   - `parseResume()`、`matchScore()`、`generateInterviewEmail()` 使用 `runAgentWithTrace()`。
   - 返回值增加 `aiTrace`，保留原有字段。

3. `apps/api/src/agents/services/employee-agent.service.ts`
   - 本地命中 `buildEmployeeServiceGroundedAnswer()` 时返回 `grounded` trace。
   - 未命中时使用 `runAgentWithTrace()`。
   - `employeeServiceChat()` 返回 `{ reply, references, aiTrace }`。

4. `apps/api/src/agents/services/performance-agent.service.ts`
   - `analyzePerformance()` 返回 `aiTrace`。

5. `apps/api/src/agents/services/attrition-agent.service.ts`
   - 单员工 `predictAttrition(employeeId)` 返回 `aiTrace`。

6. `apps/api/src/agents/services/pulse-survey.service.ts`
   - 可保持兼容调用，也可迁移到 `runAgentWithTrace()` 后仅使用 `output`。

7. `docs/architecture.md`
   - 增补 Agent 控制面、运行元数据和回退策略说明。

## 推荐 trace 字段

```ts
export type AgentRunMode = 'llm' | 'fallback' | 'grounded';
export type AiProvider = 'mock' | 'openai' | 'deepseek';

export interface AgentRunTrace {
  mode: AgentRunMode;
  provider: AiProvider | 'local';
  model: string;
  toolNames: string[];
  latencyMs: number;
  generatedAt: string;
  fallbackReason?: 'mock_provider' | 'missing_api_key' | 'llm_error' | 'grounded_answer';
  errorMessage?: string;
}

export interface AgentRunResult {
  output: string;
  trace: AgentRunTrace;
}
```

## 质量要求

1. 不泄露密钥。
2. 错误消息可用于排障，但不要包含敏感配置值。
3. TypeScript 构建通过。
4. 新字段命名统一为 `aiTrace`。
