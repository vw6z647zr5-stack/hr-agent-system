import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { Role } from '../users/user.entity';
import {
  CreateAttendanceDto,
  CreateLeaveBalanceDto,
  CreateLeaveRequestDto,
  CreateOvertimeRequestDto,
  UpdateAttendanceDto,
  UpdateLeaveBalanceDto,
  UpdateLeaveRequestDto,
  UpdateOvertimeRequestDto,
} from './attendance.dto';
import { AttendanceService } from './attendance.service';

@Controller()
@Roles(Role.ADMIN, Role.HR, Role.MANAGER)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /** 分页查询考勤记录。 */
  @Get('attendances')
  listAttendances(@Query() query: ListQueryDto) {
    return this.attendanceService.listAttendances(query);
  }

  /** 查询考勤异常。 */
  @Get('attendances/anomalies')
  listAttendanceAnomalies(@Query() query: ListQueryDto) {
    return this.attendanceService.listAttendanceAnomalies(query);
  }

  /** 返回单条考勤记录。 */
  @Get('attendances/:id')
  getAttendance(@Param('id') id: string) {
    return this.attendanceService.getAttendance(id);
  }

  /** 创建考勤记录。 */
  @Post('attendances')
  createAttendance(@Body() payload: CreateAttendanceDto) {
    return this.attendanceService.createAttendance(payload);
  }

  /** 更新考勤记录。 */
  @Patch('attendances/:id')
  updateAttendance(@Param('id') id: string, @Body() payload: UpdateAttendanceDto) {
    return this.attendanceService.updateAttendance(id, payload);
  }

  /** 删除考勤记录。 */
  @Delete('attendances/:id')
  removeAttendance(@Param('id') id: string) {
    return this.attendanceService.removeAttendance(id);
  }

  /** 模拟员工上班打卡。 */
  @Post('attendances/clock-in')
  clockIn(@Body() payload: { employeeId: string; source?: string }) {
    return this.attendanceService.clockIn(payload.employeeId, payload.source);
  }

  /** 模拟员工下班打卡。 */
  @Post('attendances/clock-out')
  clockOut(@Body() payload: { employeeId: string }) {
    return this.attendanceService.clockOut(payload.employeeId);
  }

  /** 分页查询请假申请。 */
  @Get('leave-requests')
  listLeaveRequests(@Query() query: ListQueryDto) {
    return this.attendanceService.listLeaveRequests(query);
  }

  /** 返回单条请假申请。 */
  @Get('leave-requests/:id')
  getLeaveRequest(@Param('id') id: string) {
    return this.attendanceService.getLeaveRequest(id);
  }

  /** 创建请假申请。 */
  @Post('leave-requests')
  createLeaveRequest(@Body() payload: CreateLeaveRequestDto) {
    return this.attendanceService.createLeaveRequest(payload);
  }

  /** 更新请假申请。 */
  @Patch('leave-requests/:id')
  updateLeaveRequest(@Param('id') id: string, @Body() payload: UpdateLeaveRequestDto) {
    return this.attendanceService.updateLeaveRequest(id, payload);
  }

  /** 删除请假申请。 */
  @Delete('leave-requests/:id')
  removeLeaveRequest(@Param('id') id: string) {
    return this.attendanceService.removeLeaveRequest(id);
  }

  /** 分页查询假期余额。 */
  @Get('leave-balances')
  listLeaveBalances(@Query() query: ListQueryDto) {
    return this.attendanceService.listLeaveBalances(query);
  }

  /** 返回单条假期余额。 */
  @Get('leave-balances/:id')
  getLeaveBalance(@Param('id') id: string) {
    return this.attendanceService.getLeaveBalance(id);
  }

  /** 创建假期余额记录。 */
  @Post('leave-balances')
  createLeaveBalance(@Body() payload: CreateLeaveBalanceDto) {
    return this.attendanceService.createLeaveBalance(payload);
  }

  /** 更新假期余额记录。 */
  @Patch('leave-balances/:id')
  updateLeaveBalance(@Param('id') id: string, @Body() payload: UpdateLeaveBalanceDto) {
    return this.attendanceService.updateLeaveBalance(id, payload);
  }

  /** 删除假期余额记录。 */
  @Delete('leave-balances/:id')
  removeLeaveBalance(@Param('id') id: string) {
    return this.attendanceService.removeLeaveBalance(id);
  }

  /** 分页查询加班申请。 */
  @Get('overtime-requests')
  listOvertimeRequests(@Query() query: ListQueryDto) {
    return this.attendanceService.listOvertimeRequests(query);
  }

  /** 返回单条加班申请。 */
  @Get('overtime-requests/:id')
  getOvertimeRequest(@Param('id') id: string) {
    return this.attendanceService.getOvertimeRequest(id);
  }

  /** 创建加班申请。 */
  @Post('overtime-requests')
  createOvertimeRequest(@Body() payload: CreateOvertimeRequestDto) {
    return this.attendanceService.createOvertimeRequest(payload);
  }

  /** 更新加班申请。 */
  @Patch('overtime-requests/:id')
  updateOvertimeRequest(@Param('id') id: string, @Body() payload: UpdateOvertimeRequestDto) {
    return this.attendanceService.updateOvertimeRequest(id, payload);
  }

  /** 删除加班申请。 */
  @Delete('overtime-requests/:id')
  removeOvertimeRequest(@Param('id') id: string) {
    return this.attendanceService.removeOvertimeRequest(id);
  }
}
