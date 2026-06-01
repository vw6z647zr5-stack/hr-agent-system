import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../tenant/tenant.context';
import { AuthenticatedUser } from '../../users/user.entity';
import { PerformanceGoalEntity, PerformanceReviewEntity } from '../../performance/performance.entities';
import { PerformanceAnalyzeDto } from '../agent.dto';
import { AgentRunLogService } from './agent-run-log.service';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import {
  createPerformanceDataTool,
  createPerformanceStatsTool,
  createPerformanceReportTool,
} from '../tools/performance.tools';

@Injectable()
export class PerformanceAgentService {
  constructor(
    @InjectRepository(PerformanceReviewEntity)
    private readonly reviewsRepository: Repository<PerformanceReviewEntity>,
    @InjectRepository(PerformanceGoalEntity)
    private readonly goalsRepository: Repository<PerformanceGoalEntity>,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly tenantContext: TenantContext,
    private readonly runLogService: AgentRunLogService,
  ) {}

  async analyzePerformance(payload: PerformanceAnalyzeDto, user?: AuthenticatedUser) {
    const raw = await this.queryPerformanceData(payload);
    const { output: summary, trace: aiTrace } = await this.orchestrator.runAgentWithTrace({
      systemPrompt: '你是绩效分析助手，请用中文识别趋势、高绩效员工、需关注员工，并给出可执行建议。',
      input: JSON.stringify(raw),
      tools: [
        createPerformanceDataTool(this.orchestrator.createTool.bind(this.orchestrator), this.orchestrator.zod, this.queryPerformanceData.bind(this)),
        createPerformanceStatsTool(this.orchestrator.createTool.bind(this.orchestrator), this.orchestrator.zod),
        createPerformanceReportTool(this.orchestrator.createTool.bind(this.orchestrator), this.orchestrator.zod),
      ],
      fallback: async () => this.buildPerformanceFallback(raw),
    });
    this.runLogService.record({
      user,
      agentType: 'performance',
      action: 'analyze',
      trace: aiTrace,
      subjectType: payload.employeeId ? 'employee' : payload.departmentId ? 'department' : payload.cycleId ? 'performance_cycle' : 'performance_scope',
      subjectId: payload.employeeId ?? payload.departmentId ?? payload.cycleId ?? null,
      summary,
      metadata: {
        reviewCount: raw.reviews.length,
        goalCount: raw.goals.length,
        averageScore: raw.averageScore,
      },
    });
    return { ...raw, summary, aiTrace };
  }

  async getPerformanceInsights() {
    const companyId = this.tenantContext.getCompanyId();
    const recentReviews = await this.reviewsRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.employee', 'employee')
      .where('employee.company_id = :companyId', { companyId })
      .orderBy('review.createdAt', 'DESC')
      .take(10)
      .getMany();

    const averageScore = recentReviews.length === 0
      ? 0
      : recentReviews.reduce((sum, review) => sum + Number(review.overallScore), 0) / recentReviews.length;

    return {
      averageScore: Number(averageScore.toFixed(2)),
      topPerformers: recentReviews
        .filter((r) => Number(r.overallScore) >= 4.2)
        .map((r) => ({ employee: r.employee.fullName, score: r.overallScore })),
      needsAttention: recentReviews
        .filter((r) => Number(r.overallScore) < 3.5)
        .map((r) => ({ employee: r.employee.fullName, score: r.overallScore })),
    };
  }

  // --- 私有内部方法 ---

  private async queryPerformanceData(payload: PerformanceAnalyzeDto) {
    const reviewsBuilder = this.reviewsRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.employee', 'employee')
      .leftJoinAndSelect('employee.department', 'department');

    if (payload.employeeId) reviewsBuilder.andWhere('review.employeeId = :employeeId', { employeeId: payload.employeeId });
    if (payload.departmentId) reviewsBuilder.andWhere('employee.departmentId = :departmentId', { departmentId: payload.departmentId });
    if (payload.cycleId) reviewsBuilder.andWhere('review.cycleId = :cycleId', { cycleId: payload.cycleId });

    const [reviews, goals] = await Promise.all([
      reviewsBuilder.getMany(),
      this.goalsRepository.find({
        where: { ...(payload.employeeId ? { employeeId: payload.employeeId } : {}), ...(payload.cycleId ? { cycleId: payload.cycleId } : {}) },
        relations: { employee: true },
      }),
    ]);

    const averageScore = reviews.length === 0 ? 0 : reviews.reduce((sum, r) => sum + Number(r.overallScore), 0) / reviews.length;
    const sortedReviews = [...reviews].sort((a, b) => Number(b.overallScore) - Number(a.overallScore));

    return {
      averageScore: Number(averageScore.toFixed(2)),
      reviews: reviews.map((r) => ({ employeeId: r.employeeId, employeeName: r.employee.fullName, score: Number(r.overallScore), rating: r.rating })),
      goals: goals.map((g) => ({ employeeId: g.employeeId, employeeName: g.employee.fullName, title: g.title, status: g.status, weight: Number(g.weight) })),
      topPerformer: sortedReviews[0] ? { employee: sortedReviews[0].employee.fullName, score: Number(sortedReviews[0].overallScore) } : null,
      lowPerformer: sortedReviews.at(-1) ? { employee: sortedReviews.at(-1)!.employee.fullName, score: Number(sortedReviews.at(-1)!.overallScore) } : null,
    };
  }

  private buildPerformanceFallback(raw: Record<string, unknown>) {
    const top = raw.topPerformer as { employee: string; score: number } | null;
    const low = raw.lowPerformer as { employee: string; score: number } | null;
    return `当前平均绩效分为 ${raw.averageScore}。高绩效员工：${top?.employee ?? '暂无'}；需关注员工：${low?.employee ?? '暂无'}。建议围绕低分项设置改进目标并安排周期性复盘。`;
  }
}
