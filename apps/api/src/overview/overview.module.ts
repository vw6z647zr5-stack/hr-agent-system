import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '../agents/agent.module';
import { KnowledgeBaseArticleEntity, ProfileChangeRequestEntity } from '../agents/agent-support.entities';
import {
  AttendanceEntity,
  LeaveRequestEntity,
  OvertimeRequestEntity,
} from '../attendance/attendance.entities';
import {
  DepartmentEntity,
  EmployeeContractEntity,
  EmployeeEntity,
  PositionEntity,
} from '../organization/organization.entities';
import {
  PerformanceCycleEntity,
  PerformanceReviewEntity,
} from '../performance/performance.entities';
import { PayslipEntity } from '../payroll/payroll.entities';
import { RecruitmentModule } from '../recruitment/recruitment.module';
import { SelfServiceModule } from '../self-service/self-service.module';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';

@Module({
  imports: [
    AgentModule,
    RecruitmentModule,
    SelfServiceModule,
    TypeOrmModule.forFeature([
      DepartmentEntity,
      PositionEntity,
      EmployeeEntity,
      EmployeeContractEntity,
      AttendanceEntity,
      LeaveRequestEntity,
      OvertimeRequestEntity,
      PerformanceCycleEntity,
      PerformanceReviewEntity,
      PayslipEntity,
      KnowledgeBaseArticleEntity,
      ProfileChangeRequestEntity,
    ]),
  ],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
