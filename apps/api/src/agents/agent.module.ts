import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeBaseArticleEntity, ProfileChangeRequestEntity } from './agent-support.entities';
import {
  AttendanceEntity,
  LeaveBalanceEntity,
  LeaveRequestEntity,
  OvertimeRequestEntity,
} from '../attendance/attendance.entities';
import { DepartmentEntity, EmployeeEntity } from '../organization/organization.entities';
import { PerformanceGoalEntity, PerformanceReviewEntity } from '../performance/performance.entities';
import { CandidateEntity, JobPostingEntity, ResumeEntity } from '../recruitment/recruitment.entities';
import { UsersModule } from '../users/users.module';
import { AgentController } from './agent.controller';
import { AgentGateway } from './agent.gateway';
import { AgentService } from './agent.service';
import { CompanyFactsService } from './company-facts.service';
import { DocumentImportService } from './document-import.service';
import { DocumentRagService } from './document-rag.service';
import { KnowledgeManagementController } from './knowledge-management.controller';
import { KnowledgeManagementService } from './knowledge-management.service';

@Module({
  imports: [
    AuthModule,
    JwtModule,
    UsersModule,
    TypeOrmModule.forFeature([
      ResumeEntity,
      CandidateEntity,
      JobPostingEntity,
      KnowledgeBaseArticleEntity,
      EmployeeEntity,
      LeaveBalanceEntity,
      PerformanceReviewEntity,
      PerformanceGoalEntity,
      AttendanceEntity,
      LeaveRequestEntity,
      OvertimeRequestEntity,
      DepartmentEntity,
      ProfileChangeRequestEntity,
    ]),
  ],
  controllers: [AgentController, KnowledgeManagementController],
  providers: [
    AgentService,
    AgentGateway,
    DocumentRagService,
    KnowledgeManagementService,
    CompanyFactsService,
    DocumentImportService,
  ],
  exports: [AgentService, DocumentRagService, CompanyFactsService],
})
export class AgentModule {}
