import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableEntity } from '../database/base.entity';
import { EmployeeEntity } from '../organization/organization.entities';
import { CompanyEntity } from '../company/company.entity';

@Entity({ name: 'knowledge_base_articles' })
export class KnowledgeBaseArticleEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => CompanyEntity, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company!: CompanyEntity;

  @Column({ length: 80 })
  category!: string;

  @Column({ length: 180 })
  title!: string;

  @Column({ type: 'text' })
  question!: string;

  @Column({ type: 'text' })
  answer!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags!: string[];

  @Column({ default: true })
  isPublished!: boolean;
}

@Entity({ name: 'profile_change_requests' })
export class ProfileChangeRequestEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeEntity, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeEntity;

  @Column({ type: 'uuid', nullable: true })
  reviewerEmployeeId!: string | null;

  @ManyToOne(() => EmployeeEntity, { nullable: true })
  @JoinColumn({ name: 'reviewer_employee_id' })
  reviewer!: EmployeeEntity | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  changes!: Record<string, unknown>;

  @Column({ length: 30, default: 'pending' })
  status!: string;

  @Column({ type: 'text', default: '' })
  reviewComment!: string;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;
}

@Entity({ name: 'agent_run_logs' })
@Index(['companyId', 'createdAt'])
@Index(['companyId', 'agentType', 'createdAt'])
@Index(['companyId', 'mode', 'createdAt'])
@Index(['companyId', 'fallbackReason', 'createdAt'])
export class AgentRunLogEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => CompanyEntity, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company!: CompanyEntity;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  employeeId!: string | null;

  @Column({ length: 60 })
  agentType!: string;

  @Column({ length: 80 })
  action!: string;

  @Column({ length: 20 })
  mode!: string;

  @Column({ length: 30 })
  provider!: string;

  @Column({ length: 100 })
  model!: string;

  @Column({ length: 60, nullable: true })
  fallbackReason!: string | null;

  @Column({ type: 'int', default: 0 })
  latencyMs!: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  toolNames!: string[];

  @Column({ length: 80, default: '' })
  subjectType!: string;

  @Column({ type: 'uuid', nullable: true })
  subjectId!: string | null;

  @Column({ type: 'text', default: '' })
  summary!: string;

  @Column({ type: 'text', default: '' })
  errorMessage!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;
}
