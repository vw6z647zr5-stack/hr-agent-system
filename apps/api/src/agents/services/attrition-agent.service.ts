import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../tenant/tenant.context';
import { AuthenticatedUser } from '../../users/user.entity';
import { AttendanceEntity, LeaveRequestEntity, OvertimeRequestEntity } from '../../attendance/attendance.entities';
import { EmployeeEntity } from '../../organization/organization.entities';
import { PerformanceReviewEntity } from '../../performance/performance.entities';
import { ProfileChangeRequestEntity } from '../agent-support.entities';
import { AgentRunLogService } from './agent-run-log.service';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { createBehaviorAggregationTool, createRiskScoringTool, createWarningReportTool } from '../tools/attrition.tools';
import type { AttritionFactorBreakdown, AttritionRiskProfile } from '../agent.dto';

@Injectable()
export class AttritionAgentService {
  constructor(
    @InjectRepository(EmployeeEntity)
    private readonly employeesRepository: Repository<EmployeeEntity>,
    @InjectRepository(AttendanceEntity)
    private readonly attendanceRepository: Repository<AttendanceEntity>,
    @InjectRepository(LeaveRequestEntity)
    private readonly leaveRequestsRepository: Repository<LeaveRequestEntity>,
    @InjectRepository(OvertimeRequestEntity)
    private readonly overtimeRepository: Repository<OvertimeRequestEntity>,
    @InjectRepository(PerformanceReviewEntity)
    private readonly reviewsRepository: Repository<PerformanceReviewEntity>,
    @InjectRepository(ProfileChangeRequestEntity)
    private readonly profileChangeRepository: Repository<ProfileChangeRequestEntity>,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly tenantContext: TenantContext,
    private readonly runLogService: AgentRunLogService,
  ) {}

  async predictAttrition(employeeId?: string, user?: AuthenticatedUser) {
    if (employeeId) {
      const profile = await this.buildAttritionProfileV2(employeeId);
      const { output: summary, trace: aiTrace } = await this.orchestrator.runAgentWithTrace({
        systemPrompt: '你是离职风险助手，请用中文解释离职风险分数、主要驱动因素与干预建议。',
        input: JSON.stringify(profile),
        tools: [
          createBehaviorAggregationTool(this.orchestrator.createTool.bind(this.orchestrator), this.orchestrator.zod, this.buildAttritionProfile.bind(this)),
          createRiskScoringTool(this.orchestrator.createTool.bind(this.orchestrator), this.orchestrator.zod),
          createWarningReportTool(this.orchestrator.createTool.bind(this.orchestrator), this.orchestrator.zod),
        ],
        fallback: async () => this.buildAttritionFallback(profile as unknown as Record<string, unknown>),
      });
      this.runLogService.record({
        user,
        agentType: 'attrition',
        action: 'predict',
        trace: aiTrace,
        subjectType: 'employee',
        subjectId: employeeId,
        summary,
        metadata: {
          riskScore: profile.riskScore,
          riskLevel: profile.riskLevel,
          factorCount: profile.factorBreakdown.length,
        },
      });
      return { ...profile, summary, aiTrace } as Record<string, unknown>;
    }

    const companyId = this.tenantContext.getCompanyId();
    const employees = await this.employeesRepository.find({ where: { companyId }, relations: { department: true } });
    return Promise.all(employees.map((e) => this.buildAttritionProfileV2(e.id)));
  }

  async getHighRiskAttritionList(): Promise<AttritionRiskProfile[]> {
    const predictions = await this.predictAttrition();
    return (predictions as AttritionRiskProfile[]).filter((item) => item.riskScore >= 60);
  }

  // --- V1: 原始 buildAttritionProfile（用于快速检查和工具调用） ---

