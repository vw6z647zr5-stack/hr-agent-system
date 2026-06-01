import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { TenantContext } from '../../tenant/tenant.context';
import { LeaveBalanceEntity, LeaveRequestEntity, OvertimeRequestEntity } from '../../attendance/attendance.entities';
import { EmployeeEntity } from '../../organization/organization.entities';
import { KnowledgeBaseArticleEntity } from '../agent-support.entities';
import { AuthenticatedUser } from '../../users/user.entity';
import { EmployeeServiceChatDto } from '../agent.dto';
import { CompanyFactsService } from '../company-facts.service';
import { DocumentRagService, type RagReference } from '../document-rag.service';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { AgentRunLogService } from './agent-run-log.service';
import {
  createKnowledgeBaseSearchTool,
  createCompanyDocumentSearchTool,
  createCompanyFactsSearchTool,
  createEmployeeLookupTool,
  createLeaveBalanceLookupTool,
} from '../tools/employee.tools';

@Injectable()
export class EmployeeAgentService {
  constructor(
    @InjectRepository(KnowledgeBaseArticleEntity)
    private readonly knowledgeBaseRepository: Repository<KnowledgeBaseArticleEntity>,
    @InjectRepository(EmployeeEntity)
    private readonly employeesRepository: Repository<EmployeeEntity>,
    @InjectRepository(LeaveBalanceEntity)
    private readonly leaveBalancesRepository: Repository<LeaveBalanceEntity>,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly documentRagService: DocumentRagService,
    private readonly companyFactsService: CompanyFactsService,
    private readonly redisService: RedisService,
    private readonly tenantContext: TenantContext,
    private readonly runLogService: AgentRunLogService,
  ) {}

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
    const groundedReply = this.buildEmployeeServiceGroundedAnswer(message, employee, leaveBalances, knowledge.articles, knowledge.documents);

    const { reply, aiTrace } = groundedReply
      ? { reply: groundedReply, aiTrace: this.orchestrator.buildGroundedTrace() }
      : await this.orchestrator.runAgentWithTrace({
          systemPrompt: '你是员工服务助手，请用清晰、简洁的中文回答制度与员工自助相关问题，并在可用时结合员工上下文。',
          input: JSON.stringify({ question: message, history, employee, leaveBalances, knowledgeBase: knowledge.articles, companyDocuments: knowledge.documents, companyFacts: knowledge.companyFacts }),
          tools: [
            createKnowledgeBaseSearchTool(this.orchestrator.createTool.bind(this.orchestrator), this.orchestrator.zod, this.searchKnowledgeBase.bind(this)),
            createCompanyDocumentSearchTool(this.orchestrator.createTool.bind(this.orchestrator), this.orchestrator.zod, this.documentRagService.search.bind(this.documentRagService)),
            createCompanyFactsSearchTool(this.orchestrator.createTool.bind(this.orchestrator), this.orchestrator.zod, this.companyFactsService.listFacts.bind(this.companyFactsService)),
            createEmployeeLookupTool(this.orchestrator.createTool.bind(this.orchestrator), this.orchestrator.zod, this.lookupEmployee.bind(this)),
            createLeaveBalanceLookupTool(this.orchestrator.createTool.bind(this.orchestrator), this.orchestrator.zod, this.lookupBalances.bind(this)),
          ],
          fallback: async () => this.buildEmployeeServiceFallback(message, employee, leaveBalances, knowledge.articles, knowledge.documents),
        }).then((r) => ({ reply: r.output, aiTrace: r.trace }));

    const nextHistory = [...history.slice(-8), { role: 'user', content: message }, { role: 'assistant', content: reply }];
    await this.redisService.setJson(historyKey, nextHistory, 60 * 60 * 2);

    this.runLogService.record({
      user,
      agentType: 'employee_service',
      action: 'chat',
      trace: aiTrace,
      subjectType: employeeId ? 'employee' : 'user',
      subjectId: employeeId ?? user.userId,
      summary: reply,
      metadata: {
        referenceCount: knowledge.articles.length + knowledge.documents.length,
        companyFactCount: knowledge.companyFacts.length,
        historyCount: history.length,
      },
    });

