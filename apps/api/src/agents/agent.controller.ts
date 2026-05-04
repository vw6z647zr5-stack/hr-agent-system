import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, Role } from '../users/user.entity';
import {
  EmployeeServiceChatDto,
  GenerateInterviewEmailDto,
  MatchScoreAgentDto,
  ParseResumeAgentDto,
  PerformanceAnalyzeDto,
} from './agent.dto';
import { AgentService } from './agent.service';
import { CompanyFactsService } from './company-facts.service';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly companyFactsService: CompanyFactsService,
  ) {}

  /** 将已存简历或原始简历文本解析为结构化候选人数据。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @Post('recruitment/parse-resume')
  parseResume(@Body() payload: ParseResumeAgentDto) {
    return this.agentService.parseResume(payload);
  }

  /** 计算候选人与岗位的匹配分，用于招聘筛选。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @Post('recruitment/match-score')
  matchScore(@Body() payload: MatchScoreAgentDto) {
    return this.agentService.matchScore(payload);
  }

  /** 重新计算单名候选人的匹配分并写入数据库。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @Post('recruitment/recalculate-score')
  recalculateScore(@Body() payload: MatchScoreAgentDto) {
    return this.agentService.recalculateAndPersistScore(payload.candidateId!);
  }

  /** 批量重新计算全部候选人的匹配分并写入数据库。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @Post('recruitment/recalculate-all-scores')
  recalculateAllScores() {
    return this.agentService.recalculateAllScores();
  }

  /** 生成面试邀约邮件草稿。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @Post('recruitment/generate-interview-email')
  generateInterviewEmail(@Body() payload: GenerateInterviewEmailDto) {
    return this.agentService.generateInterviewEmail(payload);
  }

  /** 与员工服务问答智能体对话。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Post('employee-service/chat')
  employeeServiceChat(@CurrentUser() user: AuthenticatedUser, @Body() payload: EmployeeServiceChatDto) {
    return this.agentService.employeeServiceChat(user, payload);
  }

  /** 返回已发布的员工服务知识库条目。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Get('employee-service/knowledge-base')
  getKnowledgeBase() {
    return this.agentService.getKnowledgeBase();
  }

  /** 返回全部可用知识来源，包括本地 RAG 文档。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Get('employee-service/knowledge-sources')
  getKnowledgeSources() {
    return this.agentService.getKnowledgeSources();
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Get('employee-service/company-facts')
  getPublishedCompanyFacts() {
    return this.companyFactsService.getPublishedFacts();
  }

  /** 分析绩效数据并生成改进建议。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @Post('performance/analyze')
  analyzePerformance(@Body() payload: PerformanceAnalyzeDto) {
    return this.agentService.analyzePerformance(payload);
  }

  /** 返回汇总后的绩效洞察重点。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @Get('performance/insights')
  getPerformanceInsights() {
    return this.agentService.getPerformanceInsights();
  }

  /** 预测单名员工或全部员工的流失风险。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @Get('attrition/predict')
  predictAttrition(@Query('employeeId') employeeId?: string) {
    return this.agentService.predictAttrition(employeeId);
  }

  /** 返回当前高流失风险员工列表。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @Get('attrition/high-risk-list')
  getHighRiskList() {
    return this.agentService.getHighRiskAttritionList();
  }
}
