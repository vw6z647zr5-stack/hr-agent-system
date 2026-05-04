import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceEntity, OvertimeRequestEntity } from '../attendance/attendance.entities';
import { PerformanceReviewEntity } from '../performance/performance.entities';
import { PayrollController } from './payroll.controller';
import { PayslipEntity, SalaryConfigEntity, SalaryRecordEntity } from './payroll.entities';
import { PayrollService } from './payroll.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalaryConfigEntity,
      SalaryRecordEntity,
      PayslipEntity,
      AttendanceEntity,
      OvertimeRequestEntity,
      PerformanceReviewEntity,
    ]),
  ],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
