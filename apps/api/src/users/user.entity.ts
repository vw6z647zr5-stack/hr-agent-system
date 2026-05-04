import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableEntity } from '../database/base.entity';
import { CompanyEntity } from '../company/company.entity';

export enum Role {
  ADMIN = 'admin',
  HR = 'hr',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
  CANDIDATE = 'candidate',
}

@Entity({ name: 'users' })
@Index(['companyId', 'username'], { unique: true })
@Index(['companyId', 'email'], { unique: true })
export class UserEntity extends AuditableEntity {
  @ManyToOne(() => CompanyEntity, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company!: CompanyEntity;

  @Column({ type: 'uuid', insert: false, update: false })
  companyId!: string;

  @Column({ length: 60 })
  username!: string;

  @Column({ length: 160 })
  email!: string;

  @Column({ length: 120 })
  displayName!: string;

  @Column({ type: 'text' })
  passwordHash!: string;

  @Column({ type: 'text', default: '' })
  photoUrl!: string;

  @Column({ type: 'varchar', length: 24 })
  role!: Role;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;
}

export interface AuthenticatedUser {
  userId: string;
  username: string;
  email: string;
  role: Role;
  employeeId: string | null;
  displayName: string;
  photoUrl: string;
  sessionId?: string;
  companyId: string;
}