    return { reply, references: this.composeVisibleReferences(knowledge.articles, knowledge.documents), aiTrace };
  }

  getKnowledgeBase() {
    const companyId = this.tenantContext.getCompanyId();
    return this.knowledgeBaseRepository.find({ where: { companyId, isPublished: true }, order: { createdAt: 'DESC' } });
  }

  async getKnowledgeSources() {
    const [articles, documents, companyFacts] = await Promise.all([
      this.getKnowledgeBase(),
      this.documentRagService.listSources(),
      this.companyFactsService.getPublishedFacts(),
    ]);
    return {
      articles: articles.map((a) => ({ id: a.id, title: a.title, category: a.category, sourceType: 'knowledge_base' })),
      documents,
      companyFacts,
    };
  }

  // --- 私有内部方法 ---

  private normalizeChatMessage(payload: EmployeeServiceChatDto) {
    const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
    if (!message) throw new BadRequestException('请输入要咨询的问题。');
    if (message.length > 1_000) throw new BadRequestException('单次咨询内容不能超过 1000 个字符。');
    return message;
  }

  private async searchKnowledgeBase(query: string) {
    const companyId = this.tenantContext.getCompanyIdOrNull();
    const articles = await this.knowledgeBaseRepository.find({ where: { companyId: companyId ?? undefined, isPublished: true } });
    const terms = this.orchestrator.extractSearchTerms(query);
    return articles
      .map((article) => ({ article, score: this.orchestrator.scoreSearchText([article.title, article.question, article.answer, ...(article.tags ?? [])].join(' '), terms) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.article)
      .slice(0, 5);
  }

  private async searchEmployeeKnowledge(query: string) {
    const [articles, documents, companyFacts] = await Promise.all([
      this.searchKnowledgeBase(query),
      this.documentRagService.search(query, 5),
      this.companyFactsService.listFacts({ search: query, status: 'published' }),
    ]);
    return { articles, documents, companyFacts: companyFacts.slice(0, 6) };
  }

  private getLeaveTypeLabel(value: string) {
    const labels: Record<string, string> = { annual: '年假', sick: '病假', marriage: '婚假', personal: '事假', maternity: '产假', paternity: '陪产假' };
    return labels[value] ?? value;
  }

  private async lookupEmployee(employeeId: string) {
    const companyId = this.tenantContext.getCompanyIdOrNull();
    return this.employeesRepository.findOne({
      where: { id: employeeId, companyId: companyId ?? undefined },
      relations: { department: true, position: true, manager: true },
    });
  }

  private async lookupBalances(employeeId: string) {
    return this.leaveBalancesRepository.find({ where: { employeeId } });
  }

  private buildEmployeeServiceGroundedAnswer(
    question: string, employee: EmployeeEntity | null,
    leaveBalances: LeaveBalanceEntity[],
    articles: KnowledgeBaseArticleEntity[],
    documentReferences: RagReference[],
  ) {
    const lower = question.toLowerCase();
    const hasGrounding = articles.length > 0 || documentReferences.length > 0;
    if (!hasGrounding && !(lower.includes('假') || lower.includes('leave'))) return null;

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
      if (source) return `${greeting}\n\n${source}`;
    }

    if (lower.includes('工资') || lower.includes('payslip') || lower.includes('薪酬')) {
      const source = articles[0]?.answer ?? documentReferences[0]?.excerpt;
      if (source) return `${greeting}\n\n${source}`;
    }

    if (documentReferences.length > 0) {
      const top = documentReferences[0]!;
      return `${greeting}\n\n${top.excerpt}\n\n来源：${top.title} / ${top.section}`;
    }

    if (articles.length > 0) return `${greeting}\n\n${articles[0]!.answer}`;

    return null;
  }

  private buildEmployeeServiceFallback(
    question: string, employee: EmployeeEntity | null,
    leaveBalances: LeaveBalanceEntity[],
    articles: KnowledgeBaseArticleEntity[],
    documentReferences: RagReference[],
  ) {
    const lower = question.toLowerCase();

    if (lower.includes('假') || lower.includes('leave')) {
      const summary = leaveBalances.map((item) => `${this.getLeaveTypeLabel(item.leaveType)}：剩余 ${item.remainingDays} 天`).join('；');
      const policyNote = documentReferences[0]?.excerpt || articles[0]?.answer || '';
      return [summary || '当前没有可用的假期余额记录。', policyNote].filter(Boolean).join('\n\n制度说明：');
    }

    if (lower.includes('工资') || lower.includes('payslip')) {
      return [articles[0]?.answer ?? '工资单可在员工自助服务工作台的薪酬区域查看，已发布的工资单会自动展示。', documentReferences[0]?.excerpt].filter(Boolean).join('\n\n依据：');
    }

    if (documentReferences.length > 0) {
      const top = documentReferences[0]!;
      return `${top.excerpt}\n\n来源：${top.title} / ${top.section}`;
    }

    if (articles.length > 0) return articles[0]?.answer ?? '暂未找到匹配的知识库条目。';

    return `您好${employee ? `，${employee.fullName}` : ''}。当前未命中知识库条目，请联系人力资源获取进一步帮助。`;
  }

  private composeVisibleReferences(articles: KnowledgeBaseArticleEntity[], documents: RagReference[]) {
    const articleRefs = articles.slice(0, 3).map((a) => ({ id: a.id, title: a.title, category: a.category, sourceType: 'knowledge_base', excerpt: a.answer }));
    const documentRefs = documents.slice(0, 3).map((d) => ({ id: d.id, title: d.title, category: d.category, sourceType: 'document', sourcePath: d.sourcePath, section: d.section, excerpt: d.excerpt }));
    return [...articleRefs, ...documentRefs];
  }
}
