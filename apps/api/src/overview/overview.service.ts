import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentService } from '../agents/agent.service';
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
import { RecruitmentService } from '../recruitment/recruitment.service';
import { SelfServiceService } from '../self-service/self-service.service';
import { AuthenticatedUser, Role } from '../users/user.entity';

@Injectable()
export class OverviewService {
  constructor(
    @InjectRepository(DepartmentEntity)
    private readonly departmentsRepository: Repository<DepartmentEntity>,
    @InjectRepository(PositionEntity)
    private readonly positionsRepository: Repository<PositionEntity>,
    @InjectRepository(EmployeeEntity)
    private readonly employeesRepository: Repository<EmployeeEntity>,
    @InjectRepository(EmployeeContractEntity)
    private readonly contractsRepository: Repository<EmployeeContractEntity>,
    @InjectRepository(AttendanceEntity)
    private readonly attendanceRepository: Repository<AttendanceEntity>,
    @InjectRepository(LeaveRequestEntity)
    private readonly leaveRequestsRepository: Repository<LeaveRequestEntity>,
    @InjectRepository(OvertimeRequestEntity)
    private readonly overtimeRequestsRepository: Repository<OvertimeRequestEntity>,
    @InjectRepository(PerformanceCycleEntity)
    private readonly cyclesRepository: Repository<PerformanceCycleEntity>,
    @InjectRepository(PerformanceReviewEntity)
    private readonly reviewsRepository: Repository<PerformanceReviewEntity>,
    @InjectRepository(PayslipEntity)
    private readonly payslipsRepository: Repository<PayslipEntity>,
    @InjectRepository(KnowledgeBaseArticleEntity)
    private readonly knowledgeBaseRepository: Repository<KnowledgeBaseArticleEntity>,
    @InjectRepository(ProfileChangeRequestEntity)
    private readonly profileChangeRepository: Repository<ProfileChangeRequestEntity>,
    private readonly recruitmentService: RecruitmentService,
    private readonly agentService: AgentService,
    private readonly selfServiceService: SelfServiceService,
  ) {}

  async getDashboard(user: AuthenticatedUser) {
    if (user.role === Role.EMPLOYEE) {
      return this.getEmployeeDashboard(user);
    }

    return this.getManagementDashboard();
  }

