import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { TenantContext } from '../../tenant/tenant.context';
import { EmployeeEntity } from '../../organization/organization.entities';
import { PulseSurveyEntity, PulseSurveyResponseEntity } from '../pulse-survey.entities';
import { AgentOrchestratorService } from './agent-orchestrator.service';

export interface PulseSurveyResults {
  periodStart: string;
  periodEnd: string;
  totalResponses: number;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  };
  averageSentimentScore: number;
  departmentHeatmap: Array<{
    departmentName: string;
    avgSentiment: number;
    responseCount: number;
    topKeywords: string[];
  }>;
  questionAverages: Array<{
    questionId: string;
    questionText: string;
    type: string;
    average?: number;
    distribution?: Record<string, number>;
  }>;
  topKeywords: Array<{ keyword: string; count: number }>;
}

@Injectable()
export class PulseSurveyService {
  private readonly logger = new Logger(PulseSurveyService.name);

  constructor(
    @InjectRepository(PulseSurveyEntity)
    private readonly surveyRepository: Repository<PulseSurveyEntity>,
    @InjectRepository(PulseSurveyResponseEntity)
    private readonly responseRepository: Repository<PulseSurveyResponseEntity>,
    @InjectRepository(EmployeeEntity)
    private readonly employeesRepository: Repository<EmployeeEntity>,
    private readonly tenantContext: TenantContext,
    private readonly orchestrator: AgentOrchestratorService,
  ) {}

  /** 获取当前公司的活跃调研问卷。 */
  async getActiveSurvey(): Promise<PulseSurveyEntity | null> {
    const companyId = this.tenantContext.getCompanyId();
    const now = new Date();

    return this.surveyRepository
      .createQueryBuilder('survey')
      .where('survey.companyId = :companyId', { companyId })
      .andWhere('survey.status = :status', { status: 'published' })
      .andWhere('survey.startDate <= :now', { now })
      .andWhere('survey.endDate >= :now', { now })
      .orderBy('survey.startDate', 'DESC')
      .getOne();
  }

  /** 提交问卷回复。如果员工已回复则执行 upsert。 */
  async submitResponse(
    surveyId: string,
    employeeId: string,
    answers: Record<string, unknown>,
  ): Promise<PulseSurveyResponseEntity> {
    if (!employeeId) {
      throw new BadRequestException('需要关联员工身份才能提交调研问卷。');
    }

    const survey = await this.surveyRepository.findOne({ where: { id: surveyId } });
    if (!survey) throw new BadRequestException('调研问卷不存在。');

    const now = new Date();
    if (now < new Date(survey.startDate) || now > new Date(survey.endDate)) {
      throw new BadRequestException('当前不在问卷有效期内。');
    }

    if (survey.status !== 'published') {
      throw new BadRequestException('该问卷暂未开放。');
    }

    // 对文本答案运行情感分析
    const textAnswers = Object.values(answers)
      .filter((v) => typeof v === 'string' && v.length > 0)
      .join(' ');
    let sentimentLabel: string | null = null;
    let sentimentScore: number | null = null;
    let aiKeywords: string[] | null = null;

    if (textAnswers.length > 0) {
      const sentiment = await this.analyzeSentiment(textAnswers);
      sentimentLabel = sentiment.label;
      sentimentScore = sentiment.score;
      aiKeywords = sentiment.keywords;
    }

    // 存在则更新，否则插入
    const existing = await this.responseRepository.findOne({ where: { surveyId, employeeId } });
    if (existing) {
      await this.responseRepository.update(existing.id, {
        answers,
        aiSentimentLabel: sentimentLabel ?? existing.aiSentimentLabel,
        aiSentimentScore: sentimentScore ?? existing.aiSentimentScore,
        aiKeywords: aiKeywords ?? existing.aiKeywords,
        submittedAt: new Date(),
      } as any);
      return (await this.responseRepository.findOne({ where: { id: existing.id } }))!;
    }

    const response = this.responseRepository.create({
      surveyId,
      employeeId,
      answers,
      aiSentimentLabel: sentimentLabel,
      aiSentimentScore: sentimentScore,
      aiKeywords,
    });
    return this.responseRepository.save(response);
  }

