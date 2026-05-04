import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../database/base.entity';

@Entity({ name: 'audit_logs' })
export class AuditLogEntity extends AuditableEntity {
  @Column({ type: 'uuid', nullable: true })
  companyId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ length: 80 })
  action!: string;

  @Column({ length: 120, default: '' })
  entityType!: string;

  @Column({ type: 'uuid', nullable: true })
  entityId!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;
}