  private async getManagementDashboard() {
    const now = new Date();
    const lastThirtyDays = this.toDateKey(this.addDays(now, -30));

    const [
      departments,
      positions,
      employees,
      contracts,
      attendanceAnomalies,
      leaveRequests,
      overtimeRequests,
      cycles,
      reviews,
      payslips,
      knowledgeArticles,
      profileChanges,
      recruitmentDashboard,
      performanceInsights,
      highRiskList,
    ] = await Promise.all([
      this.departmentsRepository.find({ order: { createdAt: 'ASC' } }),
      this.positionsRepository.find({ order: { createdAt: 'ASC' } }),
      this.employeesRepository.find({
        relations: { department: true, position: true, manager: true, user: true },
        order: { createdAt: 'DESC' },
      }),
      this.contractsRepository.find({
        relations: { employee: { department: true } },
        order: { endDate: 'ASC', createdAt: 'DESC' },
      }),
      this.attendanceRepository
        .createQueryBuilder('attendance')
        .leftJoinAndSelect('attendance.employee', 'employee')
        .where('attendance.workDate >= :lastThirtyDays', { lastThirtyDays })
        .andWhere('attendance.status = :status OR attendance.lateMinutes > 0 OR attendance.undertimeMinutes > 0', {
          status: 'anomaly',
        })
        .orderBy('attendance.workDate', 'DESC')
        .addOrderBy('attendance.createdAt', 'DESC')
        .getMany(),
      this.leaveRequestsRepository.find({
        relations: { employee: true, approver: true },
        order: { createdAt: 'DESC' },
        take: 24,
      }),
      this.overtimeRequestsRepository.find({
        relations: { employee: true, approver: true },
        order: { createdAt: 'DESC' },
        take: 24,
      }),
      this.cyclesRepository.find({
        order: { startDate: 'DESC', createdAt: 'DESC' },
        take: 6,
      }),
      this.reviewsRepository.find({
        relations: { employee: true, cycle: true },
        order: { createdAt: 'DESC' },
        take: 18,
      }),
      this.payslipsRepository.find({
        relations: { employee: true, salaryRecord: true },
        order: { issuedAt: 'DESC' },
        take: 18,
      }),
      this.knowledgeBaseRepository.find({
        where: { isPublished: true },
        order: { createdAt: 'DESC' },
        take: 6,
      }),
      this.profileChangeRepository.find({
        relations: {
          employee: {
            department: true,
          },
          reviewer: true,
        },
        order: { createdAt: 'DESC' },
        take: 18,
      }),
      this.recruitmentService.getRecruitmentDashboard(),
      this.agentService.getPerformanceInsights(),
      this.agentService.getHighRiskAttritionList(),
    ]);

    const activeEmployees = employees.filter((employee) => employee.employmentStatus === 'active');
    const probationEmployees = employees.filter((employee) => employee.employmentStatus === 'probation');
    const managerIds = new Set(
      employees
        .map((employee) => employee.managerEmployeeId)
        .filter((managerEmployeeId): managerEmployeeId is string => Boolean(managerEmployeeId)),
    );
    const activeContracts = contracts.filter((contract) => contract.status === 'active');
    const activeContractEmployeeIds = new Set(activeContracts.map((contract) => contract.employeeId));

    const departmentHiringMap = new Map<
      string,
      { openJobs: number; activeCandidates: number; matchScores: number[] }
    >();

    for (const item of recruitmentDashboard.openJobHealth) {
      const departmentName = item.departmentName ?? '未分配部门';
      const current = departmentHiringMap.get(departmentName) ?? {
        openJobs: 0,
        activeCandidates: 0,
        matchScores: [],
      };

      current.openJobs += 1;
      current.activeCandidates += item.candidateCount;
      if (item.averageMatchScore > 0) {
        current.matchScores.push(item.averageMatchScore);
      }

      departmentHiringMap.set(departmentName, current);
    }

    const departmentHeadcount = departments
      .map((department) => {
        const members = activeEmployees.filter((employee) => employee.departmentId === department.id);
        const pendingChanges = profileChanges.filter(
          (item) => item.status === 'pending' && item.employee?.department?.name === department.name,
        ).length;
        const hiring = departmentHiringMap.get(department.name) ?? {
          openJobs: 0,
          activeCandidates: 0,
          matchScores: [],
        };

        return {
          id: department.id,
          name: department.name,
          headcount: members.length,
          openJobs: hiring.openJobs,
          activeCandidates: hiring.activeCandidates,
          pendingChanges,
          averageMatchScore: Number(this.average(hiring.matchScores).toFixed(1)),
        };
      })
      .filter((item) => item.headcount > 0 || item.openJobs > 0 || item.pendingChanges > 0)
      .sort((left, right) => {
        const byHeadcount = right.headcount - left.headcount;
        return byHeadcount || right.openJobs - left.openJobs;
      })
      .slice(0, 8);

    const employmentStatus = [
      { label: '在职', value: activeEmployees.length },
      { label: '试用期', value: probationEmployees.length },
      { label: '离职', value: employees.filter((employee) => employee.employmentStatus === 'exited').length },
    ];

    const recentJoiners = employees
      .filter((employee) => this.daysSince(employee.joinDate, now) <= 60)
      .sort((left, right) => new Date(right.joinDate).getTime() - new Date(left.joinDate).getTime())
      .slice(0, 6)
      .map((employee) => ({
        id: employee.id,
        employeeName: employee.fullName,
        departmentName: employee.department?.name ?? '未分配部门',
        positionName: employee.position?.name ?? '未分配岗位',
        joinDate: employee.joinDate,
        employmentStatus: employee.employmentStatus,
      }));

    const contractsExpiringSoon = activeContracts
      .filter((contract) => contract.endDate && this.daysUntil(contract.endDate, now) !== null)
      .map((contract) => ({
        id: contract.id,
        employeeName: contract.employee?.fullName ?? '未绑定员工',
        departmentName: contract.employee?.department?.name ?? '未分配部门',
        endDate: contract.endDate,
        daysToExpire: this.daysUntil(contract.endDate!, now) ?? 0,
        contractNo: contract.contractNo,
      }))
      .filter((contract) => contract.daysToExpire <= 90)
      .sort((left, right) => left.daysToExpire - right.daysToExpire)
      .slice(0, 8);

    const probationEndingSoon = probationEmployees
      .filter((employee) => employee.probationEndDate)
      .map((employee) => ({
        id: employee.id,
        employeeName: employee.fullName,
        departmentName: employee.department?.name ?? '未分配部门',
        probationEndDate: employee.probationEndDate!,
        daysToProbationEnd: this.daysUntil(employee.probationEndDate!, now) ?? 0,
      }))
      .filter((employee) => employee.daysToProbationEnd <= 30)
      .sort((left, right) => left.daysToProbationEnd - right.daysToProbationEnd)
      .slice(0, 8);

    const pendingApprovalItems = [
      ...leaveRequests
        .filter((item) => item.status === 'pending')
        .map((item) => ({
          id: `leave:${item.id}`,
          category: '请假审批',
          priority: 'high',
          title: `${item.employee?.fullName ?? '员工'} 的请假申请`,
          description: `${item.leaveType} · ${this.toNumber(item.durationDays)} 天`,
          createdAt: item.createdAt,
          path: '/resources/leave-requests',
        })),
      ...overtimeRequests
        .filter((item) => item.status === 'pending')
        .map((item) => ({
          id: `overtime:${item.id}`,
          category: '加班审批',
          priority: 'medium',
          title: `${item.employee?.fullName ?? '员工'} 的加班申请`,
          description: `${this.toNumber(item.hours)} 小时 · ${item.workDate}`,
          createdAt: item.createdAt,
          path: '/resources/overtime-requests',
        })),
      ...profileChanges
        .filter((item) => item.status === 'pending')
        .map((item) => ({
          id: `profile:${item.id}`,
          category: '资料变更',
          priority: 'medium',
          title: `${item.employee?.fullName ?? '员工'} 的资料变更申请`,
          description: `${Object.keys(item.changes ?? {}).length} 个字段待审核`,
          createdAt: item.createdAt,
          path: '/profile-change-reviews',
        })),
    ]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 10);

