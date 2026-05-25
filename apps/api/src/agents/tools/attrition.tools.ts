import type { AgentTool } from '../services/agent-orchestrator.service';

export function createBehaviorAggregationTool(
  createTool: (name: string, desc: string, schema: unknown, handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>) => AgentTool,
  z: any,
  buildAttritionProfile: (employeeId: string) => Promise<Record<string, unknown>>,
): AgentTool {
  return createTool(
    'behavior_aggregation_tool',
    '聚合考勤、请假、加班和资料变更信号，用于离职风险分析。',
    z.object({ employeeId: z.string() }),
    async (input) => buildAttritionProfile(String(input.employeeId ?? '')),
  );
}

export function createRiskScoringTool(
  createTool: (name: string, desc: string, schema: unknown, handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>) => AgentTool,
  z: any,
): AgentTool {
  return createTool(
    'risk_scoring_tool',
    '基于聚合指标计算离职风险分。',
    z.object({
      lateCount: z.number(),
      leaveCount: z.number(),
      overtimeCount: z.number(),
      scoreDrop: z.number(),
      profileChangeCount: z.number(),
    }),
    async (input) => ({
      riskScore: Math.min(
        100,
        Number(input.lateCount ?? 0) * 8 +
          Number(input.leaveCount ?? 0) * 3 +
          Number(input.scoreDrop ?? 0) * 18 +
          Number(input.profileChangeCount ?? 0) * 4 -
          Number(input.overtimeCount ?? 0) * 1.5,
      ),
    }),
  );
}

export function createWarningReportTool(
  createTool: (name: string, desc: string, schema: unknown, handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>) => AgentTool,
  z: any,
): AgentTool {
  return createTool(
    'warning_report_tool',
    '生成离职风险预警报告和干预建议。',
    z.object({
      employeeName: z.string(),
      riskScore: z.number(),
      department: z.string(),
    }),
    async (input) => ({
      report:
        Number(input.riskScore ?? 0) >= 60
          ? `${String(input.department ?? '未知部门')}的${String(input.employeeName ?? '该员工')}属于高风险人员，建议经理尽快介入，评估工作负荷并开展保留沟通。`
          : `${String(input.department ?? '未知部门')}的${String(input.employeeName ?? '该员工')}当前为低到中等风险，建议持续观察。`,
    }),
  );
}
