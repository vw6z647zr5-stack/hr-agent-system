import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../database/base.entity';

@Entity({ name: 'companies' })
export class CompanyEntity extends AuditableEntity {
  @Column({ length: 120 })
  name!: string;

  @Column({ length: 40, default: 'it' })
  industry!: string;

  @Column({ length: 20, default: '1-50' })
  size!: string;

  @Column({ length: 120, default: '' })
  contactName!: string;

  @Column({ length: 160 })
  contactEmail!: string;

  @Column({ length: 40, default: '' })
  contactPhone!: string;

  @Column({ type: 'timestamptz' })
  trialEndsAt!: Date;

  @Column({ type: 'int', default: 20 })
  maxUsers!: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  features!: Record<string, boolean>;

  @Column({ length: 20, default: 'trial' })
  status!: string;
}
