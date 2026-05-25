import type { AgentTool } from '../services/agent-orchestrator.service';

export function createPerformanceDataTool(
  createTool: (name: string, desc: string, schema: unknown, handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>) => AgentTool,
  z: any,
  queryPerformanceData: (input: Record<string, unknown>) => Promise<Record<string, unknown>>,
): AgentTool {
  return createTool(
    'performance_data_tool',
    '查询原始绩效评估与目标数据。',
    z.object({
      employeeId: z.string().nullable(),
      departmentId: z.string().nullable(),
      cycleId: z.string().nullable(),
    }),
    async (input) => queryPerformanceData(input),
  );
}

export function createPerformanceStatsTool(
  createTool: (name: string, desc: string, schema: unknown, handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>) => AgentTool,
  z: any,
): AgentTool {
  return createTool(
    'performance_stats_tool',
    '基于一组分数计算绩效统计指标。',
    z.object({ scores: z.array(z.number()) }),
    async (input) => {
      const scores = Array.isArray(input.scores) ? input.scores.map((s: unknown) => Number(s)) : [];
      return {
        average: scores.length === 0 ? 0 : scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length,
        max: scores.length === 0 ? 0 : Math.max(...scores),
        min: scores.length === 0 ? 0 : Math.min(...scores),
      };
    },
  );
}

export function createPerformanceReportTool(
  createTool: (name: string, desc: string, schema: unknown, handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>) => AgentTool,
  z: any,
): AgentTool {
  return createTool(
    'performance_report_tool',
    '生成简洁的绩效分析摘要。',
    z.object({
      averageScore: z.number(),
      topPerformer: z.string().nullable(),
      lowPerformer: z.string().nullable(),
    }),
    async (input) => ({
      report: `平均分 ${Number(input.averageScore ?? 0).toFixed(2)}。高绩效员工：${String(input.topPerformer ?? '暂无')}。需关注员工：${String(input.lowPerformer ?? '暂无')}。`,
    }),
  );
}
