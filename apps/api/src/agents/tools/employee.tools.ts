import type { AgentTool } from '../services/agent-orchestrator.service';

export function createKnowledgeBaseSearchTool(
  createTool: (name: string, desc: string, schema: unknown, handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>) => AgentTool,
  z: any,
  searchKnowledgeBase: (query: string) => Promise<any[]>,
): AgentTool {
  return createTool(
    'knowledge_base_tool',
    '检索内部人力资源制度知识库条目。',
    z.object({ query: z.string() }),
    async (input) => ({ articles: await searchKnowledgeBase(String(input.query ?? '')) }),
  );
}

export function createCompanyDocumentSearchTool(
  createTool: (name: string, desc: string, schema: unknown, handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>) => AgentTool,
  z: any,
  searchDocuments: (query: string, limit: number) => Promise<any[]>,
): AgentTool {
  return createTool(
    'company_document_search_tool',
    '检索公司基础资料、规章制度、员工手册和业务流程文档。',
    z.object({ query: z.string() }),
    async (input) => ({ documents: await searchDocuments(String(input.query ?? ''), 5) }),
  );
}

export function createCompanyFactsSearchTool(
  createTool: (name: string, desc: string, schema: unknown, handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>) => AgentTool,
  z: any,
  listFacts: (params: { search: string; status: string }) => Promise<any[]>,
): AgentTool {
  return createTool(
    'company_facts_search_tool',
    '检索结构化公司基础信息字段，例如办公地点、工作时间、福利、组织服务入口和运营节奏。',
    z.object({ query: z.string() }),
    async (input) => ({
      facts: await listFacts({ search: String(input.query ?? ''), status: 'published' }),
    }),
  );
}

export function createEmployeeLookupTool(
  createTool: (name: string, desc: string, schema: unknown, handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>) => AgentTool,
  z: any,
  lookupEmployee: (employeeId: string) => Promise<any>,
): AgentTool {
  return createTool(
    'employee_lookup_tool',
    '查询单个员工档案。',
    z.object({ employeeId: z.string() }),
    async (input) => ({ employee: await lookupEmployee(String(input.employeeId ?? '')) }),
  );
}

export function createLeaveBalanceLookupTool(
  createTool: (name: string, desc: string, schema: unknown, handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>) => AgentTool,
  z: any,
  lookupBalances: (employeeId: string) => Promise<any[]>,
): AgentTool {
  return createTool(
    'leave_balance_tool',
    '获取员工当前假期余额。',
    z.object({ employeeId: z.string() }),
    async (input) => ({ balances: await lookupBalances(String(input.employeeId ?? '')) }),
  );
}