    const upcomingMilestones = [
      ...contractsExpiringSoon.map((item) => ({
        id: `contract:${item.id}`,
        type: '合同到期',
        level: item.daysToExpire <= 30 ? 'high' : 'medium',
        title: `${item.employeeName} 的合同即将到期`,
        description: `${item.contractNo} · 剩余 ${item.daysToExpire} 天`,
        dueAt: item.endDate,
        path: '/resources/employee-contracts',
      })),
      ...probationEndingSoon.map((item) => ({
        id: `probation:${item.id}`,
        type: '试用期转正',
        level: item.daysToProbationEnd <= 7 ? 'high' : 'medium',
        title: `${item.employeeName} 的试用期即将结束`,
        description: `${item.departmentName} · 剩余 ${item.daysToProbationEnd} 天`,
        dueAt: item.probationEndDate,
        path: '/resources/employees',
      })),
      ...recruitmentDashboard.upcomingInterviews.slice(0, 6).map((item) => ({
        id: `interview:${item.id}`,
        type: '面试安排',
        level: 'low',
        title: `${item.candidateName ?? '候选人'} 面试安排`,
        description: `${item.jobTitle ?? '未关联职位'} · ${item.interviewerName ?? '待分配面试官'}`,
        dueAt: item.scheduledAt,
        path: '/recruitment-workbench',
      })),
    ]
      .sort((left, right) => this.compareDateValues(left.dueAt, right.dueAt))
      .slice(0, 10);

    const highRiskEmployees = highRiskList
      .map((item) => ({
        employeeName: String(item.employeeName ?? '员工'),
        department: String(item.department ?? '未分配部门'),
        riskScore: this.toNumber(item.riskScore),
        recommendation: String(item.recommendation ?? '建议经理开展一对一沟通并检查近期工作负荷。'),
      }))
      .sort((left, right) => right.riskScore - left.riskScore)
      .slice(0, 8);

    const performanceAttention = (performanceInsights.needsAttention ?? []).slice(0, 6).map((item) => ({
      employeeName: item.employee ?? '-',
      score: this.toNumber(item.score),
    }));

    const averageProfileCompletion = Number(
      this.average(employees.map((employee) => this.calculateProfileCompleteness(employee))).toFixed(1),
    );

