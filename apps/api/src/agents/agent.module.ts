import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { CompanyEntity } from '../company/company.entity';
import { AgentRunLogEntity, KnowledgeBaseArticleEntity, ProfileChangeRequestEntity } from './agent-support.entities';
import {
  AttendanceEntity,
  LeaveBalanceEntity,
  LeaveRequestEntity,
  OvertimeRequestEntity,
} from '../attendance/attendance.entities';
import { DepartmentEntity, EmployeeEntity, EmployeeContractEntity } from '../organization/organization.entities';
import { PerformanceGoalEntity, PerformanceReviewEntity } from '../performance/performance.entities';
import { CandidateEntity, JobPostingEntity, ResumeEntity } from '../recruitment/recruitment.entities';
import { WorkflowNotificationEntity } from '../workflows/workflow.entities';
import { UsersModule } from '../users/users.module';
import { AgentController } from './agent.controller';
import { AgentGateway } from './agent.gateway';
import { AgentService } from './agent.service';
import { CompanyFactsService } from './company-facts.service';
import { DocumentImportService } from './document-import.service';
import { DocumentRagService } from './document-rag.service';
import { KnowledgeManagementController } from './knowledge-management.controller';
import { KnowledgeManagementService } from './knowledge-management.service';

// 专家智能体服务导入
import { AgentOrchestratorService } from './services/agent-orchestrator.service';
import { AgentRunLogService } from './services/agent-run-log.service';
import { RecruitmentAgentService } from './services/recruitment-agent.service';
import { EmployeeAgentService } from './services/employee-agent.service';
import { PerformanceAgentService } from './services/performance-agent.service';
import { AttritionAgentService } from './services/attrition-agent.service';
import { ProactiveAgentService } from './services/proactive-agent.service';
import { PulseSurveyService } from './services/pulse-survey.service';
import { PulseSurveyEntity, PulseSurveyResponseEntity } from './pulse-survey.entities';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    JwtModule,
    UsersModule,
    TypeOrmModule.forFeature([
      CompanyEntity,
      ResumeEntity,
      CandidateEntity,
      JobPostingEntity,
      KnowledgeBaseArticleEntity,
      AgentRunLogEntity,
      EmployeeEntity,
      LeaveBalanceEntity,
      PerformanceReviewEntity,
      PerformanceGoalEntity,
      AttendanceEntity,
      LeaveRequestEntity,
      OvertimeRequestEntity,
      DepartmentEntity,
      EmployeeContractEntity,
      ProfileChangeRequestEntity,
      WorkflowNotificationEntity,
      PulseSurveyEntity,
      PulseSurveyResponseEntity,
    ]),
  ],
  controllers: [AgentController, KnowledgeManagementController],
  providers: [
    // 共享指挥者
    AgentOrchestratorService,
    AgentRunLogService,

    // 专家智能体服务
    RecruitmentAgentService,
    EmployeeAgentService,
    PerformanceAgentService,
    AttritionAgentService,
    ProactiveAgentService,
    PulseSurveyService,

    // Facade 外观层（向后兼容）
    AgentService,
    AgentGateway,

    // 已有服务
    DocumentRagService,
    KnowledgeManagementService,
    CompanyFactsService,
    DocumentImportService,
  ],
  exports: [
    AgentService,
    RecruitmentAgentService,
    EmployeeAgentService,
    PerformanceAgentService,
    AttritionAgentService,
    ProactiveAgentService,
    PulseSurveyService,
    AgentOrchestratorService,
    AgentRunLogService,
    DocumentRagService,
    CompanyFactsService,
  ],
})
export class AgentModule {}
