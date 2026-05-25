import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableEntity } from '../database/base.entity';
import { CompanyEntity } from '../company/company.entity';
import { EmployeeEntity } from '../organization/organization.entities';

export interface PulseSurveyQuestion {
  id: string;
  type: 'rating' | 'choice' | 'text';
  text: string;
  required?: boolean;
  options?: string[];
  minLabel?: string;
  maxLabel?: string;
}

@Entity({ name: 'pulse_surveys' })
export class PulseSurveyEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => CompanyEntity, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company!: CompanyEntity;

  @Column({ length: 180 })
  title!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ length: 40, default: 'general' })
  category!: string;

  @Column({ length: 30, default: 'monthly' })
  periodType!: string;

  @Column({ type: 'timestamptz' })
  startDate!: Date;

  @Column({ type: 'timestamptz' })
  endDate!: Date;

  @Column({ length: 30, default: 'draft' })
  status!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  questions!: PulseSurveyQuestion[];
}

@Entity({ name: 'pulse_survey_responses' })
@Index(['surveyId', 'employeeId'], { unique: true })
export class PulseSurveyResponseEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  surveyId!: string;

  @ManyToOne(() => PulseSurveyEntity, { nullable: false })
  @JoinColumn({ name: 'survey_id' })
  survey!: PulseSurveyEntity;

  @Column({ type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeEntity, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeEntity;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  submittedAt!: Date;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  answers!: Record<string, unknown>;

  @Column({ length: 30, nullable: true })
  aiSentimentLabel!: string | null;

  @Column({ type: 'numeric', precision: 4, scale: 2, nullable: true })
  aiSentimentScore!: number | null;

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  aiKeywords!: string[] | null;
}
