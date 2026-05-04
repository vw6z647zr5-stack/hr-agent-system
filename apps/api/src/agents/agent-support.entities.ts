import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
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
