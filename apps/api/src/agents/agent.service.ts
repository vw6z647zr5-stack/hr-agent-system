import { Injectable } from '@nestjs/common';
import { EmployeeServiceChatDto, GenerateInterviewEmailDto, MatchScoreAgentDto, ParseResumeAgentDto, PerformanceAnalyzeDto } from './agent.dto';
import { AuthenticatedUser } from '../users/user.entity';
import { RecruitmentAgentService } from './services/recruitment-agent.service';
import { EmployeeAgentService } from './services/employee-agent.service';
import { PerformanceAgentService } from './services/performance-agent.service';
import { AttritionAgentService } from './services/attrition-agent.service';

/**
 * Facade 外观层，委托到各专家智能体服务。
 * 保留以供 agent.controller.ts 和 agent.gateway.ts 向后兼容。
 */
@Injectable()
export class AgentService {
  constructor(
    private readonly recruitmentAgent: RecruitmentAgentService,
    private readonly employeeAgent: EmployeeAgentService,
    private readonly performanceAgent: PerformanceAgentService,
    private readonly attritionAgent: AttritionAgentService,
  ) {}

  // --- Recruitment delegation ---

  parseResume(payload: ParseResumeAgentDto) {
    return this.recruitmentAgent.parseResume(payload);
  }

  matchScore(payload: MatchScoreAgentDto) {
    return this.recruitmentAgent.matchScore(payload);
  }

  generateInterviewEmail(payload: GenerateInterviewEmailDto) {
    return this.recruitmentAgent.generateInterviewEmail(payload);
  }

  recalculateAndPersistScore(candidateId: string) {
    return this.recruitmentAgent.recalculateAndPersistScore(candidateId);
  }

  recalculateAllScores() {
    return this.recruitmentAgent.recalculateAllScores();
  }

  // --- Employee service delegation ---

  employeeServiceChat(user: AuthenticatedUser, payload: EmployeeServiceChatDto) {
    return this.employeeAgent.employeeServiceChat(user, payload);
  }

  getKnowledgeBase() {
    return this.employeeAgent.getKnowledgeBase();
  }

  getKnowledgeSources() {
    return this.employeeAgent.getKnowledgeSources();
  }

  // --- Performance delegation ---

  analyzePerformance(payload: PerformanceAnalyzeDto) {
    return this.performanceAgent.analyzePerformance(payload);
  }

  getPerformanceInsights() {
    return this.performanceAgent.getPerformanceInsights();
  }

  // --- Attrition delegation ---

  predictAttrition(employeeId?: string) {
    return this.attritionAgent.predictAttrition(employeeId);
  }

  getHighRiskAttritionList() {
    return this.attritionAgent.getHighRiskAttritionList();
  }
}