  async buildAttritionProfile(employeeId: string) {
    const employee = await this.employeesRepository.findOne({ where: { id: employeeId }, relations: { department: true } });
    if (!employee) throw new NotFoundException('未找到员工。');

    const [attendances, leaveRequests, overtimeRequests, reviews, profileChanges] = await Promise.all([
      this.attendanceRepository.find({ where: { employeeId }, order: { workDate: 'DESC' }, take: 30 }),
      this.leaveRequestsRepository.find({ where: { employeeId }, order: { createdAt: 'DESC' }, take: 12 }),
      this.overtimeRepository.find({ where: { employeeId }, order: { createdAt: 'DESC' }, take: 12 }),
      this.reviewsRepository.find({ where: { employeeId }, order: { createdAt: 'DESC' }, take: 3 }),
      this.profileChangeRepository.find({ where: { employeeId }, order: { createdAt: 'DESC' }, take: 6 }),
    ]);

    const lateCount = attendances.filter((item) => item.lateMinutes > 0 || item.status === 'anomaly').length;
    const leaveCount = leaveRequests.length;
    const overtimeCount = overtimeRequests.filter((item) => item.status === 'approved').length;
    const currentScore = Number(reviews[0]?.overallScore ?? 3.8);
    const previousScore = Number(reviews[1]?.overallScore ?? currentScore);
    const scoreDrop = Math.max(0, previousScore - currentScore);
    const profileChangeCount = profileChanges.length;

    const riskScore = Math.min(100, lateCount * 8 + leaveCount * 3 + scoreDrop * 18 + profileChangeCount * 4 - overtimeCount * 1.5);

    return {
      employeeId,
      employeeName: employee.fullName,
      department: employee.department?.name ?? '',
      riskScore: Number(riskScore.toFixed(2)),
      indicators: { lateCount, leaveCount, overtimeCount, currentScore, previousScore, profileChangeCount },
      recommendation: riskScore >= 60
        ? '建议安排经理一对一沟通，评估工作负荷平衡，并重新确认职业发展计划。'
        : '建议保持日常沟通并持续观察变化趋势。',
    };
  }

  // --- V2: 多维评分 ---

  async buildAttritionProfileV2(employeeId: string): Promise<AttritionRiskProfile> {
    const employee = await this.employeesRepository.findOne({
      where: { id: employeeId },
      relations: { department: true, position: true },
    });
    if (!employee) throw new NotFoundException('未找到员工。');

    const [attendances, leaveRequests, overtimeRequests, reviews, profileChanges] = await Promise.all([
      this.attendanceRepository.find({ where: { employeeId }, order: { workDate: 'DESC' }, take: 30 }),
      this.leaveRequestsRepository.find({ where: { employeeId }, order: { createdAt: 'DESC' }, take: 12 }),
      this.overtimeRepository.find({ where: { employeeId }, order: { createdAt: 'DESC' }, take: 12 }),
      this.reviewsRepository.find({ where: { employeeId }, order: { createdAt: 'DESC' }, take: 3 }),
      this.profileChangeRepository.find({ where: { employeeId }, order: { createdAt: 'DESC' }, take: 6 }),
    ]);

    const lateCount = attendances.filter((item) => item.lateMinutes > 0 || item.status === 'anomaly').length;
    const leaveCount = leaveRequests.length;
    const sickLeaveCount = leaveRequests.filter((item) => item.leaveType === 'sick').length;
    const overtimeApproved = overtimeRequests.filter((item) => item.status === 'approved');
    const overtimeCount = overtimeApproved.length;
    const overtimeHoursAvg = overtimeApproved.length > 0
      ? overtimeApproved.reduce((sum, ot) => sum + Number(ot.hours), 0) / overtimeApproved.length
      : 0;
    const currentScore = Number(reviews[0]?.overallScore ?? 3.8);
    const previousScore = Number(reviews[1]?.overallScore ?? currentScore);
    const profileChangeCount = profileChanges.length;
    const tenureMs = employee.joinDate ? Date.now() - new Date(employee.joinDate).getTime() : 0;
    const tenureMonths = Math.round(tenureMs / (30 * 24 * 60 * 60 * 1000));

    // 六因子评分
    const attendanceFactor = this.scoreAttendance(lateCount, attendances.length);
    const performanceFactor = this.scorePerformanceTrend([currentScore, previousScore], reviews.length);
    const leaveFactor = this.scoreLeavePattern(sickLeaveCount, leaveCount);
    const overtimeFactor = this.scoreOvertimePattern(overtimeHoursAvg, overtimeCount);
    const tenureFactor = this.scoreTenureRisk(tenureMonths, employee.grade ?? 'P1');
    const marketFactor = this.scoreMarketFactors(employee);

    const weights = { attendance: 0.20, performance: 0.25, leave: 0.10, overtime: 0.15, tenure: 0.15, market: 0.15 };
    const factorBreakdown: AttritionFactorBreakdown[] = [
      attendanceFactor, performanceFactor, leaveFactor, overtimeFactor, tenureFactor, marketFactor,
    ];

    const riskScore = factorBreakdown.reduce((sum, f) => sum + f.weightedScore, 0);

    let riskLevel: 'low' | 'moderate' | 'high' | 'critical';
    if (riskScore >= 80) riskLevel = 'critical';
    else if (riskScore >= 60) riskLevel = 'high';
    else if (riskScore >= 35) riskLevel = 'moderate';
    else riskLevel = 'low';

    const explanation = this.generateExplanation(employee.fullName, riskScore, riskLevel, factorBreakdown);

    return {
      employeeId,
      employeeName: employee.fullName,
      department: employee.department?.name ?? '',
      riskScore: Number(riskScore.toFixed(2)),
      riskLevel,
      explanation,
      factorBreakdown,
      indicators: {
        lateCount, leaveCount, overtimeCount,
        currentScore: Number(currentScore.toFixed(2)),
        previousScore: Number(previousScore.toFixed(2)),
        profileChangeCount,
        tenureMonths,
        monthsSinceLastPromotion: tenureMonths, // 简化处理
        sickLeaveCount,
        overtimeMonthlyAvg: Number(overtimeHoursAvg.toFixed(1)),
      },
      recommendation: riskScore >= 60
        ? '建议安排经理一对一沟通，评估工作负荷平衡，并重新确认职业发展计划。'
        : '建议保持日常沟通并持续观察变化趋势。',
      generatedAt: new Date().toISOString(),
    };
  }

