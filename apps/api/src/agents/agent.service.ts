import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import {
  KnowledgeBaseArticleEntity,
  ProfileChangeRequestEntity,
} from './agent-support.entities';
import {
  AttendanceEntity,
  LeaveBalanceEntity,
  LeaveRequestEntity,
  OvertimeRequestEntity,
} from '../attendance/attendance.entities';
import { DepartmentEntity, EmployeeEntity } from '../organization/organization.entities';
import {
  PerformanceGoalEntity,
  PerformanceReviewEntity,
} from '../performance/performance.entities';
import {
  CandidateEntity,
  JobPostingEntity,
  ResumeEntity,
} from '../recruitment/recruitment.entities';
import { AuthenticatedUser } from '../users/user.entity';
import {
  EmployeeServiceChatDto,
  GenerateInterviewEmailDto,
  MatchScoreAgentDto,
  ParseResumeAgentDto,
  PerformanceAnalyzeDto,
} from './agent.dto';
import { CompanyFactsService } from './company-facts.service';
import { DocumentRagService, type RagReference } from './document-rag.service';

type ToolResult = Record<string, unknown>;
type AiProvider = 'mock' | 'openai' | 'deepseek';
type AgentTool = {
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
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @InjectRepository(ResumeEntity)
    private readonly resumesRepository: Repository<ResumeEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidatesRepository: Repository<CandidateEntity>,
    @InjectRepository(JobPostingEntity)
    private readonly jobPostingsRepository: Repository<JobPostingEntity>,
    @InjectRepository(KnowledgeBaseArticleEntity)
    private readonly knowledgeBaseRepository: Repository<KnowledgeBaseArticleEntity>,
    @InjectRepository(EmployeeEntity)
    private readonly employeesRepository: Repository<EmployeeEntity>,
    @InjectRepository(LeaveBalanceEntity)
    private readonly leaveBalancesRepository: Repository<LeaveBalanceEntity>,
    @InjectRepository(PerformanceReviewEntity)
    private readonly reviewsRepository: Repository<PerformanceReviewEntity>,
    @InjectRepository(PerformanceGoalEntity)
    private readonly goalsRepository: Repository<PerformanceGoalEntity>,
    @InjectRepository(AttendanceEntity)
    private readonly attendanceRepository: Repository<AttendanceEntity>,
    @InjectRepository(LeaveRequestEntity)
    private readonly leaveRequestsRepository: Repository<LeaveRequestEntity>,
    @InjectRepository(OvertimeRequestEntity)
    private readonly overtimeRepository: Repository<OvertimeRequestEntity>,
    @InjectRepository(DepartmentEntity)
    private readonly departmentsRepository: Repository<DepartmentEntity>,
    @InjectRepository(ProfileChangeRequestEntity)
    private readonly profileChangeRepository: Repository<ProfileChangeRequestEntity>,
    private readonly documentRagService: DocumentRagService,
    private readonly companyFactsService: CompanyFactsService,
    private readonly redisService: RedisService,
  ) {}

  async parseResume(payload: ParseResumeAgentDto) {
    const parsed = await this.parseResumeInternal(payload);
    const summary = await this.runAgentOrFallback({
      systemPrompt:
        '你是招聘助手，请用简洁专业的中文总结简历解析结果，突出亮点与潜在风险，供人力资源初筛使用。',
      input: `简历解析结果：${JSON.stringify(parsed)}`,
      tools: [this.createRecruitmentParseTool()],
      fallback: async () =>
        `候选人 ${parsed.name || '未识别姓名'} 已解析，识别到 ${Array.isArray(parsed.skills) ? parsed.skills.length : 0} 项关键技能。`,
    });

    return { parsedProfile: parsed, summary };
  }

  async matchScore(payload: MatchScoreAgentDto) {
    const score = await this.matchScoreInternal(payload);
    const summary = await this.runAgentOrFallback({
      systemPrompt:
        `你是招聘助手，请用简洁专业的中文解释候选人与岗位的匹配情况。重要：匹配评分已由系统精确计算为 ${score.score} 分，你必须直接引用此分数，不得自行估算或修改。请说明主要依据（技能重合、经验匹配等）与建议动作。`,
      input: `候选人与岗位匹配评分详情：${JSON.stringify(score)}。请在你的回复中明确引用匹配分=${score.score}。`,
      tools: [this.createCandidateMatchTool()],
      fallback: async () =>
        `匹配度 ${score.score} 分。技能重合 ${score.matchedSkills.join('、') || '较少'}（命中 ${score.matchedSkills.length} 项，缺失 ${score.missingSkills.length} 项），建议 ${score.score >= 75 ? '进入下一轮面试' : '继续人工复核'}。`,
    });

    if (payload.candidateId) {
      await this.candidatesRepository.update(payload.candidateId, { aiMatchScore: score.score });
    }

    return { ...score, summary };
  }

  async generateInterviewEmail(payload: GenerateInterviewEmailDto) {
    const email = await this.generateInterviewEmailInternal(payload);
    const summary = await this.runAgentOrFallback({
      systemPrompt:
        '你是招聘助手，请用中文润色面试邀约邮件，保持专业、礼貌且简洁。',
      input: `面试邀约邮件草稿：${JSON.stringify(email)}`,
      tools: [this.createInterviewEmailTool()],
      fallback: async () => '面试邀约邮件草稿已生成，可直接交给人力资源审核后发送。',
    });

    return { ...email, summary };
  }

  async employeeServiceChat(user: AuthenticatedUser, payload: EmployeeServiceChatDto) {
    const message = this.normalizeChatMessage(payload);
    const employeeId = user.employeeId;
    const historyKey = `agent-chat:${user.userId}`;
    const history = (await this.redisService.getJson<Array<{ role: string; content: string }>>(historyKey)) ?? [];

    const knowledge = await this.searchEmployeeKnowledge(message);
    const leaveBalances = employeeId ? await this.leaveBalancesRepository.find({ where: { employeeId } }) : [];
    const employee = employeeId
      ? await this.employeesRepository.findOne({ where: { id: employeeId }, relations: { department: true, position: true } })
      : null;
    const groundedReply = this.buildEmployeeServiceGroundedAnswer(
      message,
      employee,
      leaveBalances,
      knowledge.articles,
      knowledge.documents,
    );

    const reply = groundedReply
      ? groundedReply
      : await this.runAgentOrFallback({
          systemPrompt:
            '你是员工服务助手，请用清晰、简洁的中文回答制度与员工自助相关问题，并在可用时结合员工上下文。',
          input: JSON.stringify({
            question: message,
            history,
            employee,
            leaveBalances,
            knowledgeBase: knowledge.articles,
            companyDocuments: knowledge.documents,
            companyFacts: knowledge.companyFacts,
          }),
          tools: [
            this.createKnowledgeBaseSearchTool(),
            this.createCompanyDocumentSearchTool(),
            this.createCompanyFactsSearchTool(),
            this.createEmployeeLookupTool(),
            this.createLeaveBalanceLookupTool(),
          ],
          fallback: async () =>
            this.buildEmployeeServiceFallback(
              message,
              employee,
              leaveBalances,
              knowledge.articles,
              knowledge.documents,
            ),
        });

    const nextHistory = [
      ...history.slice(-8),
      { role: 'user', content: message },
      { role: 'assistant', content: reply },
    ];
    await this.redisService.setJson(historyKey, nextHistory, 60 * 60 * 2);

    return {
      reply,
      references: this.composeVisibleReferences(knowledge.articles, knowledge.documents),
    };
  }

  getKnowledgeBase() {
    return this.knowledgeBaseRepository.find({
      where: { isPublished: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getKnowledgeSources() {
    const [articles, documents, companyFacts] = await Promise.all([
      this.getKnowledgeBase(),
      this.documentRagService.listSources(),
      this.companyFactsService.getPublishedFacts(),
    ]);

    return {
      articles: articles.map((article) => ({
        id: article.id,
        title: article.title,
        category: article.category,
        sourceType: 'knowledge_base',
      })),
      documents,
      companyFacts,
    };
  }

  async analyzePerformance(payload: PerformanceAnalyzeDto) {
    const raw = await this.queryPerformanceData(payload);
    const summary = await this.runAgentOrFallback({
      systemPrompt:
        '你是绩效分析助手，请用中文识别趋势、高绩效员工、需关注员工，并给出可执行建议。',
      input: JSON.stringify(raw),
      tools: [
        this.createPerformanceDataTool(),
        this.createPerformanceStatsTool(),
        this.createPerformanceReportTool(),
      ],
      fallback: async () => this.buildPerformanceFallback(raw),
    });

    return {
      ...raw,
      summary,
    };
  }

  async getPerformanceInsights() {
    const recentReviews = await this.reviewsRepository.find({
      relations: { employee: true },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const averageScore =
      recentReviews.length === 0
        ? 0
        : recentReviews.reduce((sum, review) => sum + Number(review.overallScore), 0) / recentReviews.length;

    return {
      averageScore: Number(averageScore.toFixed(2)),
      topPerformers: recentReviews
        .filter((review) => Number(review.overallScore) >= 4.2)
        .map((review) => ({ employee: review.employee.fullName, score: review.overallScore })),
      needsAttention: recentReviews
        .filter((review) => Number(review.overallScore) < 3.5)
        .map((review) => ({ employee: review.employee.fullName, score: review.overallScore })),
    };
  }

  async predictAttrition(employeeId?: string) {
    if (employeeId) {
      const profile = await this.buildAttritionProfile(employeeId);
      const summary = await this.runAgentOrFallback({
        systemPrompt:
          '你是离职风险助手，请用中文解释离职风险分数、主要驱动因素与干预建议。',
        input: JSON.stringify(profile),
        tools: [
          this.createBehaviorAggregationTool(),
          this.createRiskScoringTool(),
          this.createWarningReportTool(),
        ],
        fallback: async () => this.buildAttritionFallback(profile),
      });

      return { ...profile, summary };
    }

    const employees = await this.employeesRepository.find();
    return Promise.all(employees.map((employee) => this.buildAttritionProfile(employee.id)));
  }

  async getHighRiskAttritionList() {
    const predictions = await this.predictAttrition();
    return (predictions as Array<Record<string, unknown>>).filter((item) => Number(item.riskScore) >= 60);
  }

  private async parseResumeInternal(payload: ParseResumeAgentDto) {
    if (!payload.resumeId && !payload.resumeText) {
      throw new NotFoundException('必须提供简历编号或简历文本。');
    }

    const resumeText = payload.resumeId
      ? (await this.resumesRepository.findOne({ where: { id: payload.resumeId } }))?.parsedText ?? ''
      : payload.resumeText ?? '';

    if (!resumeText) {
      throw new NotFoundException('未找到简历文本。');
    }

    const email = resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
    const phone = resumeText.match(/(?:\+?\d{1,3}[- ]?)?(?:\d[- ]?){7,14}\d/)?.[0] ?? '';
    const skills = ['Node.js', 'NestJS', 'PostgreSQL', 'Redis', 'React', 'TypeScript', 'LangChain', 'OpenAI']
      .filter((skill) => resumeText.toLowerCase().includes(skill.toLowerCase()));

    return {
      name: resumeText.split(/\r?\n/).find(Boolean)?.trim() ?? '',
      email,
      phone,
      skills,
      summary: resumeText.slice(0, 300),
    };
  }

  private normalizeChatMessage(payload: EmployeeServiceChatDto) {
    const message = typeof payload?.message === 'string' ? payload.message.trim() : '';

    if (!message) {
      throw new BadRequestException('请输入要咨询的问题。');
    }

    if (message.length > 1_000) {
      throw new BadRequestException('单次咨询内容不能超过 1000 个字符。');
    }

    return message;
  }

  /** 重新计算并持久化单个候选人的智能匹配分。 */
  async recalculateAndPersistScore(candidateId: string): Promise<number> {
    const result = await this.matchScoreInternal({ candidateId });
    await this.candidatesRepository.update(candidateId, { aiMatchScore: result.score });
    return result.score;
  }

  /** 重新计算并持久化所有候选人的智能匹配分。 */
  async recalculateAllScores(): Promise<{ candidateId: string; name: string; score: number }[]> {
    const candidates = await this.candidatesRepository.find({ relations: { appliedJobPosting: true } });
    const results: { candidateId: string; name: string; score: number }[] = [];
    for (const c of candidates) {
      try {
        const result = await this.matchScoreInternal({ candidateId: c.id });
        await this.candidatesRepository.update(c.id, { aiMatchScore: result.score });
        results.push({ candidateId: c.id, name: c.fullName, score: result.score });
      } catch (err: any) {
        results.push({ candidateId: c.id, name: c.fullName, score: -1 });
      }
    }
    return results;
  }

  private async matchScoreInternal(payload: MatchScoreAgentDto) {
    const candidate = payload.candidateId
      ? await this.candidatesRepository.findOne({ where: { id: payload.candidateId }, relations: { appliedJobPosting: true } })
      : null;
    const jobPosting = payload.jobPostingId
      ? await this.jobPostingsRepository.findOne({
          where: { id: payload.jobPostingId },
          relations: { department: true, position: true },
        })
      : null;

    const latestResume = candidate
      ? await this.resumesRepository.findOne({
          where: { candidateId: candidate.id },
          order: { uploadedAt: 'DESC', createdAt: 'DESC' },
        })
      : null;
    const resumeText = `${latestResume?.parsedText ?? ''} ${JSON.stringify(latestResume?.parsedProfile ?? {})}`;
    const candidateText = [
      candidate?.fullName,
      candidate?.currentCompany,
      candidate?.notes,
      candidate?.skills?.join(' '),
      resumeText,
    ]
      .filter(Boolean)
      .join(' ');
    const jobText = [
      jobPosting?.title,
      payload.jobRequirements,
      jobPosting?.description,
      jobPosting?.requirements,
      jobPosting?.department?.name,
      jobPosting?.position?.name,
      jobPosting?.position?.level,
    ]
      .filter(Boolean)
      .join(' ');

    const candidateTokens = this.extractMatchTokens(candidateText);
    const jobTokens = this.extractMatchTokens(jobText);

    const exactMatched = jobTokens.filter((token) => candidateTokens.includes(token));
    const exactMissing = jobTokens.filter((token) => !candidateTokens.includes(token));

    // 收集模糊匹配项，用于前端展示。
    const partialMatched: string[] = [];
    for (const jt of exactMissing) {
      for (const ct of candidateTokens) {
        if (jt.includes(ct) || ct.includes(jt)) {
          partialMatched.push(jt);
          break;
        }
      }
    }

    const score = this.computeMatchScore({
      candidateTokens,
      jobTokens,
      yearsOfExperience: Number(candidate?.yearsOfExperience ?? 0),
      hasResume: !!latestResume,
      stage: candidate?.stage ?? 'new',
      parsedProfile: latestResume?.parsedProfile ?? null,
    });

    return {
      score,
      matchedSkills: [...new Set([...exactMatched, ...partialMatched])].slice(0, 12),
      missingSkills: exactMissing.filter((t) => !partialMatched.includes(t)).slice(0, 8),
      candidate: candidate?.fullName ?? '未知候选人',
      jobTitle: jobPosting?.title ?? '自定义岗位',
    };
  }
  private async generateInterviewEmailInternal(payload: GenerateInterviewEmailDto) {
    const candidate = payload.candidateId
      ? await this.candidatesRepository.findOne({ where: { id: payload.candidateId } })
      : null;
    const jobPosting = payload.jobPostingId
      ? await this.jobPostingsRepository.findOne({ where: { id: payload.jobPostingId } })
      : null;

    const candidateName = candidate?.fullName ?? '候选人';
    const jobTitle = jobPosting?.title ?? '当前招聘岗位';
    const interviewTime = new Date(payload.interviewTime).toLocaleString('zh-CN', { hour12: false });

    return {
      subject: `面试邀约｜${jobTitle}`,
      body: `${candidateName}，您好：\n\n感谢您关注 ${jobTitle} 岗位。现邀请您于 ${interviewTime} 参加面试，面试官为 ${payload.interviewerName}。\n\n如时间安排无误，请回复确认；如需调整，也请及时告知。\n\n此致\n敬礼\n人力资源团队`,
    };
  }

  private async searchKnowledgeBase(query: string) {
    const articles = await this.knowledgeBaseRepository.find({ where: { isPublished: true } });
    const terms = this.extractSearchTerms(query);

    return articles
      .map((article) => ({
        article,
        score: this.scoreSearchText(
          [article.title, article.question, article.answer, ...(article.tags ?? [])].join(' '),
          terms,
        ),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((item) => item.article)
      .slice(0, 5);
  }

  private async searchEmployeeKnowledge(query: string) {
    const [articles, documents, companyFacts] = await Promise.all([
      this.searchKnowledgeBase(query),
      this.documentRagService.search(query, 5),
      this.companyFactsService.listFacts({ search: query, status: 'published' }),
    ]);

    return {
      articles,
      documents,
      companyFacts: companyFacts.slice(0, 6),
    };
  }

  private getLeaveTypeLabel(value: string) {
    const labels: Record<string, string> = {
      annual: '年假',
      sick: '病假',
      marriage: '婚假',
      personal: '事假',
      maternity: '产假',
      paternity: '陪产假',
    };

    return labels[value] ?? value;
  }

  private async queryPerformanceData(payload: PerformanceAnalyzeDto) {
    const reviewsBuilder = this.reviewsRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.employee', 'employee')
      .leftJoinAndSelect('employee.department', 'department');

    if (payload.employeeId) {
      reviewsBuilder.andWhere('review.employeeId = :employeeId', { employeeId: payload.employeeId });
    }

    if (payload.departmentId) {
      reviewsBuilder.andWhere('employee.departmentId = :departmentId', { departmentId: payload.departmentId });
    }

    if (payload.cycleId) {
      reviewsBuilder.andWhere('review.cycleId = :cycleId', { cycleId: payload.cycleId });
    }

    const [reviews, goals] = await Promise.all([
      reviewsBuilder.getMany(),
      this.goalsRepository.find({
        where: {
          ...(payload.employeeId ? { employeeId: payload.employeeId } : {}),
          ...(payload.cycleId ? { cycleId: payload.cycleId } : {}),
        },
        relations: { employee: true },
      }),
    ]);

    const averageScore =
      reviews.length === 0 ? 0 : reviews.reduce((sum, review) => sum + Number(review.overallScore), 0) / reviews.length;

    const sortedReviews = [...reviews].sort((left, right) => Number(right.overallScore) - Number(left.overallScore));

    return {
      averageScore: Number(averageScore.toFixed(2)),
      reviews: reviews.map((review) => ({
        employeeId: review.employeeId,
        employeeName: review.employee.fullName,
        score: Number(review.overallScore),
        rating: review.rating,
      })),
      goals: goals.map((goal) => ({
        employeeId: goal.employeeId,
        employeeName: goal.employee.fullName,
        title: goal.title,
        status: goal.status,
        weight: Number(goal.weight),
      })),
      topPerformer: sortedReviews[0]
        ? { employee: sortedReviews[0].employee.fullName, score: Number(sortedReviews[0].overallScore) }
        : null,
      lowPerformer: sortedReviews.at(-1)
        ? { employee: sortedReviews.at(-1)!.employee.fullName, score: Number(sortedReviews.at(-1)!.overallScore) }
        : null,
    };
  }

  private async buildAttritionProfile(employeeId: string) {
    const employee = await this.employeesRepository.findOne({ where: { id: employeeId }, relations: { department: true } });
    if (!employee) {
      throw new NotFoundException('未找到员工。');
    }

    const [attendances, leaveRequests, overtimeRequests, reviews, profileChanges] = await Promise.all([
      this.attendanceRepository.find({ where: { employeeId }, order: { workDate: 'DESC' }, take: 30 }),
      this.leaveRequestsRepository.find({ where: { employeeId }, order: { createdAt: 'DESC' }, take: 12 }),
      this.overtimeRepository.find({ where: { employeeId }, order: { createdAt: 'DESC' }, take: 12 }),
      this.reviewsRepository.find({ where: { employeeId }, order: { createdAt: 'DESC' }, take: 3 }),
      this.profileChangeRepository.find({ where: { employeeId }, order: { createdAt: 'DESC' }, take: 6 }),
    ]);

    const lateCount = attendances.filter((item) => item.lateMinutes > 0 || item.status === 'anomaly').length;
    const leaveCount = leaveRequests.length;
    const overtimeCount = overtimeRequests.filter((item) => item.status === 'approved').length;
    const currentScore = Number(reviews[0]?.overallScore ?? 3.8);
    const previousScore = Number(reviews[1]?.overallScore ?? currentScore);
    const scoreDrop = Math.max(0, previousScore - currentScore);
    const profileChangeCount = profileChanges.length;

    const riskScore = Math.min(
      100,
      lateCount * 8 + leaveCount * 3 + scoreDrop * 18 + profileChangeCount * 4 - overtimeCount * 1.5,
    );

    return {
      employeeId,
      employeeName: employee.fullName,
      department: employee.department?.name ?? '',
      riskScore: Number(riskScore.toFixed(2)),
      indicators: {
        lateCount,
        leaveCount,
        overtimeCount,
        currentScore,
        previousScore,
        profileChangeCount,
      },
      recommendation:
        riskScore >= 60
          ? '建议安排经理一对一沟通，评估工作负荷平衡，并重新确认职业发展计划。'
          : '建议保持日常沟通并持续观察变化趋势。',
    };
  }

  private buildEmployeeServiceFallback(
    question: string,
    employee: EmployeeEntity | null,
    leaveBalances: LeaveBalanceEntity[],
    articles: KnowledgeBaseArticleEntity[],
    documentReferences: RagReference[],
  ) {
    const lower = question.toLowerCase();

    if (lower.includes('假') || lower.includes('leave')) {
      const summary = leaveBalances
        .map((item) => `${this.getLeaveTypeLabel(item.leaveType)}：剩余 ${item.remainingDays} 天`)
        .join('；');
      const policyNote = documentReferences[0]?.excerpt || articles[0]?.answer || '';
      return [summary || '当前没有可用的假期余额记录。', policyNote].filter(Boolean).join('\n\n制度说明：');
    }

    if (lower.includes('工资') || lower.includes('payslip')) {
      return [articles[0]?.answer ?? '工资单可在员工自助服务工作台的薪酬区域查看，已发布的工资单会自动展示。', documentReferences[0]?.excerpt]
        .filter(Boolean)
        .join('\n\n依据：');
    }

    if (documentReferences.length > 0) {
      const top = documentReferences[0]!;
      return `${top.excerpt}\n\n来源：${top.title} / ${top.section}`;
    }

    if (articles.length > 0) {
      return articles[0]?.answer ?? '暂未找到匹配的知识库条目。';
    }

    return `您好${employee ? `，${employee.fullName}` : ''}。当前未命中知识库条目，请联系人力资源获取进一步帮助。`;
  }

  private buildEmployeeServiceGroundedAnswer(
    question: string,
    employee: EmployeeEntity | null,
    leaveBalances: LeaveBalanceEntity[],
    articles: KnowledgeBaseArticleEntity[],
    documentReferences: RagReference[],
  ) {
    const lower = question.toLowerCase();
    const hasGrounding = articles.length > 0 || documentReferences.length > 0;

    if (!hasGrounding && !(lower.includes('假') || lower.includes('leave'))) {
      return null;
    }

    const greeting = employee ? `您好，${employee.fullName}。` : '您好。';

    if (lower.includes('基础信息') || lower.includes('公司') || lower.includes('工作时间') || lower.includes('办公')) {
      const topDocuments = documentReferences.slice(0, 2);
      if (topDocuments.length > 0) {
        const summary = topDocuments.map((item) => item.excerpt).join('\n');
        const sources = topDocuments.map((item) => `${item.title} / ${item.section}`).join('；');
        return `${greeting}\n\n${summary}\n\n来源：${sources}`;
      }
    }

    if (lower.includes('假') || lower.includes('leave')) {
      const summary = leaveBalances.length
        ? leaveBalances.map((item) => `${this.getLeaveTypeLabel(item.leaveType)}剩余 ${item.remainingDays} 天`).join('；')
        : '当前没有可用的假期余额记录。';
      const source = articles[0]?.answer ?? documentReferences[0]?.excerpt;
      return `${greeting}\n\n${summary}${source ? `\n\n制度说明：${source}` : ''}`;
    }

    if (lower.includes('加班') || lower.includes('overtime')) {
      const source = articles[0]?.answer ?? documentReferences[0]?.excerpt;
      if (source) {
        return `${greeting}\n\n${source}`;
      }
    }

    if (lower.includes('工资') || lower.includes('payslip') || lower.includes('薪酬')) {
      const source = articles[0]?.answer ?? documentReferences[0]?.excerpt;
      if (source) {
        return `${greeting}\n\n${source}`;
      }
    }

    if (documentReferences.length > 0) {
      const top = documentReferences[0]!;
      return `${greeting}\n\n${top.excerpt}\n\n来源：${top.title} / ${top.section}`;
    }

    if (articles.length > 0) {
      return `${greeting}\n\n${articles[0]!.answer}`;
    }

    return null;
  }

  private buildPerformanceFallback(raw: Record<string, unknown>) {
    const top = raw.topPerformer as { employee: string; score: number } | null;
    const low = raw.lowPerformer as { employee: string; score: number } | null;
    return `当前平均绩效分为 ${raw.averageScore}。高绩效员工：${top?.employee ?? '暂无'}；需关注员工：${low?.employee ?? '暂无'}。建议围绕低分项设置改进目标并安排周期性复盘。`;
  }

  private buildAttritionFallback(profile: Record<string, unknown>) {
    return `离职风险分为 ${profile.riskScore}。主要信号包括考勤异常、请假频率和绩效变化。建议经理在一周内进行一次一对一沟通，并评估当前工作负载与成长机会。`;
  }

  private async runAgentOrFallback(params: {
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
          ? {
              baseURL: runtime.baseURL,
            }
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

  private resolveAiRuntime(): {
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

    return {
      provider: 'mock',
      model: 'mock',
    };
  }

  private normalizeVisibleText(value: string) {
    return value
      .replace(/HRBP/g, '人力资源业务伙伴')
      .replace(/HR系统/g, '人力资源系统')
      .replace(/HR部门/g, '人力资源部门')
      .replace(/HR 团队/g, '人力资源团队')
      .replace(/HR团队/g, '人力资源团队')
      .replace(/IT支持/g, '信息技术支持')
      .replace(/IT 支持/g, '信息技术支持');
  }

  private createTool(
    name: string,
    description: string,
    schema: unknown,
    handler: (input: Record<string, unknown>) => Promise<ToolResult>,
  ) {
    return new DynamicStructuredTool({
      name,
      description,
      schema,
      func: async (input) => {
        try {
          return JSON.stringify(await handler(input as Record<string, unknown>));
        } catch (error) {
          return JSON.stringify({ error: (error as Error).message, tool: name });
        }
      },
    });
  }

  private createRecruitmentParseTool() {
    return this.createTool(
      'resume_parse_tool',
      '将简历文本或已存储的简历记录解析为结构化候选人画像。',
      z.object({ resumeId: z.string().nullable(), resumeText: z.string().nullable() }),
      async (input) => this.parseResumeInternal(input),
    );
  }

  private createCandidateMatchTool() {
    return this.createTool(
      'candidate_match_tool',
      '评估候选人与岗位或岗位要求的匹配程度。',
      z.object({
        candidateId: z.string().nullable(),
        jobPostingId: z.string().nullable(),
        jobRequirements: z.string().nullable(),
      }),
      async (input) => this.matchScoreInternal(input),
    );
  }

  private createInterviewEmailTool() {
    return this.createTool(
      'interview_email_tool',
      '生成面试邀约邮件草稿。',
      z.object({
        candidateId: z.string().nullable(),
        jobPostingId: z.string().nullable(),
        interviewTime: z.string(),
        interviewerName: z.string(),
      }),
      async (input) => this.generateInterviewEmailInternal(input as unknown as GenerateInterviewEmailDto),
    );
  }

  private createKnowledgeBaseSearchTool() {
    return this.createTool(
      'knowledge_base_tool',
      '检索内部人力资源制度知识库条目。',
      z.object({ query: z.string() }),
      async (input) => ({ articles: await this.searchKnowledgeBase(String(input.query ?? '')) }),
    );
  }

  private createCompanyDocumentSearchTool() {
    return this.createTool(
      'company_document_search_tool',
      '检索公司基础资料、规章制度、员工手册和业务流程文档。',
      z.object({ query: z.string() }),
      async (input) => ({ documents: await this.documentRagService.search(String(input.query ?? ''), 5) }),
    );
  }

  private createCompanyFactsSearchTool() {
    return this.createTool(
      'company_facts_search_tool',
      '检索结构化公司基础信息字段，例如办公地点、工作时间、福利、组织服务入口和运营节奏。',
      z.object({ query: z.string() }),
      async (input) => ({
        facts: await this.companyFactsService.listFacts({
          search: String(input.query ?? ''),
          status: 'published',
        }),
      }),
    );
  }

  private createEmployeeLookupTool() {
    return this.createTool(
      'employee_lookup_tool',
      '查询单个员工档案。',
      z.object({ employeeId: z.string() }),
      async (input) => ({
        employee: await this.employeesRepository.findOne({
          where: { id: String(input.employeeId ?? '') },
          relations: { department: true, position: true, manager: true },
        }),
      }),
    );
  }

  private createLeaveBalanceLookupTool() {
    return this.createTool(
      'leave_balance_tool',
      '获取员工当前假期余额。',
      z.object({ employeeId: z.string() }),
      async (input) => ({
        balances: await this.leaveBalancesRepository.find({ where: { employeeId: String(input.employeeId ?? '') } }),
      }),
    );
  }

  private createPerformanceDataTool() {
    return this.createTool(
      'performance_data_tool',
      '查询原始绩效评估与目标数据。',
      z.object({
        employeeId: z.string().nullable(),
        departmentId: z.string().nullable(),
        cycleId: z.string().nullable(),
      }),
      async (input) => this.queryPerformanceData(input),
    );
  }

  private createPerformanceStatsTool() {
    return this.createTool(
      'performance_stats_tool',
      '基于一组分数计算绩效统计指标。',
      z.object({ scores: z.array(z.number()) }),
      async (input) => {
        const scores = Array.isArray(input.scores) ? input.scores.map((score) => Number(score)) : [];
        return {
        average: scores.length === 0 ? 0 : scores.reduce((sum, score) => sum + score, 0) / scores.length,
        max: scores.length === 0 ? 0 : Math.max(...scores),
        min: scores.length === 0 ? 0 : Math.min(...scores),
        };
      },
    );
  }

  private createPerformanceReportTool() {
    return this.createTool(
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

  private createBehaviorAggregationTool() {
    return this.createTool(
      'behavior_aggregation_tool',
      '聚合考勤、请假、加班和资料变更信号，用于离职风险分析。',
      z.object({ employeeId: z.string() }),
      async (input) => this.buildAttritionProfile(String(input.employeeId ?? '')),
    );
  }

  private createRiskScoringTool() {
    return this.createTool(
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

  private createWarningReportTool() {
    return this.createTool(
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

  private composeVisibleReferences(articles: KnowledgeBaseArticleEntity[], documents: RagReference[]) {
    const articleRefs = articles.slice(0, 3).map((article) => ({
      id: article.id,
      title: article.title,
      category: article.category,
      sourceType: 'knowledge_base',
      excerpt: article.answer,
    }));

    const documentRefs = documents.slice(0, 3).map((document) => ({
      id: document.id,
      title: document.title,
      category: document.category,
      sourceType: 'document',
      sourcePath: document.sourcePath,
      section: document.section,
      excerpt: document.excerpt,
    }));

    return [...articleRefs, ...documentRefs];
  }

  private extractSearchTerms(input: string) {
    const normalized = input.toLowerCase().trim();
    const baseTerms = normalized.split(/[\s,，。；：:、/()（）\-]+/).filter((item) => item.length >= 2);
    const chineseTerms = (normalized.match(/[4e00-9fff]{2,}/g) ?? []).flatMap((term) => {
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

  private extractMatchTokens(text: string) {
    const normalized = text.toLowerCase();
    const latinTokens = normalized.match(/[a-z][a-z0-9+#.-]{1,}/g) ?? [];
    const chineseTokens = normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
    const stopWords = new Set([
      'the', 'and', 'with', 'for', 'or', 'is', 'are', 'of', 'in', 'to', 'a', 'an',
      '岗位', '负责', '要求', '具备', '熟悉', '经验', '能力', '相关', '工作', '优先',
      '以及', '进行', '支持', '职位', '描述', '职责', '任职', '以上', '以下', '提供',
      '开发', '管理', '包括', '部门', '公司', '具有', '良好', '一定', '以上学历',
    ]);

    return Array.from(new Set([...latinTokens, ...chineseTokens].filter((token) => token.length >= 2 && !stopWords.has(token)))).slice(0, 100);
  }

  private fuzzyTokenMatch(jobTokens: string[], candidateTokens: string[]): { exact: number; partial: number; totalJob: number } {
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

  private computeMatchScore(params: {
    candidateTokens: string[];
    jobTokens: string[];
    yearsOfExperience: number;
    hasResume: boolean;
    stage: string;
    parsedProfile?: Record<string, unknown> | null;
  }): number {
    const { candidateTokens, jobTokens, yearsOfExperience, hasResume, stage, parsedProfile } = params;

    // 1. 双向模糊技能匹配：岗位侧 60%，候选人侧 40%。
    const jobMatch = this.fuzzyTokenMatch(jobTokens, candidateTokens);
    const candMatch = this.fuzzyTokenMatch(candidateTokens, jobTokens);
    const jobSide = jobMatch.totalJob > 0
      ? (jobMatch.exact * 1.0 + jobMatch.partial * 0.5) / jobMatch.totalJob
      : 0.25;
    const candSide = candMatch.totalJob > 0
      ? (candMatch.exact * 1.0 + candMatch.partial * 0.5) / candMatch.totalJob
      : 0.25;
    const skillScore = Math.round((jobSide * 0.6 + candSide * 0.4) * 62);

    // 2. 非线性经验分。
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

    // 3. 简历完整性加分。
    const resumeScore = hasResume ? 6 : 0;

    // 4. 基于解析画像的教育和证书加分。
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

    // 5. 招聘阶段加分。
    const stageBonusMap: Record<string, number> = {
      'new':             0,
      'screening':       5,
      'phone_screen':    8,
      'interview':      12,
      'technical_test': 12,
      'offer':          18,
      'hired':          20,
      'rejected':      -8,
    };
    const stageBonus = stageBonusMap[stage] ?? 0;

    // 6. 原始分。
    const rawScore = skillScore + expScore + resumeScore + eduScore + stageBonus;

    // 7. 按阶段设置最低分。
    let minScore = 18;
    if (stage === 'offer' || stage === 'hired') minScore = 68;
    else if (stage === 'interview' || stage === 'technical_test') minScore = 35;

    return Math.max(minScore, Math.min(98, Math.round(rawScore)));
  }
  private scoreSearchText(text: string, terms: string[]) {
    const haystack = text.toLowerCase();

    return terms.reduce((score, term) => {
      if (!term) {
        return score;
      }

      let count = 0;
      let from = 0;
      while (true) {
        const index = haystack.indexOf(term, from);
        if (index === -1) {
          break;
        }
        count += 1;
        from = index + term.length;
      }

      return score + count;
    }, 0);
  }
}
