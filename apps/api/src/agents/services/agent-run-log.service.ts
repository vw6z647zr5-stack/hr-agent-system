import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRequestId } from '../../common/request-context';
import { TenantContext } from '../../tenant/tenant.context';
import { AuthenticatedUser } from '../../users/user.entity';
import { AgentRunLogListQueryDto } from '../agent-run-log.dto';
import { AgentRunLogEntity } from '../agent-support.entities';
import type { AgentRunTrace } from './agent-orchestrator.service';

interface RecordRunInput {
  user?: AuthenticatedUser | null;
  companyId?: string | null;
  agentType: string;
  action: string;
  trace: AgentRunTrace;
  subjectType?: string;
  subjectId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AgentRunLogService {
  private readonly logger = new Logger(AgentRunLogService.name);

  constructor(
    @InjectRepository(AgentRunLogEntity)
    private readonly runLogRepository: Repository<AgentRunLogEntity>,
    private readonly tenantContext: TenantContext,
  ) {}

  record(input: RecordRunInput): void {
    void this.recordAsync(input).catch((error) => {
      this.logger.warn(`记录 Agent 运行日志失败：${error instanceof Error ? error.message : String(error)}`);
    });
  }

  async list(query: AgentRunLogListQueryDto) {
    const companyId = this.tenantContext.getCompanyId();
    const limit = this.normalizeLimit(query.limit);
    const builder = this.runLogRepository
      .createQueryBuilder('log')
      .where('log.company_id = :companyId', { companyId })
      .orderBy('log.createdAt', 'DESC')
      .take(limit);

    if (query.agentType) builder.andWhere('log.agent_type = :agentType', { agentType: query.agentType });
    if (query.action) builder.andWhere('log.action = :action', { action: query.action });
    if (query.mode) builder.andWhere('log.mode = :mode', { mode: query.mode });
    if (query.provider) builder.andWhere('log.provider = :provider', { provider: query.provider });
    if (query.fallbackReason) {
      builder.andWhere('log.fallback_reason = :fallbackReason', { fallbackReason: query.fallbackReason });
    }
    if (query.subjectType) builder.andWhere('log.subject_type = :subjectType', { subjectType: query.subjectType });
    if (query.subjectId) builder.andWhere('log.subject_id = :subjectId', { subjectId: query.subjectId });

    const items = await builder.getMany();
    return {
      items,
      summary: this.summarize(items),
    };
  }

  private async recordAsync(input: RecordRunInput) {
    const companyId = input.companyId ?? input.user?.companyId ?? this.tenantContext.getCompanyIdOrNull();
    if (!companyId) {
      return;
    }

    const trace = input.trace;
    const entry = this.runLogRepository.create({
      companyId,
      userId: input.user?.userId ?? null,
      employeeId: input.user?.employeeId ?? null,
      agentType: input.agentType,
      action: input.action,
      mode: trace.mode,
      provider: trace.provider,
      model: trace.model,
      fallbackReason: trace.fallbackReason ?? null,
      latencyMs: trace.latencyMs,
      toolNames: trace.toolNames,
      subjectType: input.subjectType ?? '',
      subjectId: input.subjectId ?? null,
      summary: this.trimText(input.summary ?? '', 500),
      errorMessage: this.trimText(trace.errorMessage ?? '', 500),
      metadata: {
        ...(input.metadata ?? {}),
        requestId: getRequestId(),
        traceGeneratedAt: trace.generatedAt,
      },
    });

    await this.runLogRepository.save(entry);
  }

  private summarize(items: AgentRunLogEntity[]) {
    const byMode = this.countBy(items, (item) => item.mode);
    const byProvider = this.countBy(items, (item) => item.provider);
    const byAgentType = this.countBy(items, (item) => item.agentType);
    const fallbackCount = items.filter((item) => item.mode === 'fallback').length;
    const averageLatencyMs = items.length
      ? Math.round(items.reduce((sum, item) => sum + Number(item.latencyMs || 0), 0) / items.length)
      : 0;

    return {
      total: items.length,
      fallbackCount,
      fallbackRate: items.length ? Number((fallbackCount / items.length).toFixed(2)) : 0,
      averageLatencyMs,
      byMode,
      byProvider,
      byAgentType,
    };
  }

  private countBy(items: AgentRunLogEntity[], selector: (item: AgentRunLogEntity) => string) {
    return items.reduce<Record<string, number>>((acc, item) => {
      const key = selector(item) || 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }

  private normalizeLimit(value?: number) {
    const numeric = Number(value ?? 50);
    return Number.isInteger(numeric) && numeric > 0 ? Math.min(numeric, 100) : 50;
  }

  private trimText(value: string, maxLength: number) {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
  }
}
