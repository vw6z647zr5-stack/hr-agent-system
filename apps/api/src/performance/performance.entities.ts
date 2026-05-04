import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableEntity } from '../database/base.entity';
import { EmployeeEntity } from '../organization/organization.entities';
import { CompanyEntity } from '../company/company.entity';

@Entity({ name: 'performance_cycles' })
export class PerformanceCycleEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => CompanyEntity, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company!: CompanyEntity;

  @Column({ length: 160 })
  name!: string;

  @Column({ type: 'int' })
  year!: number;

  @Column({ length: 30, default: 'quarterly' })
  periodType!: string;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date' })
  endDate!: string;

  @Column({ length: 30, default: 'draft' })
  status!: string;
}

@Entity({ name: 'performance_goals' })
export class PerformanceGoalEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  cycleId!: string;

  @ManyToOne(() => PerformanceCycleEntity, { nullable: false })
  @JoinColumn({ name: 'cycle_id' })
  cycle!: PerformanceCycleEntity;

  @Column({ type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeEntity, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeEntity;

  @Column({ length: 200 })
  title!: string;

  @Column({ length: 40, default: 'okr' })
  category!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  weight!: string | number;

  @Column({ length: 120, default: '' })
  targetValue!: string;

  @Column({ length: 120, default: '' })
  currentValue!: string;

  @Column({ length: 30, default: 'in_progress' })
  status!: string;

  @Column({ type: 'text', default: '' })
  description!: string;
}

@Entity({ name: 'performance_reviews' })
export class PerformanceReviewEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  cycleId!: string;

  @ManyToOne(() => PerformanceCycleEntity, { nullable: false })
  @JoinColumn({ name: 'cycle_id' })
  cycle!: PerformanceCycleEntity;

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

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  overallScore!: string | number;

  @Column({ length: 30, default: 'meets_expectation' })
  rating!: string;

  @Column({ type: 'text', default: '' })
  strengths!: string;

  @Column({ type: 'text', default: '' })
  improvements!: string;

  @Column({ type: 'text', default: '' })
  summary!: string;
}
