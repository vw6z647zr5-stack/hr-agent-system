import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../tenant/tenant.context';
import { AuditLogEntity } from './audit.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
    private readonly tenantContext: TenantContext,
  ) {}

  log(action: string, entityType: string, entityId?: string | null, metadata?: Record<string, unknown>) {
    const companyId = this.tenantContext.getCompanyIdOrNull();
    const entry = this.auditLogRepository.create({
      companyId: companyId ?? undefined,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata: metadata ?? {},
    });

    // fire-and-forget — don't block the request on audit persistence
    this.auditLogRepository.save(entry).catch(() => {});
  }

  logWithUser(
    userId: string,
    action: string,
    entityType: string,
    entityId?: string | null,
    metadata?: Record<string, unknown>,
  ) {
    const companyId = this.tenantContext.getCompanyIdOrNull();
    const entry = this.auditLogRepository.create({
      companyId: companyId ?? undefined,
      userId,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata: metadata ?? {},
    });

    this.auditLogRepository.save(entry).catch(() => {});
  }
}
