import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AttendanceEntity,
  LeaveBalanceEntity,
  LeaveRequestEntity,
  OvertimeRequestEntity,
} from './attendance.entities';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceEntity, LeaveRequestEntity, LeaveBalanceEntity, OvertimeRequestEntity])],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
