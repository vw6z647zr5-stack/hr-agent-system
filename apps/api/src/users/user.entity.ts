import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../database/base.entity';

export enum Role {
  ADMIN = 'admin',
  HR = 'hr',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
  CANDIDATE = 'candidate',
}

@Entity({ name: 'users' })
export class UserEntity extends AuditableEntity {
  @Column({ unique: true, length: 60 })
  username!: string;

  @Column({ unique: true, length: 160 })
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
}
