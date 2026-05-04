import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableEntity } from '../database/base.entity';
import { DepartmentEntity, EmployeeEntity, PositionEntity } from '../organization/organization.entities';

@Entity({ name: 'job_postings' })
export class JobPostingEntity extends AuditableEntity {
  @Column({ type: 'uuid', nullable: true })
  departmentId!: string | null;

  @ManyToOne(() => DepartmentEntity, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department!: DepartmentEntity | null;

  @Column({ type: 'uuid', nullable: true })
  positionId!: string | null;

  @ManyToOne(() => PositionEntity, { nullable: true })
  @JoinColumn({ name: 'position_id' })
  position!: PositionEntity | null;

  @Column({ length: 160 })
  title!: string;

  @Column({ length: 40, default: 'full_time' })
  employmentType!: string;

  @Column({ length: 120, default: '' })
  location!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'text' })
  requirements!: string;

  @Column({ length: 30, default: 'draft' })
  status!: string;

  @Column({ type: 'int', default: 1 })
  targetCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt!: Date | null;
}

@Entity({ name: 'candidates' })
export class CandidateEntity extends AuditableEntity {
  @Column({ type: 'uuid', nullable: true })
  appliedJobPostingId!: string | null;

  @ManyToOne(() => JobPostingEntity, { nullable: true })
  @JoinColumn({ name: 'applied_job_posting_id' })
  appliedJobPosting!: JobPostingEntity | null;

  @Column({ length: 120 })
  fullName!: string;

  @Column({ length: 160, unique: true })
  email!: string;

  @Column({ length: 40 })
  phone!: string;

  @Column({ length: 80, default: 'website' })
  source!: string;

  @Column({ length: 40, default: 'new' })
  stage!: string;

  @Column({ length: 30, default: 'active' })
  status!: string;

  @Column({ length: 120, default: '' })
  currentCompany!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  yearsOfExperience!: string | number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  skills!: string[];

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  aiMatchScore!: string | number;

  @Column({ type: 'text', default: '' })
  notes!: string;
}

@Entity({ name: 'resumes' })
export class ResumeEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  candidateId!: string;

  @ManyToOne(() => CandidateEntity, { nullable: false })
  @JoinColumn({ name: 'candidate_id' })
  candidate!: CandidateEntity;

  @Column({ length: 260 })
  fileName!: string;

  @Column({ type: 'text' })
  filePath!: string;

  @Column({ type: 'text', default: '' })
  parsedText!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  parsedProfile!: Record<string, unknown>;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  uploadedAt!: Date;
}

@Entity({ name: 'interviews' })
export class InterviewEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  candidateId!: string;

  @ManyToOne(() => CandidateEntity, { nullable: false })
  @JoinColumn({ name: 'candidate_id' })
  candidate!: CandidateEntity;

  @Column({ type: 'uuid', nullable: true })
  jobPostingId!: string | null;

  @ManyToOne(() => JobPostingEntity, { nullable: true })
  @JoinColumn({ name: 'job_posting_id' })
  jobPosting!: JobPostingEntity | null;

  @Column({ type: 'uuid', nullable: true })
  interviewerEmployeeId!: string | null;

  @ManyToOne(() => EmployeeEntity, { nullable: true })
  @JoinColumn({ name: 'interviewer_employee_id' })
  interviewer!: EmployeeEntity | null;

  @Column({ type: 'timestamptz' })
  scheduledAt!: Date;

  @Column({ length: 40, default: 'onsite' })
  interviewType!: string;

  @Column({ length: 30, default: 'scheduled' })
  status!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  score!: string | number;

  @Column({ type: 'text', default: '' })
  feedback!: string;
}

@Entity({ name: 'offers' })
export class OfferEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  candidateId!: string;

  @ManyToOne(() => CandidateEntity, { nullable: false })
  @JoinColumn({ name: 'candidate_id' })
  candidate!: CandidateEntity;

  @Column({ type: 'uuid', nullable: true })
  jobPostingId!: string | null;

  @ManyToOne(() => JobPostingEntity, { nullable: true })
  @JoinColumn({ name: 'job_posting_id' })
  jobPosting!: JobPostingEntity | null;

  @Column({ type: 'uuid', nullable: true })
  approvalByEmployeeId!: string | null;

  @ManyToOne(() => EmployeeEntity, { nullable: true })
  @JoinColumn({ name: 'approval_by_employee_id' })
  approver!: EmployeeEntity | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  salaryOffered!: string | number;

  @Column({ length: 30, default: 'draft' })
  status!: string;

  @Column({ type: 'timestamptz', nullable: true })
  offeredAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'text', default: '' })
  notes!: string;
}