  /** 获取聚合结果供人力资源审阅。 */
  async getAggregatedResults(period = '30d'): Promise<PulseSurveyResults> {
    const companyId = this.tenantContext.getCompanyId();
    const now = new Date();
    const daysMs = period === '90d' ? 90 : period === 'all' ? 365 : 30;
    const since = new Date(now.getTime() - daysMs * 24 * 60 * 60 * 1000);

    const responses = await this.responseRepository
      .createQueryBuilder('resp')
      .leftJoinAndSelect('resp.employee', 'emp')
      .leftJoinAndSelect('resp.survey', 'survey')
      .leftJoinAndSelect('emp.department', 'dept')
      .where('survey.companyId = :companyId', { companyId })
      .andWhere('resp.submittedAt >= :since', { since })
      .orderBy('resp.submittedAt', 'DESC')
      .getMany();

    const totalResponses = responses.length;

    // 情感分布
    const sentimentDistribution = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
    let sentimentSum = 0;
    let sentimentCount = 0;

    for (const r of responses) {
      if (r.aiSentimentLabel) {
        const key = r.aiSentimentLabel as keyof typeof sentimentDistribution;
        if (key in sentimentDistribution) sentimentDistribution[key]++;
      }
      if (r.aiSentimentScore != null) {
        sentimentSum += Number(r.aiSentimentScore);
        sentimentCount++;
      }
    }

    const averageSentimentScore = sentimentCount > 0 ? Number((sentimentSum / sentimentCount).toFixed(2)) : 0;

    // 部门热力图
    const deptMap = new Map<string, { sentimentSum: number; count: number; keywords: Map<string, number> }>();
    for (const r of responses) {
      const deptName = r.employee?.department?.name ?? '未分配部门';
      if (!deptMap.has(deptName)) {
        deptMap.set(deptName, { sentimentSum: 0, count: 0, keywords: new Map() });
      }
      const entry = deptMap.get(deptName)!;
      if (r.aiSentimentScore != null) {
        entry.sentimentSum += Number(r.aiSentimentScore);
        entry.count++;
      }
      for (const kw of r.aiKeywords ?? []) {
        entry.keywords.set(kw, (entry.keywords.get(kw) ?? 0) + 1);
      }
    }

    const departmentHeatmap = Array.from(deptMap.entries()).map(([deptName, data]) => ({
      departmentName: deptName,
      avgSentiment: data.count > 0 ? Number((data.sentimentSum / data.count).toFixed(2)) : 0,
      responseCount: data.count,
      topKeywords: Array.from(data.keywords.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k]) => k),
    }));

    // 高频关键词
    const globalKeywords = new Map<string, number>();
    for (const r of responses) {
      for (const kw of r.aiKeywords ?? []) {
        globalKeywords.set(kw, (globalKeywords.get(kw) ?? 0) + 1);
      }
    }
    const topKeywords = Array.from(globalKeywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([keyword, count]) => ({ keyword, count }));

    // 问题均分（来自第一份活跃问卷）
    const survey = await this.getActiveSurvey();
    const questionAverages = survey?.questions?.map((q) => {
      const result: { questionId: string; questionText: string; type: string; average?: number; distribution?: Record<string, number> } = {
        questionId: q.id,
        questionText: q.text,
        type: q.type,
      };

      if (q.type === 'rating') {
        const values = responses
          .map((r) => Number(r.answers?.[q.id]))
          .filter((v) => !isNaN(v));
        result.average = values.length > 0 ? Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2)) : 0;
      } else if (q.type === 'choice') {
        const dist: Record<string, number> = {};
        for (const r of responses) {
          const val = String(r.answers?.[q.id] ?? '');
          if (val) dist[val] = (dist[val] ?? 0) + 1;
        }
        result.distribution = dist;
      }

      return result;
    }) ?? [];

    return {
      periodStart: since.toISOString(),
      periodEnd: now.toISOString(),
      totalResponses,
      sentimentDistribution,
      averageSentimentScore,
      departmentHeatmap,
      questionAverages,
      topKeywords,
    };
  }

  /** 对自由文本回复进行 AI 情感分析。失败时回退到关键词匹配。 */
  private async analyzeSentiment(text: string): Promise<{
    label: 'positive' | 'neutral' | 'negative' | 'mixed';
    score: number;
    keywords: string[];
  }> {
    // 通过编排器尝试 AI 分析
    try {
      const result = await this.orchestrator.runAgentOrFallback({
        systemPrompt: `你是员工心声分析助手。请分析以下员工反馈文本的情感倾向，返回 JSON：
{
  "label": "positive" | "neutral" | "negative" | "mixed",
  "score": -1.0 到 1.0 之间的数值,
  "keywords": ["提取的关键词", ...]
}
仅返回 JSON，不要其他文字。`,
        input: text.slice(0, 1000),
        tools: [],
        fallback: async () => JSON.stringify(this.keywordSentimentFallback(text)),
      });

      const parsed = JSON.parse(result) as { label: string; score: number; keywords: string[] };
      return {
        label: (['positive', 'neutral', 'negative', 'mixed'].includes(parsed.label) ? parsed.label : 'neutral') as 'positive' | 'neutral' | 'negative' | 'mixed',
        score: Math.max(-1, Math.min(1, Number(parsed.score) || 0)),
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 8) : [],
      };
    } catch {
      return this.keywordSentimentFallback(text);
    }
  }

  private keywordSentimentFallback(text: string): { label: 'positive' | 'neutral' | 'negative' | 'mixed'; score: number; keywords: string[] } {
    const lower = text.toLowerCase();

    const positiveWords = ['满意', '开心', '喜欢', '优秀', '支持', '成长', '机会', '公平', '透明', '信任', '团队', '合作', '好', '棒', '赞', '感谢', '鼓励', '进步', '发展', '挑战', '充实'];
    const negativeWords = ['不满', '压力', '累', '疲惫', '加班', '离职', '抱怨', '不公平', '混乱', '沟通差', '官僚', '推诿', '没人管', '沮丧', '失望', '焦虑', '超负荷', '担心', '烦', '难'];

    let posCount = 0;
    let negCount = 0;
    const keywords: string[] = [];

    for (const w of positiveWords) {
      if (lower.includes(w)) { posCount++; keywords.push(w); }
    }
    for (const w of negativeWords) {
      if (lower.includes(w)) { negCount++; keywords.push(w); }
    }

    if (posCount > negCount * 1.5) {
      return { label: 'positive', score: 0.6, keywords: keywords.slice(0, 6) };
    } else if (negCount > posCount * 1.5) {
      return { label: 'negative', score: -0.6, keywords: keywords.slice(0, 6) };
    } else if (posCount > 0 || negCount > 0) {
      return { label: 'mixed', score: 0, keywords: keywords.slice(0, 6) };
    }
    return { label: 'neutral', score: 0, keywords: [] };
  }
}
