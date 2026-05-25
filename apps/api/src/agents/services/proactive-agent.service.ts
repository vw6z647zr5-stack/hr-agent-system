import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, Between } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { TenantContext } from '../../tenant/tenant.context';
import { CompanyEntity } from '../../company/company.entity';
import { CandidateEntity, JobPostingEntity } from '../../recruitment/recruitment.entities';
import { EmployeeEntity, DepartmentEntity, EmployeeContractEntity } from '../../organization/organization.entities';
import { PerformanceReviewEntity } from '../../performance/performance.entities';
import { AttendanceEntity, OvertimeRequestEntity } from '../../attendance/attendance.entities';
import { WorkflowNotificationEntity } from '../../workflows/workflow.entities';
import { AttritionAgentService } from './attrition-agent.service';

export interface ProactiveInsight {
  type: 'stalled_candidates' | 'performance_decline' | 'overtime_anomaly' | 'probation_expiring' | 'high_attrition_risk';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  details: Record<string, unknown>;
  generatedAt: string;
}

@Injectable()
export class ProactiveAgentService {
  private readonly logger = new Logger(ProactiveAgentService.name);

  // WebSocket 广播回调引用存储
  private onInsightGenerated: ((insight: ProactiveInsight) => void) | null = null;

  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidatesRepository: Repository<CandidateEntity>,
    @InjectRepository(EmployeeEntity)
    private readonly employeesRepository: Repository<EmployeeEntity>,
    @InjectRepository(PerformanceReviewEntity)
    private readonly reviewsRepository: Repository<PerformanceReviewEntity>,
    @InjectRepository(AttendanceEntity)
    private readonly attendanceRepository: Repository<AttendanceEntity>,
    @InjectRepository(OvertimeRequestEntity)
    private readonly overtimeRepository: Repository<OvertimeRequestEntity>,
    @InjectRepository(DepartmentEntity)
    private readonly departmentsRepository: Repository<DepartmentEntity>,
    @InjectRepository(EmployeeContractEntity)
    private readonly contractsRepository: Repository<EmployeeContractEntity>,
    @InjectRepository(WorkflowNotificationEntity)
    private readonly notificationRepository: Repository<WorkflowNotificationEntity>,
    private readonly tenantContext: TenantContext,
    private readonly redisService: RedisService,
    private readonly attritionAgent: AttritionAgentService,
  ) {}

  /** 注册 WebSocket 广播回调函数。由 AgentGateway 调用。 */
  setOnInsightGenerated(callback: (insight: ProactiveInsight) => void) {
    this.onInsightGenerated = callback;
  }

  /** 每个工作日早上 8:07 执行。 */
  @Cron('7 8 * * 1-5')
  async runDailyProactiveChecks() {
    this.logger.log('开始执行每日主动智能体检查');
    const companies = await this.companyRepository.find({ where: { status: 'active' } });

    for (const company of companies) {
      try {
        await this.tenantContext.run(() => {
          this.tenantContext.setCompanyId(company.id);
          return this.runManualCheck(company.id);
        });
      } catch (error) {
        this.logger.warn(`公司 ${company.name} 的主动检查执行失败：${(error as Error).message}`);
      }
    }
    this.logger.log(`每日主动智能体检查完成，已处理 ${companies.length} 家公司`);
  }

  /** 为指定公司手动触发检查。 */
  async runManualCheck(companyId: string): Promise<ProactiveInsight[]> {
    const cacheKey = `proactive-check:${companyId}:${new Date().toISOString().slice(0, 10)}`;
    const cached = await this.redisService.getJson<string>(cacheKey);
    if (cached === 'done') return [];

    const checks = [
      this.checkStalledCandidates(companyId),
      this.checkPerformanceDecline(companyId),
      this.checkOvertimeAnomaly(companyId),
      this.checkProbationExpiry(companyId),
      this.checkHighAttritionRisk(companyId),
    ];

    const results = await Promise.all(checks);
    const insights = results.flat();

    // 创建通知并广播
    for (const insight of insights) {
      await this.createNotification(companyId, insight);
      this.onInsightGenerated?.(insight);
    }

    await this.redisService.setJson(cacheKey, 'done', 60 * 60 * 24);
    return insights;
  }

  /** 查找在同一阶段停滞超过 5 天的候选人。 */
  private async checkStalledCandidates(companyId: string): Promise<ProactiveInsight[]> {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const stalledStages = ['screening', 'interview', 'technical_test'];

    const candidates = await this.candidatesRepository
      .createQueryBuilder('candidate')
      .leftJoinAndSelect('candidate.appliedJobPosting', 'job')
      .where('candidate.updatedAt < :fiveDaysAgo', { fiveDaysAgo })
      .andWhere('candidate.stage IN (:...stalledStages)', { stalledStages })
      .andWhere('candidate.status = :status', { status: 'active' })
      .getMany();

    if (candidates.length === 0) return [];

    const byStage = new Map<string, string[]>();
    for (const c of candidates) {
      const key = c.stage ?? 'unknown';
      if (!byStage.has(key)) byStage.set(key, []);
      byStage.get(key)!.push(c.fullName);
    }

    const details: Record<string, unknown> = {};
    for (const [stage, names] of byStage) {
      details[stage] = names;
    }

    return [{
      type: 'stalled_candidates',
      title: `${candidates.length} 位候选人流程停滞`,
      message: `共 ${candidates.length} 位候选人在同一阶段停滞超过 5 天，建议招聘经理关注。停滞阶段：${Array.from(byStage.keys()).join('、')}`,
      priority: 'medium',
      details,
      generatedAt: new Date().toISOString(),
    }];
  }

  /** 检测绩效评分连续下滑的员工。 */
  private async checkPerformanceDecline(companyId: string): Promise<ProactiveInsight[]> {
    const employees = await this.employeesRepository.find({
      where: { companyId, employmentStatus: 'active' },
    });

    const declined: Array<{ name: string; scores: number[] }> = [];

    for (const emp of employees.slice(0, 50)) {
      const reviews = await this.reviewsRepository.find({
        where: { employeeId: emp.id },
        order: { createdAt: 'DESC' },
        take: 3,
      });

      if (reviews.length >= 2) {
        const scores = reviews.map((r) => Number(r.overallScore));
        let hasDecline = true;
        for (let i = 0; i < scores.length - 1; i++) {
          if (scores[i]! >= scores[i + 1]!) continue;
          hasDecline = false;
          break;
        }
        if (hasDecline && scores.length >= 2) {
          declined.push({ name: emp.fullName, scores });
        }
      }
    }

    if (declined.length === 0) return [];

    return [{
      type: 'performance_decline',
      title: `${declined.length} 位员工绩效持续下滑`,
      message: `${declined.map((d) => d.name).join('、')} 近 ${declined[0]?.scores.length ?? 2} 次绩效评分连续下降，建议安排 1-on-1 面谈。`,
      priority: 'high',
      details: { declinedEmployees: declined.slice(0, 10) },
      generatedAt: new Date().toISOString(),
    }];
  }

  /** 检测加班量环比增长超过 40% 的部门。 */
  private async checkOvertimeAnomaly(companyId: string): Promise<ProactiveInsight[]> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const departments = await this.departmentsRepository.find({ where: { companyId } });
    const anomalies: Array<{ dept: string; thisMonth: number; lastMonth: number; pct: number }> = [];

    for (const dept of departments) {
      const deptEmployees = await this.employeesRepository.find({ where: { departmentId: dept.id } });
      const empIds = deptEmployees.map((e) => e.id);

      if (empIds.length === 0) continue;

      const [thisMonth, lastMonth] = await Promise.all([
        this.overtimeRepository
          .createQueryBuilder('ot')
          .where('ot.employeeId IN (:...empIds)', { empIds })
          .andWhere('ot.createdAt >= :start', { start: thisMonthStart })
          .andWhere('ot.status = :status', { status: 'approved' })
          .getCount(),
        this.overtimeRepository
          .createQueryBuilder('ot')
          .where('ot.employeeId IN (:...empIds)', { empIds })
          .andWhere('ot.createdAt BETWEEN :start AND :end', { start: lastMonthStart, end: thisMonthStart })
          .andWhere('ot.status = :status', { status: 'approved' })
          .getCount(),
      ]);

      if (lastMonth > 0 && thisMonth > lastMonth * 1.4) {
        anomalies.push({ dept: dept.name, thisMonth, lastMonth, pct: Math.round((thisMonth / lastMonth - 1) * 100) });
      }
    }

    if (anomalies.length === 0) return [];

    return [{
      type: 'overtime_anomaly',
      title: `${anomalies.length} 个部门加班量异常增长`,
      message: anomalies.map((a) => `${a.dept}环比增长 ${a.pct}%（${a.lastMonth}→${a.thisMonth}）`).join('；'),
      priority: 'high',
      details: { anomalies },
      generatedAt: new Date().toISOString(),
    }];
  }

  /** 查找试用期在 7 天内到期的员工。 */
  private async checkProbationExpiry(companyId: string): Promise<ProactiveInsight[]> {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const expiring = await this.employeesRepository.find({
      where: { companyId, employmentStatus: 'probation' },
      relations: { department: true },
    });

    const soon = expiring.filter((e) => {
      if (!e.probationEndDate) return false;
      const d = new Date(e.probationEndDate);
      return d >= now && d <= sevenDaysLater;
    });

    if (soon.length === 0) return [];

    return [{
      type: 'probation_expiring',
      title: `${soon.length} 位员工试用期即将到期`,
      message: soon.map((e) => `${e.fullName}（${e.department?.name ?? '未知部门'}），到期日 ${e.probationEndDate}`).join('；'),
      priority: 'medium',
      details: { employees: soon.map((e) => ({ name: e.fullName, department: e.department?.name, endDate: e.probationEndDate })) },
      generatedAt: new Date().toISOString(),
    }];
  }

  /** 获取高离职风险员工（风险分 >= 70）。 */
  private async checkHighAttritionRisk(companyId: string): Promise<ProactiveInsight[]> {
    const highRisk = await this.attritionAgent.getHighRiskAttritionList();

    const criticalRisk = highRisk.filter((item) => item.riskScore >= 70);

    if (criticalRisk.length === 0) return [];

    return [{
      type: 'high_attrition_risk',
      title: `${criticalRisk.length} 位员工离职风险较高`,
      message: criticalRisk.map((r) => `${r.employeeName}（${r.department}），风险分 ${r.riskScore}`).join('；') + '。建议经理尽快干预。',
      priority: 'high',
      details: { highRiskEmployees: criticalRisk.slice(0, 20) },
      generatedAt: new Date().toISOString(),
    }];
  }

  /** 为洞察创建一条工作流通知。 */
  private async createNotification(companyId: string, insight: ProactiveInsight) {
    try {
      const priorityMap: Record<string, string> = { high: 'high', medium: 'medium', low: 'low' };
      const entry = this.notificationRepository.create({
        companyId,
        category: 'system',
        priority: priorityMap[insight.priority] ?? 'medium',
        title: insight.title,
        message: insight.message,
        linkPath: '/dashboard',
        metadata: insight as unknown as Record<string, unknown>,
      } as any);
      await this.notificationRepository.save(entry);
    } catch (error) {
      this.logger.warn(`创建主动预警通知失败：${(error as Error).message}`);
    }
  }
}
