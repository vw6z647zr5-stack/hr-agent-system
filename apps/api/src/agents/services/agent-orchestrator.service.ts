import { Injectable, Logger } from '@nestjs/common';

type ToolResult = Record<string, unknown>;
type AiProvider = 'mock' | 'openai' | 'deepseek';

export type AgentTool = {
  name: string;
  description: string;
  schema: unknown;
  func: (input: unknown) => Promise<string>;
};

const { DynamicStructuredTool } = require('@langchain/core/tools') as {
  DynamicStructuredTool: new (config: AgentTool) => AgentTool;
};
const { MessagesPlaceholder, ChatPromptTemplate } = require('@langchain/core/prompts') as {
  MessagesPlaceholder: new (name: string) => unknown;
  ChatPromptTemplate: { fromMessages: (messages: unknown[]) => unknown };
};
const { ChatOpenAI } = require('@langchain/openai') as {
  ChatOpenAI: new (config: Record<string, unknown>) => unknown;
};
const { createToolCallingAgent, AgentExecutor } = require('langchain/agents') as {
  createToolCallingAgent: (config: Record<string, unknown>) => Promise<unknown>;
  AgentExecutor: new (config: Record<string, unknown>) => { invoke: (input: Record<string, unknown>) => Promise<Record<string, unknown>> };
};
const { z } = require('zod') as { z: any };