    const dataQualityIssues = [
      { key: 'missingDepartment', label: '缺少部门', count: employees.filter((employee) => !employee.departmentId).length },
      { key: 'missingPosition', label: '缺少岗位', count: employees.filter((employee) => !employee.positionId).length },
      {
        key: 'missingManager',
        label: '缺少直属经理',
        count: employees.filter((employee) => employee.employmentStatus !== 'exited' && !employee.managerEmployeeId).length,
      },
      {
        key: 'missingEmergencyContact',
        label: '紧急联系人不完整',
        count: employees.filter((employee) => !employee.emergencyContact?.name || !employee.emergencyContact?.phone).length,
      },
      {
        key: 'missingActiveContract',
        label: '未绑定有效合同',
        count: activeEmployees.filter((employee) => !activeContractEmployeeIds.has(employee.id)).length,
      },
      {
        key: 'missingProfileSummary',
        label: '缺少个人简介',
        count: employees.filter((employee) => !employee.profileSummary?.trim()).length,
      },
    ];

    const latestCycle =
      cycles.find((cycle) => cycle.status === 'active') ??
      cycles.find((cycle) => cycle.status === 'draft') ??
      cycles[0] ??
      null;
    const publishedPayslipsThisMonth = payslips.filter((item) => this.sameMonth(item.issuedAt, now)).length;

    const briefingHighlights = [
      `当前在职员工 ${activeEmployees.length} 人，覆盖 ${departments.length} 个部门与 ${positions.length} 个岗位主数据。`,
      `员工基础信息平均完整度为 ${averageProfileCompletion}% ，仍有 ${dataQualityIssues
        .filter((item) => item.count > 0)
        .reduce((sum, item) => sum + item.count, 0)} 项资料缺口需要补齐。`,
      `招聘侧共有 ${recruitmentDashboard.stats.openJobPostings} 个开放职位、${recruitmentDashboard.stats.activeCandidates} 位活跃候选人，近 7 天安排 ${recruitmentDashboard.stats.interviewsThisWeek} 场面试。`,
      `运营侧有 ${pendingApprovalItems.length} 项待处理审批、${attendanceAnomalies.length} 条近 30 天考勤异常、${highRiskEmployees.length} 位高离职风险员工。`,
    ];

    const recommendedActions = [
      pendingApprovalItems.length > 0 ? '优先清理待审批队列，避免请假、加班和资料变更在月底堆积。' : null,
      contractsExpiringSoon.length > 0 ? '安排合同续签检查，先处理 30 天内即将到期的员工合同。' : null,
      highRiskEmployees.length > 0 ? '对高风险员工建立经理一对一沟通清单，并结合绩效变化跟踪后续动作。' : null,
      recruitmentDashboard.hiringAlerts.length > 0 ? '处理招聘预警，优先补强长期开岗但候选人不足的岗位。' : null,
      dataQualityIssues.some((item) => item.count > 0) ? '围绕部门、岗位、经理和紧急联系人字段发起一次基础信息质量治理。' : null,
    ].filter((item): item is string => Boolean(item));
    const actionCenter = this.buildManagementActionCenter({
      averageProfileCompletion,
      pendingApprovalItems,
      attendanceAnomalies,
      highRiskEmployees,
      contractsExpiringSoon,
      probationEndingSoon,
      departmentHeadcount,
      recruitmentDashboard,
      dataQualityIssues,
      performanceAttention,
      activeEmployeesCount: activeEmployees.length,
    });

