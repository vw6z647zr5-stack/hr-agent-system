import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileChangeRequestEntity, KnowledgeBaseArticleEntity } from '../agents/agent-support.entities';
import {
  AttendanceEntity,
  LeaveBalanceEntity,
  LeaveRequestEntity,
  OvertimeRequestEntity,
} from '../attendance/attendance.entities';
import { EmployeeContractEntity, EmployeeEntity } from '../organization/organization.entities';
import { PayslipEntity } from '../payroll/payroll.entities';
import { PerformanceGoalEntity, PerformanceReviewEntity } from '../performance/performance.entities';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { TenantContext } from '../tenant/tenant.context';
import { AuthenticatedUser, Role } from '../users/user.entity';
import {
  CreateProfileChangeRequestDto,
  CreateSelfLeaveRequestDto,
  CreateSelfOvertimeRequestDto,
  ReviewProfileChangeRequestDto,
} from './self-service.dto';

const DASHBOARD_CACHE_TTL_SECONDS = 60;
const ALLOWED_PROFILE_CHANGE_KEYS = new Set(['address', 'phone', 'emergencyContact', 'bankAccountMasked', 'avatarUrl']);

@Injectable()
export class SelfServiceService {
  constructor(
    @InjectRepository(EmployeeEntity)
    private readonly employeesRepository: Repository<EmployeeEntity>,
    @InjectRepository(EmployeeContractEntity)
    private readonly contractsRepository: Repository<EmployeeContractEntity>,
    @InjectRepository(AttendanceEntity)
    private readonly attendanceRepository: Repository<AttendanceEntity>,
    @InjectRepository(LeaveBalanceEntity)
    private readonly leaveBalancesRepository: Repository<LeaveBalanceEntity>,
    @InjectRepository(LeaveRequestEntity)
    private readonly leaveRequestsRepository: Repository<LeaveRequestEntity>,
    @InjectRepository(OvertimeRequestEntity)
    private readonly overtimeRequestsRepository: Repository<OvertimeRequestEntity>,
    @InjectRepository(PayslipEntity)
    private readonly payslipsRepository: Repository<PayslipEntity>,
    @InjectRepository(PerformanceGoalEntity)
    private readonly performanceGoalsRepository: Repository<PerformanceGoalEntity>,
    @InjectRepository(PerformanceReviewEntity)
    private readonly performanceReviewsRepository: Repository<PerformanceReviewEntity>,
    @InjectRepository(ProfileChangeRequestEntity)
    private readonly profileChangeRepository: Repository<ProfileChangeRequestEntity>,
    @InjectRepository(KnowledgeBaseArticleEntity)
    private readonly knowledgeBaseRepository: Repository<KnowledgeBaseArticleEntity>,
    private readonly redisService: RedisService,
    private readonly storageService: StorageService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getDashboard(user: AuthenticatedUser) {
    const employeeId = this.requireEmployeeId(user);
    const companyId = this.tenantContext.getCompanyId();
    const cacheKey = this.getDashboardCacheKey(employeeId);
    const cached = await this.redisService.getJson<Record<string, unknown>>(cacheKey);

    if (cached) {
      await this.ensurePayslipFilesFromDashboard(cached);
      return cached;
    }

    const employee = await this.employeesRepository.findOne({
      where: { id: employeeId, companyId },
      relations: { department: true, position: true, manager: true, user: true },
    });

    if (!employee) {
      throw new NotFoundException('未找到员工档案。');
    }

    const now = new Date();
    const monthKey = now.toISOString().slice(0, 7);

    const [
      contracts,
      leaveBalances,
      leaveRequests,
      overtimeRequests,
      attendances,
      payslips,
      reviews,
      goals,
      profileChanges,
      knowledgeArticles,
    ] = await Promise.all([
      this.contractsRepository.find({
        where: { employeeId },
        order: { startDate: 'DESC', createdAt: 'DESC' },
        take: 3,
      }),
      this.leaveBalancesRepository.find({
        where: { employeeId },
        order: { year: 'DESC', leaveType: 'ASC' },
      }),
      this.leaveRequestsRepository.find({
        where: { employeeId },
        relations: { approver: true },
        order: { createdAt: 'DESC' },
        take: 8,
      }),
      this.overtimeRequestsRepository.find({
        where: { employeeId },
        relations: { approver: true },
        order: { createdAt: 'DESC' },
        take: 8,
      }),
      this.attendanceRepository.find({
        where: { employeeId },
        order: { workDate: 'DESC' },
        take: 30,
      }),
      this.payslipsRepository.find({
        where: { employeeId, visibleToEmployee: true },
        relations: { salaryRecord: true },
        order: { issuedAt: 'DESC' },
        take: 6,
      }),
      this.performanceReviewsRepository.find({
        where: { employeeId },
        relations: { reviewer: true, cycle: true },
        order: { createdAt: 'DESC' },
        take: 3,
      }),
      this.performanceGoalsRepository.find({
        where: { employeeId },
        relations: { cycle: true },
        order: { createdAt: 'DESC' },
        take: 6,
      }),
      this.profileChangeRepository.find({
        where: { employeeId },
        relations: { reviewer: true },
        order: { createdAt: 'DESC' },
        take: 8,
      }),
      this.knowledgeBaseRepository.find({
        where: { companyId, isPublished: true },
        order: { createdAt: 'DESC' },
        take: 4,
      }),
    ]);

    const activeContract = contracts.find((item) => item.status === 'active') ?? contracts[0] ?? null;
    await Promise.all(
      payslips
        .map((item) => item.downloadPath)
        .filter((item): item is string => Boolean(item))
        .map((item) => this.storageService.ensurePdfPlaceholder(item)),
    );
    const annualLeaveBalance =
      leaveBalances.find((item) => item.leaveType === 'annual') ??
      leaveBalances.find((item) => item.year === new Date().getUTCFullYear()) ??
      leaveBalances[0] ??
      null;
    const latestPayslip = payslips[0] ?? null;
    const latestReview = reviews[0] ?? null;
    const activeGoals = goals.filter((goal) => goal.status !== 'completed').slice(0, 4);

    const attendanceSummary = {
      trackedDays: attendances.length,
      presentDays: attendances.filter((item) => item.status === 'present').length,
      lateRecords: attendances.filter((item) => this.toNumber(item.lateMinutes) > 0).length,
      anomalyRecords: attendances.filter(
        (item) => item.status === 'anomaly' || this.toNumber(item.undertimeMinutes) > 0 || Boolean(item.anomalyReason),
      ).length,
      latestStatus: attendances[0]?.status ?? null,
      latestWorkDate: attendances[0]?.workDate ?? null,
    };

    const approvedOvertimeHours = overtimeRequests
      .filter((item) => item.status === 'approved' && item.workDate.startsWith(monthKey))
      .reduce((sum, item) => sum + this.toNumber(item.hours), 0);

    const reminders = this.buildReminders({
      employee,
      annualLeaveBalance,
      activeContract,
      leaveRequests,
      overtimeRequests,
      attendances,
      profileChanges,
      latestPayslip,
    });

    const dashboard = {
      employee: {
        ...employee,
        profileCompletion: this.calculateProfileCompletion(employee),
        tenureDays: this.calculateDaysBetween(employee.joinDate),
      },
      employment: activeContract
        ? {
            id: activeContract.id,
            contractNo: activeContract.contractNo,
            contractType: activeContract.contractType,
            contractStatus: activeContract.status,
            startDate: activeContract.startDate,
            endDate: activeContract.endDate,
            probationMonths: activeContract.probationMonths,
            salaryBase: this.toNumber(activeContract.salaryBase),
            notes: activeContract.notes,
            hasDocument: Boolean(activeContract.filePath?.trim()),
            daysToExpire: activeContract.endDate ? this.calculateDaysUntil(activeContract.endDate) : null,
          }
        : null,
      stats: {
        pendingLeaveRequests: leaveRequests.filter((item) => item.status === 'pending').length,
        pendingOvertimeRequests: overtimeRequests.filter((item) => item.status === 'pending').length,
        profileChanges: profileChanges.filter((item) => item.status === 'pending').length,
        visiblePayslips: payslips.length,
        approvedOvertimeHours: Number(approvedOvertimeHours.toFixed(1)),
        lateRecords: attendanceSummary.lateRecords,
        anomalyRecords: attendanceSummary.anomalyRecords,
        annualLeaveRemaining: annualLeaveBalance ? this.toNumber(annualLeaveBalance.remainingDays) : 0,
      },
      attendanceSummary,
      leaveBalances: leaveBalances.map((item) => ({
        id: item.id,
        leaveType: item.leaveType,
        year: item.year,
        totalDays: this.toNumber(item.totalDays),
        usedDays: this.toNumber(item.usedDays),
        remainingDays: this.toNumber(item.remainingDays),
      })),
      recentAttendance: attendances.slice(0, 10).map((item) => ({
        id: item.id,
        workDate: item.workDate,
        status: item.status,
        source: item.source,
        clockInAt: item.clockInAt,
        clockOutAt: item.clockOutAt,
        lateMinutes: item.lateMinutes,
        undertimeMinutes: item.undertimeMinutes,
        anomalyReason: item.anomalyReason,
      })),
      recentLeaveRequests: leaveRequests.map((item) => ({
        id: item.id,
        leaveType: item.leaveType,
        startAt: item.startAt,
        endAt: item.endAt,
        durationDays: this.toNumber(item.durationDays),
        reason: item.reason,
        status: item.status,
        approverName: item.approver?.fullName ?? null,
        approvedAt: item.approvedAt,
        rejectionReason: item.rejectionReason,
        createdAt: item.createdAt,
      })),
      recentOvertimeRequests: overtimeRequests.map((item) => ({
        id: item.id,
        workDate: item.workDate,
        startAt: item.startAt,
        endAt: item.endAt,
        hours: this.toNumber(item.hours),
        reason: item.reason,
        status: item.status,
        approverName: item.approver?.fullName ?? null,
        approvedAt: item.approvedAt,
        createdAt: item.createdAt,
      })),
      recentProfileChanges: profileChanges.map((item) => ({
        id: item.id,
        status: item.status,
        changes: item.changes,
        reviewComment: item.reviewComment,
        reviewerName: item.reviewer?.fullName ?? null,
        reviewedAt: item.reviewedAt,
        createdAt: item.createdAt,
      })),
      approvalTimeline: this.buildApprovalTimeline({ leaveRequests, overtimeRequests, profileChanges }),
      recentPayslips: payslips.map((item) => ({
        id: item.id,
        slipNo: item.slipNo,
        issuedAt: item.issuedAt,
        downloadPath: item.downloadPath,
        salaryRecord: item.salaryRecord
          ? {
              month: item.salaryRecord.month,
              grossPay: this.toNumber(item.salaryRecord.grossPay),
              deductions: this.toNumber(item.salaryRecord.deductions),
              netPay: this.toNumber(item.salaryRecord.netPay),
              overtimeHours: this.toNumber(item.salaryRecord.overtimeHours),
              performanceScore: this.toNumber(item.salaryRecord.performanceScore),
            }
          : null,
      })),
      compensation: latestPayslip?.salaryRecord
        ? {
            month: latestPayslip.salaryRecord.month,
            grossPay: this.toNumber(latestPayslip.salaryRecord.grossPay),
            deductions: this.toNumber(latestPayslip.salaryRecord.deductions),
            netPay: this.toNumber(latestPayslip.salaryRecord.netPay),
            overtimeHours: this.toNumber(latestPayslip.salaryRecord.overtimeHours),
            performanceScore: this.toNumber(latestPayslip.salaryRecord.performanceScore),
            slipNo: latestPayslip.slipNo,
            issuedAt: latestPayslip.issuedAt,
            downloadPath: latestPayslip.downloadPath,
          }
        : null,
      performance: {
        latestReview: latestReview
          ? {
              id: latestReview.id,
              cycleName: latestReview.cycle?.name ?? null,
              overallScore: this.toNumber(latestReview.overallScore),
              rating: latestReview.rating,
              strengths: latestReview.strengths,
              improvements: latestReview.improvements,
              summary: latestReview.summary,
              reviewerName: latestReview.reviewer?.fullName ?? null,
              createdAt: latestReview.createdAt,
            }
          : null,
        activeGoals: activeGoals.map((goal) => ({
          id: goal.id,
          title: goal.title,
          category: goal.category,
          weight: this.toNumber(goal.weight),
          targetValue: goal.targetValue,
          currentValue: goal.currentValue,
          status: goal.status,
          description: goal.description,
          cycleName: goal.cycle?.name ?? null,
        })),
      },
      knowledgeBaseTips: knowledgeArticles.map((article) => ({
        id: article.id,
        category: article.category,
        title: article.title,
        question: article.question,
        answer: article.answer,
        tags: article.tags,
      })),
      reminders,
    };

    await this.redisService.setJson(cacheKey, dashboard, DASHBOARD_CACHE_TTL_SECONDS);
    return dashboard;
  }

  async getMyProfile(user: AuthenticatedUser) {
    const employeeId = this.requireEmployeeId(user);
    const companyId = this.tenantContext.getCompanyId();
    const employee = await this.employeesRepository.findOne({
      where: { id: employeeId, companyId },
      relations: { department: true, position: true, manager: true, user: true },
    });

    if (!employee) {
      throw new NotFoundException('未找到员工档案。');
    }

    return employee;
  }

  getMyLeaveBalances(user: AuthenticatedUser) {
    const employeeId = this.requireEmployeeId(user);

    return this.leaveBalancesRepository.find({
      where: { employeeId },
      order: { year: 'DESC', leaveType: 'ASC' },
    });
  }

  async getMyPayslips(user: AuthenticatedUser) {
    const employeeId = this.requireEmployeeId(user);

    const payslips = await this.payslipsRepository.find({
      where: { employeeId, visibleToEmployee: true },
      relations: { salaryRecord: true },
      order: { issuedAt: 'DESC' },
    });

    await Promise.all(
      payslips
        .map((item) => item.downloadPath)
        .filter((item): item is string => Boolean(item))
        .map((item) => this.storageService.ensurePdfPlaceholder(item)),
    );

    return payslips;
  }

  async downloadMyPayslip(user: AuthenticatedUser, id: string) {
    const employeeId = this.requireEmployeeId(user);
    const payslip = await this.payslipsRepository.findOne({
      where: { id, employeeId, visibleToEmployee: true },
    });

    if (!payslip) {
      throw new NotFoundException('未找到工资单。');
    }

    if (!payslip.downloadPath?.trim()) {
      throw new NotFoundException('未找到工资单附件。');
    }

    await this.storageService.ensurePdfPlaceholder(payslip.downloadPath);
    return this.storageService.prepareDownload(payslip.downloadPath, `${payslip.slipNo}.pdf`);
  }

  async downloadMyActiveContract(user: AuthenticatedUser) {
    const employeeId = this.requireEmployeeId(user);
    const contracts = await this.contractsRepository.find({
      where: { employeeId },
      order: { startDate: 'DESC', createdAt: 'DESC' },
      take: 3,
    });
    const activeContract = contracts.find((item) => item.status === 'active') ?? contracts[0] ?? null;

    if (!activeContract) {
      throw new NotFoundException('未找到劳动合同。');
    }

    if (!activeContract.filePath?.trim()) {
      throw new NotFoundException('当前劳动合同暂无附件。');
    }

    if (activeContract.filePath.toLowerCase().endsWith('.docx')) {
      await this.storageService.ensureDocxPlaceholder(activeContract.filePath);
    } else {
      await this.storageService.ensurePdfPlaceholder(activeContract.filePath);
    }
    return this.storageService.prepareDownload(activeContract.filePath);
  }

  async createMyLeaveRequest(user: AuthenticatedUser, payload: CreateSelfLeaveRequestDto) {
    const employeeId = this.requireEmployeeId(user);
    this.ensureValidDateRange(payload.startAt, payload.endAt, '请假');

    const durationDays = payload.durationDays ?? this.calculateDurationDays(payload.startAt, payload.endAt);
    if (durationDays <= 0) {
      throw new BadRequestException('请假时长必须大于 0。');
    }

    const record = await this.leaveRequestsRepository.save(
      this.leaveRequestsRepository.create({
        employeeId,
        approverEmployeeId: payload.approverEmployeeId ?? null,
        leaveType: payload.leaveType,
        startAt: new Date(payload.startAt),
        endAt: new Date(payload.endAt),
        durationDays,
        reason: payload.reason?.trim() ?? '',
        status: 'pending',
        rejectionReason: '',
        approvedAt: null,
      }),
    );

    await this.invalidateEmployeeDashboard(employeeId);
    return record;
  }

  async createMyOvertimeRequest(user: AuthenticatedUser, payload: CreateSelfOvertimeRequestDto) {
    const employeeId = this.requireEmployeeId(user);
    this.ensureValidDateRange(payload.startAt, payload.endAt, '加班');

    const hours = payload.hours ?? this.calculateDurationHours(payload.startAt, payload.endAt);
    if (hours <= 0) {
      throw new BadRequestException('加班时长必须大于 0。');
    }

    const record = await this.overtimeRequestsRepository.save(
      this.overtimeRequestsRepository.create({
        employeeId,
        approverEmployeeId: payload.approverEmployeeId ?? null,
        workDate: payload.workDate,
        startAt: new Date(payload.startAt),
        endAt: new Date(payload.endAt),
        hours,
        reason: payload.reason?.trim() ?? '',
        status: 'pending',
        approvedAt: null,
      }),
    );

    await this.invalidateEmployeeDashboard(employeeId);
    return record;
  }

  async listMyProfileChangeRequests(user: AuthenticatedUser) {
    const employeeId = this.requireEmployeeId(user);

    const records = await this.profileChangeRepository.find({
      where: { employeeId },
      relations: { reviewer: true },
      order: { createdAt: 'DESC' },
    });

    return records.map((item) => ({
      id: item.id,
      status: item.status,
      changes: item.changes,
      reviewComment: item.reviewComment,
      reviewerName: item.reviewer?.fullName ?? null,
      reviewedAt: item.reviewedAt,
      createdAt: item.createdAt,
    }));
  }

  async listProfileChangeReviewQueue(
    user: AuthenticatedUser,
    status?: 'all' | 'pending' | 'approved' | 'rejected',
  ) {
    this.ensureReviewPermission(user);

    return this.profileChangeRepository.find({
      where: status && status !== 'all' ? { status } : {},
      relations: {
        employee: {
          department: true,
          position: true,
        },
        reviewer: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async createProfileChangeRequest(user: AuthenticatedUser, dto: CreateProfileChangeRequestDto) {
    const employeeId = this.requireEmployeeId(user);
    const changes = this.normalizeProfileChanges(dto.changes);

    const record = await this.profileChangeRepository.save(
      this.profileChangeRepository.create({
        employeeId,
        changes,
        status: 'pending',
        reviewComment: '',
        reviewedAt: null,
      }),
    );

    await this.invalidateEmployeeDashboard(employeeId);
    return record;
  }

  async reviewProfileChangeRequest(user: AuthenticatedUser, id: string, dto: ReviewProfileChangeRequestDto) {
    this.ensureReviewPermission(user);

    const request = await this.profileChangeRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('未找到资料变更申请。');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('该资料变更申请已经处理过。');
    }

    request.status = dto.status;
    request.reviewerEmployeeId = dto.reviewerEmployeeId ?? user.employeeId;
    request.reviewComment = dto.reviewComment?.trim() ?? '';
    request.reviewedAt = new Date();

    const saved = await this.profileChangeRepository.save(request);

    if (saved.status === 'approved') {
      await this.applyApprovedProfileChanges(saved.employeeId, saved.changes);
    }

    await this.invalidateEmployeeDashboard(saved.employeeId);
    return saved;
  }

  private requireEmployeeId(user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new ForbiddenException('当前账号未绑定员工档案。');
    }

    return user.employeeId;
  }

  private ensureReviewPermission(user: AuthenticatedUser) {
    if (![Role.ADMIN, Role.HR].includes(user.role)) {
      throw new ForbiddenException('仅人力资源或系统管理员可以审批资料变更申请。');
    }
  }

  private getDashboardCacheKey(employeeId: string) {
    return `dashboard:${employeeId}:self-service-v2`;
  }

  private async invalidateEmployeeDashboard(employeeId: string) {
    await this.redisService.delete(this.getDashboardCacheKey(employeeId));
    await this.redisService.delete(`dashboard:${employeeId}`);
  }

  private normalizeProfileChanges(changes: Record<string, unknown>) {
    const normalizedEntries = Object.entries(changes)
      .filter(([key]) => ALLOWED_PROFILE_CHANGE_KEYS.has(key))
      .map<[string, unknown] | null>(([key, value]) => {
        if (value === null || value === undefined) {
          return null;
        }

        if (typeof value === 'string') {
          const trimmed = value.trim();
          return trimmed ? [key, trimmed] : null;
        }

        if (key === 'emergencyContact' && typeof value === 'object' && !Array.isArray(value)) {
          const nextValue = Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
              .map(([childKey, childValue]) => [childKey, typeof childValue === 'string' ? childValue.trim() : childValue])
              .filter(([, childValue]) => childValue !== '' && childValue !== null && childValue !== undefined),
          );

          return Object.keys(nextValue).length ? [key, nextValue] : null;
        }

        return [key, value];
      })
      .filter((entry): entry is [string, unknown] => entry !== null);

    const normalized = Object.fromEntries(normalizedEntries);

    if (Object.keys(normalized).length === 0) {
      throw new BadRequestException('请至少提供一个有效的资料变更字段。');
    }

    return normalized;
  }

  private async applyApprovedProfileChanges(employeeId: string, changes: Record<string, unknown>) {
    const employee = await this.employeesRepository.findOne({ where: { id: employeeId } });

    if (!employee) {
      throw new NotFoundException('未找到员工档案。');
    }

    for (const [key, value] of Object.entries(changes)) {
      if (ALLOWED_PROFILE_CHANGE_KEYS.has(key)) {
        (employee as unknown as Record<string, unknown>)[key] = value;
      }
    }

    await this.employeesRepository.save(employee);
  }

  private buildApprovalTimeline(input: {
    leaveRequests: LeaveRequestEntity[];
    overtimeRequests: OvertimeRequestEntity[];
    profileChanges: ProfileChangeRequestEntity[];
  }) {
    const timeline = [
      ...input.leaveRequests.map((item) => ({
        id: item.id,
        category: 'leave',
        status: item.status,
        title: `${item.leaveType}请假申请`,
        detail: `${this.toNumber(item.durationDays)} 天`,
        submittedAt: item.createdAt,
        completedAt: item.approvedAt,
      })),
      ...input.overtimeRequests.map((item) => ({
        id: item.id,
        category: 'overtime',
        status: item.status,
        title: '加班申请',
        detail: `${item.workDate} 加班 ${this.toNumber(item.hours)} 小时`,
        submittedAt: item.createdAt,
        completedAt: item.approvedAt,
      })),
      ...input.profileChanges.map((item) => ({
        id: item.id,
        category: 'profile',
        status: item.status,
        title: '资料变更申请',
        detail: `变更了 ${Object.keys(item.changes ?? {}).length} 个字段`,
        submittedAt: item.createdAt,
        completedAt: item.reviewedAt,
      })),
    ];

    return timeline
      .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime())
      .slice(0, 10);
  }

  private buildReminders(input: {
    employee: EmployeeEntity;
    annualLeaveBalance: LeaveBalanceEntity | null;
    activeContract: EmployeeContractEntity | null;
    leaveRequests: LeaveRequestEntity[];
    overtimeRequests: OvertimeRequestEntity[];
    attendances: AttendanceEntity[];
    profileChanges: ProfileChangeRequestEntity[];
    latestPayslip: PayslipEntity | null;
  }) {
    const reminders: Array<Record<string, unknown>> = [];

    if (input.leaveRequests.some((item) => item.status === 'pending')) {
      reminders.push({
        id: 'leave-pending',
        priority: 'medium',
        title: '请假申请待审批',
        description: '你的请假申请仍在等待直属经理审批。',
      });
    }

    if (input.overtimeRequests.some((item) => item.status === 'pending')) {
      reminders.push({
        id: 'overtime-pending',
        priority: 'medium',
        title: '加班申请待审批',
        description: '最近的加班记录尚未审批完成，暂时不会进入薪资计算。',
      });
    }

    if (input.profileChanges.some((item) => item.status === 'pending')) {
      reminders.push({
        id: 'profile-change-pending',
        priority: 'low',
        title: '资料变更审核中',
        description: '资料变更将在完成人力资源审批后写回员工档案。',
      });
    }

    if (input.attendances.some((item) => item.status === 'anomaly' || this.toNumber(item.lateMinutes) >= 15)) {
      reminders.push({
        id: 'attendance-attention',
        priority: 'high',
        title: '检测到考勤异常',
        description: '最近存在迟到或异常记录，可能需要补充说明或修正。',
      });
    }

    if (input.annualLeaveBalance && this.toNumber(input.annualLeaveBalance.remainingDays) <= 3) {
      reminders.push({
        id: 'leave-balance-low',
        priority: 'medium',
        title: '年假余额偏低',
        description: `当前剩余年假为 ${this.toNumber(input.annualLeaveBalance.remainingDays)} 天。`,
      });
    }

    if (input.activeContract?.endDate) {
      const daysToExpire = this.calculateDaysUntil(input.activeContract.endDate);
      if (daysToExpire !== null && daysToExpire <= 90) {
        reminders.push({
          id: 'contract-expiry',
          priority: daysToExpire <= 30 ? 'high' : 'medium',
          title: '合同续签窗口临近',
          description: `当前合同将在 ${daysToExpire} 天后到期。`,
        });
      }
    }

    if (!input.latestPayslip) {
      reminders.push({
        id: 'payslip-missing',
        priority: 'low',
        title: '暂无已发布工资单',
        description: '人力资源发布工资单后，你可以在这里直接查看。',
      });
    }

    if (!input.employee.avatarUrl || !input.employee.profileSummary) {
      reminders.push({
        id: 'profile-completion',
        priority: 'low',
        title: '完善员工档案',
        description: '补充缺失的档案信息，可提升员工自助服务完整度。',
      });
    }

    return reminders.slice(0, 6);
  }

  private calculateProfileCompletion(employee: EmployeeEntity) {
    const checks = [
      Boolean(employee.phone),
      Boolean(employee.address),
      Boolean(employee.birthDate),
      Boolean(employee.profileSummary),
      Boolean(employee.avatarUrl),
      Boolean(employee.bankAccountMasked),
      Boolean(employee.emergencyContact?.name),
      Boolean(employee.emergencyContact?.phone),
    ];

    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
  }

  private ensureValidDateRange(startAt: string, endAt: string, label: string) {
    const start = new Date(startAt);
    const end = new Date(endAt);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new BadRequestException(`${label}开始时间必须早于结束时间。`);
    }
  }

