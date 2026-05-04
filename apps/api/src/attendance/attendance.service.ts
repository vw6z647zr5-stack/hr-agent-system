import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { paginateQuery } from '../common/utils/pagination';
import { RedisService } from '../redis/redis.service';
import { TenantContext } from '../tenant/tenant.context';
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
import {
  AttendanceEntity,
  LeaveBalanceEntity,
  LeaveRequestEntity,
  OvertimeRequestEntity,
} from './attendance.entities';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceEntity)
    private readonly attendanceRepository: Repository<AttendanceEntity>,
    @InjectRepository(LeaveRequestEntity)
    private readonly leaveRequestsRepository: Repository<LeaveRequestEntity>,
    @InjectRepository(LeaveBalanceEntity)
    private readonly leaveBalancesRepository: Repository<LeaveBalanceEntity>,
    @InjectRepository(OvertimeRequestEntity)
    private readonly overtimeRepository: Repository<OvertimeRequestEntity>,
    private readonly redisService: RedisService,
    private readonly tenantContext: TenantContext,
  ) {}

  async listAttendances(query: ListQueryDto) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.attendanceRepository
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.employee', 'employee')
      .where('employee.company_id = :companyId', { companyId })
      .orderBy('attendance.workDate', 'DESC');

    if (query.search) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('employee.fullName ILIKE :search', { search: `%${query.search}%` }).orWhere(
            'attendance.anomalyReason ILIKE :search',
            { search: `%${query.search}%` },
          );
        }),
      );
    }

    if (query.employeeId) {
      builder.andWhere('attendance.employeeId = :employeeId', { employeeId: query.employeeId });
    }

    if (query.status) {
      builder.andWhere('attendance.status = :status', { status: query.status });
    }

    return paginateQuery(builder, query);
  }

  async listAttendanceAnomalies(query: ListQueryDto) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.attendanceRepository
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.employee', 'employee')
      .where('employee.company_id = :companyId', { companyId })
      .andWhere('attendance.lateMinutes > 0 OR attendance.undertimeMinutes > 0 OR attendance.status = :status', {
        status: 'anomaly',
      })
      .orderBy('attendance.workDate', 'DESC');

    if (query.employeeId) {
      builder.andWhere('attendance.employeeId = :employeeId', { employeeId: query.employeeId });
    }

    return paginateQuery(builder, query);
  }

  async getAttendance(id: string) {
    const entity = await this.attendanceRepository.findOne({ where: { id }, relations: { employee: true } });
    if (!entity) {
      throw new NotFoundException('未找到考勤记录。');
    }

    return entity;
  }

  createAttendance(dto: CreateAttendanceDto) {
    return this.saveAttendanceWithInvalidation(this.attendanceRepository.create(dto), dto.employeeId);
  }

  async updateAttendance(id: string, dto: UpdateAttendanceDto) {
    const current = await this.getAttendance(id);
    const entity = await this.attendanceRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到考勤记录。');
    }

    return this.saveAttendanceWithInvalidation(entity, current.employeeId, dto.employeeId);
  }

  async removeAttendance(id: string) {
    const entity = await this.getAttendance(id);
    await this.attendanceRepository.delete(id);
    await this.invalidateEmployeeDashboard(entity.employeeId);
    return { success: true };
  }

  async clockIn(employeeId: string, source = 'web') {
    const now = new Date();
    const workDate = now.toISOString().slice(0, 10);
    const startHour = 9;
    const lateMinutes = Math.max(0, (now.getHours() - startHour) * 60 + now.getMinutes());

    const existing = await this.attendanceRepository.findOne({ where: { employeeId, workDate } });

    if (existing) {
      return this.updateAttendance(existing.id, {
        employeeId,
        workDate,
        clockInAt: now.toISOString(),
        source,
        lateMinutes,
        status: lateMinutes > 0 ? 'late' : 'present',
        anomalyReason: lateMinutes > 0 ? '系统自动识别为上班打卡迟到。' : '',
      });
    }

    return this.createAttendance({
      employeeId,
      workDate,
      clockInAt: now.toISOString(),
      source,
      lateMinutes,
      status: lateMinutes > 0 ? 'late' : 'present',
      anomalyReason: lateMinutes > 0 ? '系统自动识别为上班打卡迟到。' : '',
    });
  }

  async clockOut(employeeId: string) {
    const now = new Date();
    const workDate = now.toISOString().slice(0, 10);
    const existing = await this.attendanceRepository.findOne({ where: { employeeId, workDate } });

    if (!existing) {
      return this.createAttendance({
        employeeId,
        workDate,
        clockOutAt: now.toISOString(),
        status: 'anomaly',
        anomalyReason: '检测到下班打卡，但未找到对应的上班打卡记录。',
      });
    }

    const undertimeMinutes = now.getHours() < 18 ? (18 - now.getHours()) * 60 - now.getMinutes() : 0;

    return this.updateAttendance(existing.id, {
      employeeId,
      workDate,
      clockInAt: existing.clockInAt?.toISOString(),
      clockOutAt: now.toISOString(),
      source: existing.source,
      lateMinutes: existing.lateMinutes,
      undertimeMinutes: Math.max(0, undertimeMinutes),
      status: existing.lateMinutes > 0 || undertimeMinutes > 0 ? 'anomaly' : existing.status,
      anomalyReason: undertimeMinutes > 0 ? '系统自动识别为早退。' : existing.anomalyReason,
    });
  }

  async listLeaveRequests(query: ListQueryDto) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.leaveRequestsRepository
      .createQueryBuilder('leaveRequest')
      .leftJoinAndSelect('leaveRequest.employee', 'employee')
      .leftJoinAndSelect('leaveRequest.approver', 'approver')
      .where('employee.company_id = :companyId', { companyId })
      .orderBy('leaveRequest.createdAt', 'DESC');

    if (query.search) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('employee.fullName ILIKE :search', { search: `%${query.search}%` }).orWhere(
            'leaveRequest.reason ILIKE :search',
            { search: `%${query.search}%` },
          );
        }),
      );
    }

    if (query.employeeId) {
      builder.andWhere('leaveRequest.employeeId = :employeeId', { employeeId: query.employeeId });
    }

    if (query.status) {
      builder.andWhere('leaveRequest.status = :status', { status: query.status });
    }

    return paginateQuery(builder, query);
  }

  async getLeaveRequest(id: string) {
    const entity = await this.leaveRequestsRepository.findOne({
      where: { id },
      relations: { employee: true, approver: true },
    });
    if (!entity) {
      throw new NotFoundException('未找到请假申请。');
    }

    return entity;
  }

  createLeaveRequest(dto: CreateLeaveRequestDto) {
    return this.saveLeaveRequestWithInvalidation(this.leaveRequestsRepository.create(dto), dto.employeeId);
  }

  async updateLeaveRequest(id: string, dto: UpdateLeaveRequestDto) {
    const current = await this.getLeaveRequest(id);
    const entity = await this.leaveRequestsRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到请假申请。');
    }

    const saved = await this.leaveRequestsRepository.save(entity);

    if (current.status !== 'approved' && saved.status === 'approved') {
      const leaveYear = new Date(saved.startAt).getUTCFullYear();
      await this.consumeLeaveBalance(saved.employeeId, saved.leaveType, leaveYear, Number(saved.durationDays));
    }

    await this.invalidateEmployeeDashboard(current.employeeId);
    if (dto.employeeId && dto.employeeId !== current.employeeId) {
      await this.invalidateEmployeeDashboard(dto.employeeId);
    }

    return saved;
  }

  async removeLeaveRequest(id: string) {
    const entity = await this.getLeaveRequest(id);
    await this.leaveRequestsRepository.delete(id);
    await this.invalidateEmployeeDashboard(entity.employeeId);
    return { success: true };
  }

  async listLeaveBalances(query: ListQueryDto) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.leaveBalancesRepository
      .createQueryBuilder('leaveBalance')
      .leftJoinAndSelect('leaveBalance.employee', 'employee')
      .where('employee.company_id = :companyId', { companyId })
      .orderBy('leaveBalance.year', 'DESC');

    if (query.employeeId) {
      builder.andWhere('leaveBalance.employeeId = :employeeId', { employeeId: query.employeeId });
    }

    if (query.search) {
      builder.andWhere('employee.fullName ILIKE :search', { search: `%${query.search}%` });
    }

    return paginateQuery(builder, query);
  }

  async getLeaveBalance(id: string) {
    const entity = await this.leaveBalancesRepository.findOne({ where: { id }, relations: { employee: true } });
    if (!entity) {
      throw new NotFoundException('未找到假期余额记录。');
    }

    return entity;
  }

  createLeaveBalance(dto: CreateLeaveBalanceDto) {
    return this.saveLeaveBalanceWithInvalidation(
      this.leaveBalancesRepository.create({
        ...dto,
        usedDays: dto.usedDays ?? 0,
        remainingDays: dto.remainingDays ?? dto.totalDays - (dto.usedDays ?? 0),
      }),
      dto.employeeId,
    );
  }

  async updateLeaveBalance(id: string, dto: UpdateLeaveBalanceDto) {
    const current = await this.getLeaveBalance(id);
    const entity = await this.leaveBalancesRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到假期余额记录。');
    }

    if (dto.totalDays !== undefined || dto.usedDays !== undefined) {
      const total = dto.totalDays ?? Number(entity.totalDays);
      const used = dto.usedDays ?? Number(entity.usedDays);
      entity.remainingDays = String(dto.remainingDays ?? total - used);
    }

    const saved = await this.leaveBalancesRepository.save(entity);
    await this.invalidateEmployeeDashboard(current.employeeId);
    if (dto.employeeId && dto.employeeId !== current.employeeId) {
      await this.invalidateEmployeeDashboard(dto.employeeId);
    }
    return saved;
  }

  async removeLeaveBalance(id: string) {
    const entity = await this.getLeaveBalance(id);
    await this.leaveBalancesRepository.delete(id);
    await this.invalidateEmployeeDashboard(entity.employeeId);
    return { success: true };
  }

  async listOvertimeRequests(query: ListQueryDto) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.overtimeRepository
      .createQueryBuilder('overtime')
      .leftJoinAndSelect('overtime.employee', 'employee')
      .leftJoinAndSelect('overtime.approver', 'approver')
      .where('employee.company_id = :companyId', { companyId })
      .orderBy('overtime.createdAt', 'DESC');

    if (query.employeeId) {
      builder.andWhere('overtime.employeeId = :employeeId', { employeeId: query.employeeId });
    }

    if (query.status) {
      builder.andWhere('overtime.status = :status', { status: query.status });
    }

    if (query.search) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('employee.fullName ILIKE :search', { search: `%${query.search}%` }).orWhere(
            'overtime.reason ILIKE :search',
            { search: `%${query.search}%` },
          );
        }),
      );
    }

    return paginateQuery(builder, query);
  }

  async getOvertimeRequest(id: string) {
    const entity = await this.overtimeRepository.findOne({
      where: { id },
      relations: { employee: true, approver: true },
    });
    if (!entity) {
      throw new NotFoundException('未找到加班申请。');
    }

    return entity;
  }

  createOvertimeRequest(dto: CreateOvertimeRequestDto) {
    return this.saveOvertimeRequestWithInvalidation(this.overtimeRepository.create(dto), dto.employeeId);
  }

  async updateOvertimeRequest(id: string, dto: UpdateOvertimeRequestDto) {
    const current = await this.getOvertimeRequest(id);
    const entity = await this.overtimeRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到加班申请。');
    }

    const saved = await this.overtimeRepository.save(entity);
    await this.invalidateEmployeeDashboard(current.employeeId);
    if (dto.employeeId && dto.employeeId !== current.employeeId) {
      await this.invalidateEmployeeDashboard(dto.employeeId);
    }
    return saved;
  }

  async removeOvertimeRequest(id: string) {
    const entity = await this.getOvertimeRequest(id);
    await this.overtimeRepository.delete(id);
    await this.invalidateEmployeeDashboard(entity.employeeId);
    return { success: true };
  }

  private async saveAttendanceWithInvalidation(
    entity: AttendanceEntity,
    ...employeeIds: Array<string | null | undefined>
  ) {
    const saved = await this.attendanceRepository.save(entity);
    await this.invalidateEmployeeDashboards(employeeIds);
    return saved;
  }

  private async saveLeaveRequestWithInvalidation(
    entity: LeaveRequestEntity,
    ...employeeIds: Array<string | null | undefined>
  ) {
    const saved = await this.leaveRequestsRepository.save(entity);
    await this.invalidateEmployeeDashboards(employeeIds);
    return saved;
  }

  private async saveLeaveBalanceWithInvalidation(
    entity: LeaveBalanceEntity,
    ...employeeIds: Array<string | null | undefined>
  ) {
    const saved = await this.leaveBalancesRepository.save(entity);
    await this.invalidateEmployeeDashboards(employeeIds);
    return saved;
  }

  private async saveOvertimeRequestWithInvalidation(
    entity: OvertimeRequestEntity,
    ...employeeIds: Array<string | null | undefined>
  ) {
    const saved = await this.overtimeRepository.save(entity);
    await this.invalidateEmployeeDashboards(employeeIds);
    return saved;
  }

  private async consumeLeaveBalance(
    employeeId: string,
    leaveType: string,
    year: number,
    usedDays: number,
  ): Promise<void> {
    const balance = await this.leaveBalancesRepository.findOne({
      where: { employeeId, leaveType, year },
    });

    if (!balance) {
      return;
    }

    const currentUsed = Number(balance.usedDays);
    const total = Number(balance.totalDays);
    balance.usedDays = String(currentUsed + usedDays);
    balance.remainingDays = String(Math.max(0, total - currentUsed - usedDays));
    await this.leaveBalancesRepository.save(balance);
    await this.invalidateEmployeeDashboard(employeeId);
  }

  private async invalidateEmployeeDashboards(employeeIds: Array<string | null | undefined>) {
    const uniqueIds = [...new Set(employeeIds.filter((item): item is string => Boolean(item)))];
    await Promise.all(uniqueIds.map((item) => this.invalidateEmployeeDashboard(item)));
  }

  private async invalidateEmployeeDashboard(employeeId: string) {
    await this.redisService.delete(`dashboard:${employeeId}:self-service-v2`);
    await this.redisService.delete(`dashboard:${employeeId}`);
  }
}