@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);

  // --- 工具工厂 ---

  createTool(
    name: string,
    description: string,
    schema: unknown,
    handler: (input: Record<string, unknown>) => Promise<ToolResult>,
  ) {
    return new DynamicStructuredTool({
      name,
      description,
      schema,
      func: async (input: unknown) => {
        try {
          return JSON.stringify(await handler(input as Record<string, unknown>));
        } catch (error) {
          return JSON.stringify({ error: (error as Error).message, tool: name });
        }
      },
    });
  }

  // --- AI 运行时解析 ---

  resolveAiRuntime(): {
    provider: AiProvider;
    apiKey?: string;
    model: string;
    baseURL?: string;
  } {
    const configuredProvider = (process.env.AI_PROVIDER ?? 'auto').toLowerCase();
    const deepseekKey = process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (configuredProvider === 'deepseek' || (configuredProvider === 'auto' && deepseekKey)) {
      return {
        provider: 'deepseek',
        apiKey: deepseekKey,
        model: process.env.DEEPSEEK_MODEL ?? process.env.OPENAI_MODEL ?? 'deepseek-chat',
        baseURL: process.env.DEEPSEEK_BASE_URL ?? process.env.OPENAI_BASE_URL ?? 'https://api.deepseek.com',
      };
    }

    if (configuredProvider === 'openai' || (configuredProvider === 'auto' && openaiKey)) {
      return {
        provider: 'openai',
        apiKey: openaiKey,
        model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
        baseURL: process.env.OPENAI_BASE_URL,
      };
    }

    return { provider: 'mock', model: 'mock' };
  }

  // --- 核心代理运行器 ---

  async runAgentOrFallback(params: {
    systemPrompt: string;
    input: string;
    tools: AgentTool[];
    fallback: () => Promise<string>;
  }): Promise<string> {
    const runtime = this.resolveAiRuntime();

    if (runtime.provider === 'mock' || !runtime.apiKey) {
      return params.fallback();
    }

    try {
      const llm = new ChatOpenAI({
        apiKey: runtime.apiKey,
        model: runtime.model,
        temperature: 0.2,
        maxRetries: 1,
        timeout: 30_000,
        configuration: runtime.baseURL
          ? { baseURL: runtime.baseURL }
          : undefined,
      });

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', params.systemPrompt],
        ['human', '{input}'],
        new MessagesPlaceholder('agent_scratchpad'),
      ]);

      const agent = await createToolCallingAgent({
        llm,
        tools: params.tools,
        prompt,
      });

      const executor = new AgentExecutor({
        agent,
        tools: params.tools,
        verbose: false,
      });

      const result = await executor.invoke({ input: params.input });
      return this.normalizeVisibleText(String(result.output ?? ''));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `智能代理执行失败，provider=${runtime.provider} model=${runtime.model}；已回退到确定性模式。${message}`,
      );
      return params.fallback();
    }
  }

  // --- 文本工具 ---

  normalizeVisibleText(value: string) {
    return value
      .replace(/HRBP/g, '人力资源业务伙伴')
      .replace(/HR系统/g, '人力资源系统')
      .replace(/HR部门/g, '人力资源部门')
      .replace(/HR 团队/g, '人力资源团队')
      .replace(/HR团队/g, '人力资源团队')
      .replace(/IT支持/g, '信息技术支持')
      .replace(/IT 支持/g, '信息技术支持');
  }

  extractSearchTerms(input: string) {
    const normalized = input.toLowerCase().trim();
    const baseTerms = normalized.split(/[\s,，。；：:、/()（）\-]+/).filter((item) => item.length >= 2);
    const chineseTerms = (normalized.match(/[一-鿿]{2,}/g) ?? []).flatMap((term) => {
      const terms = new Set<string>([term]);
      const maxLength = Math.min(term.length, 4);
      for (let size = 2; size <= maxLength; size += 1) {
        for (let index = 0; index <= term.length - size; index += 1) {
          terms.add(term.slice(index, index + size));
        }
      }
      return Array.from(terms);
    });
    return Array.from(new Set([...baseTerms, ...chineseTerms]));
  }

  scoreSearchText(text: string, terms: string[]) {
    const haystack = text.toLowerCase();
    return terms.reduce((score, term) => {
      if (!term) return score;
      let count = 0;
      let from = 0;
      while (true) {
        const index = haystack.indexOf(term, from);
        if (index === -1) break;
        count += 1;
        from = index + term.length;
      }
      return score + count;
    }, 0);
  }

  extractMatchTokens(text: string) {
    const normalized = text.toLowerCase();
    const latinTokens = normalized.match(/[a-z][a-z0-9+#.-]{1,}/g) ?? [];
    const chineseTokens = normalized.match(/[一-鿿]{2,}/g) ?? [];
    const stopWords = new Set([
      'the', 'and', 'with', 'for', 'or', 'is', 'are', 'of', 'in', 'to', 'a', 'an',
      '岗位', '负责', '要求', '具备', '熟悉', '经验', '能力', '相关', '工作', '优先',
      '以及', '进行', '支持', '职位', '描述', '职责', '任职', '以上', '以下', '提供',
      '开发', '管理', '包括', '部门', '公司', '具有', '良好', '一定', '以上学历',
    ]);
    return Array.from(new Set(
      [...latinTokens, ...chineseTokens].filter((token) => token.length >= 2 && !stopWords.has(token)),
    )).slice(0, 100);
  }

  fuzzyTokenMatch(jobTokens: string[], candidateTokens: string[]): { exact: number; partial: number; totalJob: number } {
    let exact = 0;
    let partial = 0;
    for (const jt of jobTokens) {
      let best = 0;
      for (const ct of candidateTokens) {
        if (jt === ct) { best = 2; break; }
        if (best < 1 && (jt.includes(ct) || ct.includes(jt))) best = 1;
      }
      if (best === 2) exact++;
      else if (best === 1) partial++;
    }
    return { exact, partial, totalJob: jobTokens.length };
  }

  computeMatchScore(params: {
    candidateTokens: string[];
    jobTokens: string[];
    yearsOfExperience: number;
    hasResume: boolean;
    stage: string;
    parsedProfile?: Record<string, unknown> | null;
  }): number {
    const { candidateTokens, jobTokens, yearsOfExperience, hasResume, stage, parsedProfile } = params;

    const jobMatch = this.fuzzyTokenMatch(jobTokens, candidateTokens);
    const candMatch = this.fuzzyTokenMatch(candidateTokens, jobTokens);
    const jobSide = jobMatch.totalJob > 0
      ? (jobMatch.exact * 1.0 + jobMatch.partial * 0.5) / jobMatch.totalJob
      : 0.25;
    const candSide = candMatch.totalJob > 0
      ? (candMatch.exact * 1.0 + candMatch.partial * 0.5) / candMatch.totalJob
      : 0.25;
    const skillScore = Math.round((jobSide * 0.6 + candSide * 0.4) * 62);

    const exp = yearsOfExperience;
    let expScore: number;
    if (exp <= 0)    expScore = 0;
    else if (exp < 1) expScore = 2;
    else if (exp < 2) expScore = 5;
    else if (exp < 3) expScore = 8;
    else if (exp < 5) expScore = 14;
    else if (exp < 8) expScore = 20;
    else if (exp < 12) expScore = 25;
    else              expScore = 28;

    const resumeScore = hasResume ? 6 : 0;

    let eduScore = 0;
    if (parsedProfile) {
      const eduFields = [
        parsedProfile.education, parsedProfile.degree, parsedProfile.school,
        parsedProfile.certifications, parsedProfile.summary,
      ].filter(Boolean).join(' ');
      const eduText = String(eduFields).toLowerCase();
      if (/博士|ph.?d/.test(eduText)) eduScore = 5;
      else if (/硕士|master|mba/.test(eduText)) eduScore = 4;
      else if (/本科|bachelor|学士|bs\b|ba\b/.test(eduText)) eduScore = 3;
      else if (/大专|college|associate/.test(eduText)) eduScore = 1;
    }

    const stageBonusMap: Record<string, number> = {
      'new': 0, 'screening': 5, 'phone_screen': 8,
      'interview': 12, 'technical_test': 12, 'offer': 18,
      'hired': 20, 'rejected': -8,
    };
    const stageBonus = stageBonusMap[stage] ?? 0;

    const rawScore = skillScore + expScore + resumeScore + eduScore + stageBonus;

    let minScore = 18;
    if (stage === 'offer' || stage === 'hired') minScore = 68;
    else if (stage === 'interview' || stage === 'technical_test') minScore = 35;

    return Math.max(minScore, Math.min(98, Math.round(rawScore)));
  }

  // --- 工具用 Zod 访问器 ---
  get zod() { return z; }
}