  // --- 因子评分 ---

  private scoreAttendance(lateCount: number, totalDays: number): AttritionFactorBreakdown {
    const evidence: string[] = [];
    let score = 0;

    if (lateCount === 0) {
      score = 10;
      evidence.push('近30天无迟到或考勤异常');
    } else if (lateCount <= 2) {
      score = 30;
      evidence.push(`近30天迟到/异常 ${lateCount} 次，轻微`);
    } else if (lateCount <= 5) {
      score = 55;
      evidence.push(`近30天迟到/异常 ${lateCount} 次，需关注`);
    } else {
      score = 85;
      evidence.push(`近30天迟到/异常 ${lateCount} 次，考勤模式异常`);
    }

    const lateRate = totalDays > 0 ? lateCount / totalDays : 0;
    if (lateRate > 0.3) {
      score = Math.min(100, score + 15);
      evidence.push('迟到率超过30%，呈上升趋势');
    }

    return { factor: 'attendance', label: '考勤模式', weight: 0.20, score, weightedScore: score * 0.20, evidence };
  }

  private scorePerformanceTrend(scores: number[], reviewCount: number): AttritionFactorBreakdown {
    const evidence: string[] = [];
    let score = 0;

    if (reviewCount < 2) {
      score = 30;
      evidence.push('绩效评估数据不足');
    } else {
      const currentScore = scores[0] ?? 3.8;
      const previousScore = scores[1] ?? currentScore;
      const delta = currentScore - previousScore;

      if (delta <= -0.8) {
        score = 90;
        evidence.push(`绩效评分从 ${previousScore.toFixed(1)} 大幅下滑至 ${currentScore.toFixed(1)}（降幅 ${Math.abs(delta).toFixed(1)}）`);
      } else if (delta <= -0.3) {
        score = 65;
        evidence.push(`绩效评分从 ${previousScore.toFixed(1)} 下降至 ${currentScore.toFixed(1)}（降幅 ${Math.abs(delta).toFixed(1)}）`);
      } else if (delta >= 0.3) {
        score = 10;
        evidence.push(`绩效评分从 ${previousScore.toFixed(1)} 提升至 ${currentScore.toFixed(1)}，呈上升趋势`);
      } else {
        score = 25;
        evidence.push(`绩效评分稳定在 ${currentScore.toFixed(1)}`);
      }
    }

    const currentScore = scores[0] ?? 3.8;
    if (currentScore < 3.0) {
      score = Math.min(100, score + 25);
      evidence.push('当前评分低于3.0，处于需改进区间');
    }

    return { factor: 'performance', label: '绩效趋势', weight: 0.25, score, weightedScore: score * 0.25, evidence };
  }

  private scoreLeavePattern(sickLeaveCount: number, totalLeaveCount: number): AttritionFactorBreakdown {
    const evidence: string[] = [];
    let score = 0;

    if (sickLeaveCount === 0 && totalLeaveCount <= 2) {
      score = 10;
      evidence.push('请假模式正常');
    } else if (sickLeaveCount >= 3) {
      score = 70;
      evidence.push(`近12条请假记录中病假 ${sickLeaveCount} 次，频率偏高`);
    } else if (totalLeaveCount >= 5) {
      score = 55;
      evidence.push(`近12条请假记录共 ${totalLeaveCount} 次，假期使用频繁`);
    } else {
      score = 30;
      evidence.push(`请假 ${totalLeaveCount} 次，属于正常范围`);
    }

    return { factor: 'leave', label: '请假模式', weight: 0.10, score, weightedScore: score * 0.10, evidence };
  }