    return {
      scope: 'management',
      generatedAt: now.toISOString(),
      headline: {
        title: '综合基础信息智能驾驶舱',
        subtitle: '把组织、人员、招聘、考勤、绩效、薪酬与知识库信息统一成一个可执行的管理视图。',
      },
      metrics: [
        { key: 'activeEmployees', label: '在职员工', value: activeEmployees.length, helper: '当前有效员工主数据' },
        { key: 'departments', label: '部门数量', value: departments.length, helper: '组织架构基础信息' },
        {
          key: 'profileCompletion',
          label: '档案完整度',
          value: `${averageProfileCompletion}%`,
          helper: '员工基础资料平均完整率',
        },
        {
          key: 'pendingApprovals',
          label: '待处理事项',
          value: pendingApprovalItems.length,
          helper: '请假、加班、资料变更等审批',
        },
        {
          key: 'openJobs',
          label: '开放职位',
          value: recruitmentDashboard.stats.openJobPostings,
          helper: '当前招聘中的岗位数量',
        },
        {
          key: 'highRiskEmployees',
          label: '高风险员工',
          value: highRiskEmployees.length,
          helper: '离职风险评分 >= 60',
        },
      ],
      briefing: {
        headline: `当前最需要关注的是资料质量、审批积压与人才保留三条主线。`,
        highlights: briefingHighlights,
        recommendedActions,
      },
      actionCenter,
      dataQuality: {
        overallCompletion: averageProfileCompletion,
        issues: dataQualityIssues,
      },
      peopleStructure: {
        departmentHeadcount,
        employmentStatus,
        recentJoiners,
      },
      operations: {
        pendingApprovals: pendingApprovalItems,
        attendanceAlerts: attendanceAnomalies.slice(0, 8).map((item) => ({
          id: item.id,
          employeeName: item.employee?.fullName ?? '员工',
          workDate: item.workDate,
          status: item.status,
          lateMinutes: item.lateMinutes,
          undertimeMinutes: item.undertimeMinutes,
          anomalyReason: item.anomalyReason,
        })),
        upcomingMilestones,
      },
      recruitment: {
        stats: recruitmentDashboard.stats,
        alerts: recruitmentDashboard.hiringAlerts.slice(0, 6),
        funnel: recruitmentDashboard.funnel,
        sourceBreakdown: recruitmentDashboard.sourceBreakdown.slice(0, 6),
        openJobHealth: recruitmentDashboard.openJobHealth.slice(0, 6).map((item) => ({
          id: item.id,
          title: item.title,
          departmentName: item.departmentName,
          candidateCount: item.candidateCount,
          progressPercent: item.progressPercent,
          averageMatchScore: item.averageMatchScore,
          urgencyLevel: item.urgencyLevel,
        })),
        priorityCandidates: recruitmentDashboard.priorityCandidates.slice(0, 6),
        upcomingInterviews: recruitmentDashboard.upcomingInterviews.slice(0, 6),
      },
      performance: {
        activeCycleName: latestCycle?.name ?? null,
        averageScore: this.toNumber(performanceInsights.averageScore),
        topPerformers: performanceInsights.topPerformers ?? [],
        needsAttention: performanceAttention,
      },
      riskRadar: {
        highRiskEmployees,
        contractsExpiringSoon,
        probationEndingSoon,
        attendanceAnomalies30Days: attendanceAnomalies.length,
      },
      knowledgeHighlights: knowledgeArticles.map((article) => ({
        id: article.id,
        title: article.title,
        category: article.category,
        summary: article.question,
        tags: article.tags ?? [],
      })),
      quickLinks: [
        { label: '员工档案', path: '/resources/employees', description: '查看和维护员工基础信息' },
        { label: '组织架构', path: '/resources/departments', description: '检查部门与岗位主数据' },
        { label: '知识中心', path: '/knowledge-center', description: '统一查看制度文档与问答知识库' },
        { label: '招聘工作台', path: '/recruitment-workbench', description: '处理职位、候选人与面试进度' },
        { label: '资料变更审批', path: '/profile-change-reviews', description: '审核员工资料变更请求' },
        { label: '工资单管理', path: '/resources/payslips', description: '检查已发布工资单与可见性' },
      ],
      suggestedQuestions: [
        '当前最紧急的基础信息治理动作是什么？',
        '哪些部门的人力数据和招聘压力同时偏高？',
        '近 30 天有哪些员工需要重点保留干预？',
        '审批积压主要集中在哪一类流程？',
      ],
      summary: {
        managers: managerIds.size,
        contractsExpiringSoon: contractsExpiringSoon.length,
        publishedPayslipsThisMonth,
        performanceReviewsTracked: reviews.length,
      },
    };
  }

  private async getEmployeeDashboard(user: AuthenticatedUser) {
    const dashboard = (await this.selfServiceService.getDashboard(user)) as {
      employee: {
        fullName?: string;
        department?: { name?: string } | null;
        position?: { name?: string } | null;
        manager?: { fullName?: string } | null;
        joinDate?: string;
        profileCompletion?: number;
        tenureDays?: number;
      };
      stats: {
        annualLeaveRemaining?: number;
        pendingLeaveRequests?: number;
        pendingOvertimeRequests?: number;
        profileChanges?: number;
        visiblePayslips?: number;
      };
      reminders?: Array<{ id: string; priority: string; title: string; description: string }>;
      leaveBalances?: Array<{
        id: string;
        leaveType: string;
        remainingDays: number;
        usedDays: number;
        year: number;
      }>;
      approvalTimeline?: Array<{
        id: string;
        category: string;
        status: string;
        title: string;
        detail: string;
        submittedAt: string;
        completedAt: string | null;
      }>;
      knowledgeBaseTips?: Array<{
        id: string;
        title: string;
        category: string;
        question: string;
        tags: string[];
      }>;
    };

    const pendingRequests =
      this.toNumber(dashboard.stats.pendingLeaveRequests) +
      this.toNumber(dashboard.stats.pendingOvertimeRequests) +
      this.toNumber(dashboard.stats.profileChanges);

    return {
      scope: 'employee',
      generatedAt: new Date().toISOString(),
      headline: {
        title: `欢迎回来，${dashboard.employee.fullName ?? user.displayName}`,
        subtitle: '这里汇总了你的档案、请假、考勤、薪酬和知识库提醒。',
      },
      metrics: [
        {
          key: 'profileCompletion',
          label: '档案完整度',
          value: `${this.toNumber(dashboard.employee.profileCompletion)}%`,
          helper: '个人基础信息维护情况',
        },
        {
          key: 'annualLeaveRemaining',
          label: '年假余额',
          value: this.toNumber(dashboard.stats.annualLeaveRemaining),
          helper: '可用年假天数',
        },
        {
          key: 'pendingRequests',
          label: '待处理申请',
          value: pendingRequests,
          helper: '请假、加班和资料变更',
        },
        {
          key: 'visiblePayslips',
          label: '工资单',
          value: this.toNumber(dashboard.stats.visiblePayslips),
          helper: '当前可查看的工资单数量',
        },
      ],
      employeeSnapshot: {
        fullName: dashboard.employee.fullName ?? user.displayName,
        departmentName: dashboard.employee.department?.name ?? '未绑定部门',
        positionName: dashboard.employee.position?.name ?? '未绑定岗位',
        managerName: dashboard.employee.manager?.fullName ?? '未设置直属经理',
        joinDate: dashboard.employee.joinDate ?? null,
        tenureDays: this.toNumber(dashboard.employee.tenureDays),
      },
      reminders: dashboard.reminders ?? [],
      leaveBalances: (dashboard.leaveBalances ?? []).slice(0, 5),
      approvalTimeline: (dashboard.approvalTimeline ?? []).slice(0, 6),
      knowledgeHighlights: (dashboard.knowledgeBaseTips ?? []).slice(0, 4).map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        summary: item.question,
        tags: item.tags ?? [],
      })),
      quickLinks: [
        { label: '员工自助', path: '/self-service', description: '进入完整个人工作台' },
        { label: '资料变更', path: '/self-service', description: '提交地址、手机号和紧急联系人更新' },
        { label: '考勤与假期', path: '/self-service', description: '查看请假、加班和考勤记录' },
      ],
      suggestedQuestions: [
        '我今年还剩多少年假？',
        '最近有哪些待审批的个人申请？',
        '我的资料里还有哪些字段需要补全？',
      ],
    };
  }

  private calculateProfileCompleteness(employee: EmployeeEntity) {
    const checks = [
      Boolean(employee.phone),
      Boolean(employee.departmentId),
      Boolean(employee.positionId),
      Boolean(employee.managerEmployeeId),
      Boolean(employee.address),
      Boolean(employee.profileSummary),
      Boolean(employee.emergencyContact?.name),
      Boolean(employee.emergencyContact?.phone),
      Boolean(employee.bankAccountMasked),
    ];

    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }

  private buildManagementActionCenter(input: {
    averageProfileCompletion: number;
    pendingApprovalItems: Array<{ id: string; category: string; priority: string; title: string; description: string; path: string }>;
    attendanceAnomalies: AttendanceEntity[];
    highRiskEmployees: Array<{ employeeName: string; department: string; riskScore: number; recommendation: string }>;
    contractsExpiringSoon: Array<{ id: string; employeeName: string; departmentName: string; daysToExpire: number; contractNo: string }>;
    probationEndingSoon: Array<{ id: string; employeeName: string; departmentName: string; daysToProbationEnd: number }>;
    departmentHeadcount: Array<{
      id: string;
      name: string;
      headcount: number;
      openJobs: number;
      activeCandidates: number;
      pendingChanges: number;
      averageMatchScore: number;
    }>;
    recruitmentDashboard: Awaited<ReturnType<RecruitmentService['getRecruitmentDashboard']>>;
    dataQualityIssues: Array<{ key: string; label: string; count: number }>;
    performanceAttention: Array<{ employeeName: string; score: number }>;
    activeEmployeesCount: number;
  }) {
    const openJobs = this.toNumber(input.recruitmentDashboard.stats.openJobPostings);
    const activeCandidates = this.toNumber(input.recruitmentDashboard.stats.activeCandidates);
    const candidateCoverage = openJobs > 0 ? Math.min(100, Math.round((activeCandidates / Math.max(openJobs * 3, 1)) * 100)) : 100;
    const approvalLoad = input.pendingApprovalItems.length;
    const complianceLoad = input.contractsExpiringSoon.length + input.probationEndingSoon.length;
    const riskLoad = input.highRiskEmployees.length + input.performanceAttention.length + input.attendanceAnomalies.length;
    const dataIssueCount = input.dataQualityIssues.reduce((sum, item) => sum + item.count, 0);
    const totalOpenSignals = approvalLoad + complianceLoad + riskLoad + input.recruitmentDashboard.hiringAlerts.length + dataIssueCount;
    const healthScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          input.averageProfileCompletion * 0.35 +
            candidateCoverage * 0.2 +
            (100 - Math.min(100, approvalLoad * 8)) * 0.15 +
            (100 - Math.min(100, complianceLoad * 10)) * 0.15 +
            (100 - Math.min(100, riskLoad * 4)) * 0.15,
        ),
      ),
    );

    const focusAreas = [
      {
        key: 'data_quality',
        title: '基础信息质量',
        level: input.averageProfileCompletion >= 85 ? 'low' : input.averageProfileCompletion >= 70 ? 'medium' : 'high',
        score: input.averageProfileCompletion,
        signal: `${dataIssueCount} 项资料缺口`,
        action: dataIssueCount > 0 ? '按缺口最多的字段发起资料补全。' : '保持月度数据质量巡检。',
        path: '/resources/employees',
      },
      {
        key: 'workflow',
        title: '流程待办',
        level: approvalLoad >= 8 ? 'high' : approvalLoad >= 3 ? 'medium' : 'low',
        score: Math.max(0, 100 - approvalLoad * 10),
        signal: `${approvalLoad} 项待处理审批`,
        action: approvalLoad > 0 ? '优先处理高优先级和最早提交的申请。' : '当前审批队列清爽。',
        path: input.pendingApprovalItems[0]?.path ?? '/self-service',
      },
      {
        key: 'talent_supply',
        title: '人才供给',
        level: candidateCoverage >= 80 ? 'low' : candidateCoverage >= 45 ? 'medium' : 'high',
        score: candidateCoverage,
        signal: `${openJobs} 个开放职位，${activeCandidates} 位活跃候选人`,
        action: input.recruitmentDashboard.hiringAlerts.length > 0 ? '处理候选人不足和长期开岗职位。' : '持续跟踪面试转化。',
        path: '/recruitment-workbench',
      },
      {
        key: 'retention',
        title: '人才保留',
        level: input.highRiskEmployees.length >= 5 ? 'high' : input.highRiskEmployees.length >= 1 ? 'medium' : 'low',
        score: Math.max(0, 100 - input.highRiskEmployees.length * 12 - input.performanceAttention.length * 6),
        signal: `${input.highRiskEmployees.length} 位高风险员工，${input.performanceAttention.length} 位绩效关注员工`,
        action: input.highRiskEmployees.length > 0 ? '建立经理一对一沟通与跟进记录。' : '保持关键岗位脉搏跟踪。',
        path: '/resources/performance-reviews',
      },
      {
        key: 'compliance',
        title: '合同与用工合规',
        level: complianceLoad >= 6 ? 'high' : complianceLoad >= 1 ? 'medium' : 'low',
        score: Math.max(0, 100 - complianceLoad * 12),
        signal: `${input.contractsExpiringSoon.length} 份合同、${input.probationEndingSoon.length} 个转正节点`,
        action: complianceLoad > 0 ? '先处理 30 天内到期和 7 天内转正节点。' : '当前无紧急合同/转正节点。',
        path: '/resources/employee-contracts',
      },
    ].sort((left, right) => this.priorityWeight(right.level) - this.priorityWeight(left.level) || left.score - right.score);

    const workloadByDepartment = input.departmentHeadcount
      .map((department) => {
        const hiringPressure = department.openJobs * 10 + Math.max(0, department.openJobs * 3 - department.activeCandidates) * 4;
        const dataPressure = department.pendingChanges * 8;
        const spanPressure = department.headcount >= 25 ? 10 : department.headcount >= 12 ? 5 : 0;
        const score = Math.min(100, hiringPressure + dataPressure + spanPressure);

        return {
          id: department.id,
          departmentName: department.name,
          score,
          level: score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low',
          headcount: department.headcount,
          signals: [
            `${department.headcount} 名在职员工`,
            `${department.openJobs} 个开放职位`,
            `${department.activeCandidates} 位活跃候选人`,
            `${department.pendingChanges} 项资料待审`,
          ],
          nextAction:
            department.openJobs > 0 && department.activeCandidates < department.openJobs * 2
              ? '补充候选人来源或调整招聘优先级。'
              : department.pendingChanges > 0
                ? '清理该部门资料变更审批。'
                : '保持常规监控。',
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);

    const automationQueue = [
      ...input.pendingApprovalItems.slice(0, 4).map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        level: item.priority,
        reason: item.description,
        action: '进入对应审批页面处理。',
        path: item.path,
      })),
      ...input.contractsExpiringSoon.slice(0, 3).map((item) => ({
        id: `contract:${item.id}`,
        title: `${item.employeeName} 合同续签检查`,
        category: '合同续签',
        level: item.daysToExpire <= 30 ? 'high' : 'medium',
        reason: `${item.contractNo} 剩余 ${item.daysToExpire} 天`,
        action: '确认续签意向、薪酬方案和合同附件。',
        path: '/resources/employee-contracts',
      })),
      ...input.probationEndingSoon.slice(0, 3).map((item) => ({
        id: `probation:${item.id}`,
        title: `${item.employeeName} 转正评估`,
        category: '试用期转正',
        level: item.daysToProbationEnd <= 7 ? 'high' : 'medium',
        reason: `${item.departmentName} 剩余 ${item.daysToProbationEnd} 天`,
        action: '安排直属经理完成试用期评估。',
        path: '/resources/employees',
      })),
    ].slice(0, 8);

    const executiveSummary = [
      `组织健康分 ${healthScore}，当前开放信号 ${totalOpenSignals} 个。`,
      `人才供给覆盖度 ${candidateCoverage}%：${openJobs} 个开放职位对应 ${activeCandidates} 位活跃候选人。`,
      `流程与合规待办共 ${approvalLoad + complianceLoad} 项，其中审批 ${approvalLoad} 项、合同/转正 ${complianceLoad} 项。`,
    ];

    return {
      healthScore,
      healthLevel: healthScore >= 85 ? 'low' : healthScore >= 70 ? 'medium' : 'high',
      candidateCoverage,
      totalOpenSignals,
      executiveSummary,
      focusAreas,
      workloadByDepartment,
      automationQueue,
    };
  }

  private average(values: number[]) {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private toNumber(value: unknown) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private addDays(value: Date, days: number) {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    return next;
  }

  private toDateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private sameMonth(left: Date | string, right: Date) {
    const leftDate = new Date(left);
    return (
      leftDate.getUTCFullYear() === right.getUTCFullYear() &&
      leftDate.getUTCMonth() === right.getUTCMonth()
    );
  }

  private daysSince(value?: string | Date | null, now = new Date()) {
    if (!value) {
      return Number.POSITIVE_INFINITY;
    }

    const target = new Date(value);
    if (Number.isNaN(target.getTime())) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(Math.ceil((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)), 0);
  }

  private daysUntil(value?: string | Date | null, now = new Date()) {
    if (!value) {
      return null;
    }

    const target = new Date(value);
    if (Number.isNaN(target.getTime())) {
      return null;
    }

    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  private compareDateValues(left?: string | Date | null, right?: string | Date | null) {
    const leftValue = left ? new Date(left).getTime() : Number.POSITIVE_INFINITY;
    const rightValue = right ? new Date(right).getTime() : Number.POSITIVE_INFINITY;
    return leftValue - rightValue;
  }

  private priorityWeight(level: string) {
    if (level === 'high') {
      return 3;
    }

    if (level === 'medium') {
      return 2;
    }

    return 1;
  }
}
