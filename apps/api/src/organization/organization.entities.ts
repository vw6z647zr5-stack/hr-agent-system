import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AuditableEntity } from '../database/base.entity';
import { UserEntity } from '../users/user.entity';

@Entity({ name: 'departments' })
export class DepartmentEntity extends AuditableEntity {
  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => DepartmentEntity, (department) => department.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent!: DepartmentEntity | null;

  @OneToMany(() => DepartmentEntity, (department) => department.parent)
  children!: DepartmentEntity[];

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 60, unique: true })
  code!: string;

  @Column({ type: 'uuid', nullable: true })
  managerEmployeeId!: string | null;

  @Column({ type: 'text', default: '' })
  description!: string;
}

@Entity({ name: 'positions' })
export class PositionEntity extends AuditableEntity {
  @Column({ type: 'uuid', nullable: true })
  departmentId!: string | null;

  @ManyToOne(() => DepartmentEntity, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department!: DepartmentEntity | null;

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 60, unique: true })
  code!: string;

  @Column({ length: 50 })
  level!: string;

  @Column({ type: 'text', default: '' })
  description!: string;
}

@Entity({ name: 'employees' })
export class EmployeeEntity extends AuditableEntity {
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity | null;

  @Column({ length: 40, unique: true })
  employeeNo!: string;

  @Column({ length: 120 })
  fullName!: string;

  @Column({ length: 160, unique: true })
  email!: string;

  @Column({ length: 40 })
  phone!: string;

  @Column({ length: 20, default: 'unknown' })
  gender!: string;

  @Column({ type: 'date', nullable: true })
  birthDate!: string | null;

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

  @Column({ type: 'uuid', nullable: true })
  managerEmployeeId!: string | null;

  @ManyToOne(() => EmployeeEntity, { nullable: true })
  @JoinColumn({ name: 'manager_employee_id' })
  manager!: EmployeeEntity | null;

  @Column({ length: 30, default: 'full_time' })
  employmentType!: string;

  @Column({ length: 30, default: 'probation' })
  employmentStatus!: string;

  @Column({ length: 50, default: 'P1' })
  grade!: string;

  @Column({ type: 'date' })
  joinDate!: string;

  @Column({ type: 'date', nullable: true })
  probationEndDate!: string | null;

  @Column({ type: 'date', nullable: true })
  regularizationDate!: string | null;

  @Column({ type: 'date', nullable: true })
  exitDate!: string | null;

  @Column({ type: 'text', default: '' })
  education!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  certificates!: string[];

  @Column({ type: 'text', default: '' })
  address!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  emergencyContact!: Record<string, string>;

  @Column({ length: 40, default: '' })
  nationalIdMasked!: string;

  @Column({ length: 60, default: '' })
  bankAccountMasked!: string;

  @Column({ type: 'text', default: '' })
  profileSummary!: string;

  @Column({ type: 'text', default: '' })
  avatarUrl!: string;
}

@Entity({ name: 'employee_contracts' })
export class EmployeeContractEntity extends AuditableEntity {
  @Column({ type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeEntity, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeEntity;

  @Column({ length: 80, unique: true })
  contractNo!: string;

  @Column({ length: 40 })
  contractType!: string;

  @Column({ length: 30 })
  status!: string;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ type: 'int', default: 0 })
  probationMonths!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  salaryBase!: string | number;

  @Column({ type: 'text', default: '' })
  filePath!: string;

  @Column({ type: 'text', default: '' })
  notes!: string;
}