  private calculateDurationDays(startAt: string, endAt: string) {
    const diffHours = (new Date(endAt).getTime() - new Date(startAt).getTime()) / (1000 * 60 * 60);
    return Number(Math.max(diffHours / 8, 0.5).toFixed(1));
  }

  private calculateDurationHours(startAt: string, endAt: string) {
    const diffHours = (new Date(endAt).getTime() - new Date(startAt).getTime()) / (1000 * 60 * 60);
    return Number(Math.max(diffHours, 0.5).toFixed(1));
  }

  private calculateDaysBetween(startDate: string | Date, endDate = new Date()) {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      return 0;
    }

    return Math.max(Math.ceil((endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)), 0);
  }

  private calculateDaysUntil(targetDate: string) {
    const target = new Date(targetDate);
    if (Number.isNaN(target.getTime())) {
      return null;
    }

    return Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  private toNumber(value: string | number | null | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    }

    return 0;
  }

  private async ensurePayslipFilesFromDashboard(cached: Record<string, unknown>) {
    const recentPayslips = Array.isArray(cached.recentPayslips) ? cached.recentPayslips : [];
    const compensation =
      cached.compensation && typeof cached.compensation === 'object'
        ? [cached.compensation as Record<string, unknown>]
        : [];

    const downloadPaths = [...recentPayslips, ...compensation]
      .map((item) =>
        item && typeof item === 'object' && typeof (item as Record<string, unknown>).downloadPath === 'string'
          ? String((item as Record<string, unknown>).downloadPath)
          : '',
      )
      .filter(Boolean);

    await Promise.all(downloadPaths.map((item) => this.storageService.ensurePdfPlaceholder(item)));
  }
}
