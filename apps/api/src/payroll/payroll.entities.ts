import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableEntity } from '../database/base.entity';
import { EmployeeEntity } from '../organization/organization.entities';

@Entity({ name: 'salary_configs' })
export class SalaryConfigEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeEntity, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeEntity;

  @Column({ length: 30, default: 'monthly' })
  payType!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  baseSalary!: string | number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  housingAllowance!: string | number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  transportAllowance!: string | number;

  @Column({ type: 'numeric', precision: 6, scale: 4, default: 0 })
  bonusRate!: string | number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  socialInsuranceBase!: string | number;

  @Column({ type: 'numeric', precision: 6, scale: 4, default: 0 })
  taxRate!: string | number;

  @Column({ type: 'date' })
  effectiveFrom!: string;

  @Column({ type: 'date', nullable: true })
  effectiveTo!: string | null;
}

@Entity({ name: 'salary_records' })
export class SalaryRecordEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeEntity, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeEntity;

  @Column({ type: 'date' })
  month!: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  attendanceDays!: string | number;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  overtimeHours!: string | number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  performanceScore!: string | number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  grossPay!: string | number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  deductions!: string | number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  netPay!: string | number;

  @Column({ length: 30, default: 'draft' })
  status!: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  generatedAt!: Date;
}

@Entity({ name: 'payslips' })
export class PayslipEntity extends AuditableEntity {
  @Column({ type: 'uuid', unique: true })
  salaryRecordId!: string;

  @ManyToOne(() => SalaryRecordEntity, { nullable: false })
  @JoinColumn({ name: 'salary_record_id' })
  salaryRecord!: SalaryRecordEntity;

  @Column({ type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeEntity, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeEntity;

  @Column({ length: 80, unique: true })
  slipNo!: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  issuedAt!: Date;

  @Column({ type: 'text', default: '' })
  downloadPath!: string;

  @Column({ default: true })
  visibleToEmployee!: boolean;
}
