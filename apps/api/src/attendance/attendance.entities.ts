import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableEntity } from '../database/base.entity';
import { EmployeeEntity } from '../organization/organization.entities';

@Entity({ name: 'attendances' })
export class AttendanceEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeEntity, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeEntity;

  @Column({ type: 'date' })
  workDate!: string;

  @Column({ type: 'timestamptz', nullable: true })
  clockInAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  clockOutAt!: Date | null;

  @Column({ length: 30, default: 'present' })
  status!: string;

  @Column({ length: 30, default: 'manual' })
  source!: string;

  @Column({ type: 'int', default: 0 })
  lateMinutes!: number;

  @Column({ type: 'int', default: 0 })
  undertimeMinutes!: number;

  @Column({ type: 'text', default: '' })
  anomalyReason!: string;
}

@Entity({ name: 'leave_requests' })
export class LeaveRequestEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeEntity, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeEntity;

  @Column({ type: 'uuid', nullable: true })
  approverEmployeeId!: string | null;

  @ManyToOne(() => EmployeeEntity, { nullable: true })
  @JoinColumn({ name: 'approver_employee_id' })
  approver!: EmployeeEntity | null;

  @Column({ length: 40 })
  leaveType!: string;

  @Column({ type: 'timestamptz' })
  startAt!: Date;

  @Column({ type: 'timestamptz' })
  endAt!: Date;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  durationDays!: string | number;

  @Column({ type: 'text', default: '' })
  reason!: string;

  @Column({ length: 30, default: 'pending' })
  status!: string;

  @Column({ type: 'text', default: '' })
  rejectionReason!: string;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;
}

@Entity({ name: 'leave_balances' })
export class LeaveBalanceEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeEntity, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeEntity;

  @Column({ length: 40 })
  leaveType!: string;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  totalDays!: string | number;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  usedDays!: string | number;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  remainingDays!: string | number;
}

@Entity({ name: 'overtime_requests' })
export class OvertimeRequestEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeEntity, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeEntity;

  @Column({ type: 'uuid', nullable: true })
  approverEmployeeId!: string | null;

  @ManyToOne(() => EmployeeEntity, { nullable: true })
  @JoinColumn({ name: 'approver_employee_id' })
  approver!: EmployeeEntity | null;

  @Column({ type: 'date' })
  workDate!: string;

  @Column({ type: 'timestamptz' })
  startAt!: Date;

  @Column({ type: 'timestamptz' })
  endAt!: Date;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  hours!: string | number;

  @Column({ type: 'text', default: '' })
  reason!: string;

  @Column({ length: 30, default: 'pending' })
  status!: string;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;
}
