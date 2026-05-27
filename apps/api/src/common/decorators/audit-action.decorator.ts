import { SetMetadata } from '@nestjs/common';

export type AuditRiskLevel = 'low' | 'medium' | 'high';

export interface AuditActionOptions {
  /** 业务动作名，例如 update_salary。 */
  action: string;
  /** 实体类型，例如 salary_config。 */
  entityType: string;
  /** 风险级别，high 会同步写入告警通道。 */
  riskLevel?: AuditRiskLevel;
  /** 从参数中提取实体 ID。默认尝试 args[0].id 或 args[0]。 */
  resolveEntityId?: (args: unknown[], result: unknown) => string | null | undefined;
  /** 从参数/结果提取附加 metadata。 */
  resolveMetadata?: (args: unknown[], result: unknown) => Record<string, unknown> | undefined;
}

export const AUDIT_ACTION_METADATA = 'audit:action';

export const AuditAction = (options: AuditActionOptions): MethodDecorator =>
  SetMetadata(AUDIT_ACTION_METADATA, options);