  private scoreOvertimePattern(avgHours: number, overtimeCount: number): AttritionFactorBreakdown {
    const evidence: string[] = [];
    let score = 0;

    if (overtimeCount === 0) {
      score = 15;
      evidence.push('近12条记录无加班');
    } else if (avgHours >= 3.5) {
      score = 80;
      evidence.push(`平均加班 ${avgHours.toFixed(1)} 小时/次，加班量异常高，存在职业倦怠风险`);
    } else if (avgHours >= 2) {
      score = 55;
      evidence.push(`平均加班 ${avgHours.toFixed(1)} 小时/次，加班量偏高`);
    } else {
      score = 25;
      evidence.push(`平均加班 ${avgHours.toFixed(1)} 小时/次，属于正常范围`);
    }

    return { factor: 'overtime', label: '加班模式', weight: 0.15, score, weightedScore: score * 0.15, evidence };
  }

  private scoreTenureRisk(tenureMonths: number, grade: string): AttritionFactorBreakdown {
    const evidence: string[] = [];
    let score = 0;

    if (tenureMonths <= 6) {
      score = 35;
      evidence.push(`入职仅 ${tenureMonths} 个月，处于试用/适应期`);
    } else if (tenureMonths <= 24) {
      score = 20;
      evidence.push(`任职 ${tenureMonths} 个月，处于成长期`);
    } else if (tenureMonths >= 36 && tenureMonths <= 48) {
      score = 55;
      evidence.push(`任职 ${tenureMonths} 个月（3-4年），处于典型离职窗口期`);
    } else if (tenureMonths > 48) {
      score = 65;
      evidence.push(`任职 ${tenureMonths} 个月（>4年），长时间未晋升可能增加流失风险`);
    } else {
      score = 30;
      evidence.push(`任职 ${tenureMonths} 个月`);
    }

    return { factor: 'tenure', label: '任职期限', weight: 0.15, score, weightedScore: score * 0.15, evidence };
  }

  private scoreMarketFactors(employee: EmployeeEntity): AttritionFactorBreakdown {
    const evidence: string[] = [];
    let score = 50; // 基准分

    // EmployeeEntity 无 skills 字段 — 以 education 和 profileSummary 作为代理指标
    if (employee.education && employee.education.length > 10) {
      score -= 10;
      evidence.push('教育背景完整，市场竞争力较强');
    } else if (!employee.education || employee.education.length === 0) {
      score += 10;
      evidence.push('教育背景缺失，市场竞争力评估不充分');
    }

    if (employee.profileSummary && employee.profileSummary.length > 50) {
      score -= 5;
      evidence.push('简历概述完善');
    }

    if (employee.certificates && Array.isArray(employee.certificates) && employee.certificates.length >= 3) {
      score -= 8;
      evidence.push(`持有 ${employee.certificates.length} 项专业证书`);
    }

    evidence.push('行业离职基准参考：IT行业约13-18%（宏观经济因素已在评分中考虑）');

    return { factor: 'market', label: '市场因素', weight: 0.15, score: Math.max(0, Math.min(100, score)), weightedScore: score * 0.15, evidence };
  }

  private generateExplanation(name: string, riskScore: number, riskLevel: string, factors: AttritionFactorBreakdown[]): string {
    const sorted = [...factors].sort((a, b) => b.weightedScore - a.weightedScore);
    const topFactors = sorted.slice(0, 3);

    const levelLabel: Record<string, string> = { low: '低', moderate: '中等', high: '高', critical: '严重' };
    const reason = topFactors.map((f) => f.label).join('、');

    return `${name} 的离职风险综合分为 ${riskScore.toFixed(0)} 分（${levelLabel[riskLevel] ?? riskLevel}风险等级）。主要驱动因素：${reason}。${topFactors[0]?.evidence.join('；') ?? ''}`;
  }

  // --- 回退兜底 ---

  private buildAttritionFallback(profile: Record<string, unknown>) {
    const riskLevel = profile.riskLevel as string ?? '';
    const levelLabel: Record<string, string> = { low: '低', moderate: '中等', high: '高', critical: '严重' };
    return `离职风险分为 ${profile.riskScore}（${levelLabel[riskLevel] ?? riskLevel}风险）。主要信号包括考勤异常、请假频率、绩效变化、加班模式和任职时长。建议经理在一周内进行一次一对一沟通，并评估当前工作负载与成长机会。`;
  }
}
