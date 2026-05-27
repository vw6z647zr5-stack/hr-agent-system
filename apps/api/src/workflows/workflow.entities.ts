import { Column, Entity, Index } from 'typeorm';
import { AuditableEntity } from '../database/base.entity';

export type WorkflowPriority = 'low' | 'medium' | 'high';
export type WorkflowTaskStatus = 'pending' | 'completed' | 'cancelled';

@Entity({ name: 'workflow_notifications' })
@Index(['companyId', 'isRead', 'createdAt'])
@Index(['companyId', 'employeeId', 'isRead'])
@Index(['companyId', 'userId', 'isRead'])
export class WorkflowNotificationEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  employeeId!: string | null;

  @Column({ length: 40, default: 'system' })
  category!: string;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  priority!: WorkflowPriority;

  @Column({ length: 180 })
  title!: string;

  @Column({ type: 'text', default: '' })
  message!: string;

  @Column({ type: 'text', default: '' })
  linkPath!: string;

  @Column({ default: false })
  isRead!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;
}

@Entity({ name: 'workflow_tasks' })
@Index(['companyId', 'status', 'priority'])
@Index(['companyId', 'ownerEmployeeId', 'status'])
@Index(['relatedEntityType', 'relatedEntityId'])
export class WorkflowTaskEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'uuid', nullable: true })
  ownerEmployeeId!: string | null;

  @Column({ length: 40, default: 'general' })
  category!: string;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  priority!: WorkflowPriority;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: WorkflowTaskStatus;

  @Column({ length: 180 })
  title!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'text', default: '' })
  linkPath!: string;

  @Column({ length: 80, default: '' })
  relatedEntityType!: string;

  @Column({ type: 'uuid', nullable: true })
  relatedEntityId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  dueAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;
}

@Entity({ name: 'workflow_events' })
@Index(['companyId', 'createdAt'])
@Index(['relatedEntityType', 'relatedEntityId', 'createdAt'])
export class WorkflowEventEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  actorEmployeeId!: string | null;

  @Column({ length: 40, default: 'activity' })
  category!: string;

  @Column({ length: 180 })
  title!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ length: 80, default: '' })
  relatedEntityType!: string;

  @Column({ type: 'uuid', nullable: true })
  relatedEntityId!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;
}
