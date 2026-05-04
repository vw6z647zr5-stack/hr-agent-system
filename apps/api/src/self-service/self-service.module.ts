import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeBaseArticleEntity, ProfileChangeRequestEntity } from '../agents/agent-support.entities';
import { AttendanceEntity, LeaveBalanceEntity, LeaveRequestEntity, OvertimeRequestEntity } from '../attendance/attendance.entities';
import { EmployeeContractEntity, EmployeeEntity } from '../organization/organization.entities';
import { PerformanceGoalEntity, PerformanceReviewEntity } from '../performance/performance.entities';
import { PayslipEntity } from '../payroll/payroll.entities';
import { SelfServiceController } from './self-service.controller';
import { SelfServiceService } from './self-service.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmployeeEntity,
      EmployeeContractEntity,
      AttendanceEntity,
      LeaveBalanceEntity,
      LeaveRequestEntity,
      OvertimeRequestEntity,
      PayslipEntity,
      PerformanceGoalEntity,
      PerformanceReviewEntity,
      ProfileChangeRequestEntity,
      KnowledgeBaseArticleEntity,
    ]),
  ],
  controllers: [SelfServiceController],
  providers: [SelfServiceService],
  exports: [SelfServiceService],
})
export class SelfServiceModule {}
