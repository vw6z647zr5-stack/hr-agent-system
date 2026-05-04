import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { hashPassword } from '../common/utils/security';
import { Role, UserEntity } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { CompanyEntity } from './company.entity';
import { RegisterCompanyDto } from './company-register.dto';

const defaultTrialDays = 30;
const defaultMaxUsers = 20;
const defaultFeatures: Record<string, boolean> = {
  recruitment: true,
  attendance: true,
  performance: true,
  payroll: false,
  aiAgent: true,
};

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterCompanyDto) {
    const existingUser = await this.usersService.findByUsername(dto.adminUsername);
    if (existingUser) {
      throw new BadRequestException('该管理员用户名已被使用，请更换。');
    }

    const existingEmail = await this.usersService.findByEmail(dto.adminEmail);
    if (existingEmail) {
      throw new BadRequestException('该管理员邮箱已被使用，请更换。');
    }

    const company = this.companyRepo.create({
      name: dto.companyName,
      industry: dto.industry,
      size: dto.size,
      contactName: dto.contactName,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      trialEndsAt: new Date(Date.now() + defaultTrialDays * 24 * 60 * 60 * 1000),
      maxUsers: defaultMaxUsers,
      features: defaultFeatures,
      status: 'trial',
    });
    const savedCompany = await this.companyRepo.save(company);

    const passwordHash = await hashPassword(dto.adminPassword);
    const user = this.userRepo.create({
      companyId: savedCompany.id,
      username: dto.adminUsername,
      email: dto.adminEmail,
      displayName: dto.adminDisplayName,
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
    });
    const savedUser = await this.userRepo.save(user);

    this.auditService.logWithUser(savedUser.id, 'register_company', 'company', savedCompany.id, {
      companyName: savedCompany.name,
    });
    this.auditService.logWithUser(savedUser.id, 'create_user', 'user', savedUser.id, {
      role: Role.ADMIN,
    });

    return {
      company: savedCompany,
      user: {
        userId: savedUser.id,
        username: savedUser.username,
        email: savedUser.email,
        role: savedUser.role,
        employeeId: null,
        displayName: savedUser.displayName,
        photoUrl: savedUser.photoUrl,
        companyId: savedUser.companyId,
      },
    };
  }

  async getCompany(companyId: string): Promise<CompanyEntity | null> {
    return this.companyRepo.findOne({ where: { id: companyId } });
  }

  async getTrialStatus(companyId: string) {
    const company = await this.getCompany(companyId);
    if (!company) {
      throw new BadRequestException('企业不存在。');
    }

    const now = Date.now();
    const trialEnd = new Date(company.trialEndsAt).getTime();
    const daysRemaining = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
    const isExpired = trialEnd <= now;
    const userCount = await this.usersService.countActiveByCompany(companyId);

    return {
      trialEndsAt: company.trialEndsAt,
      daysRemaining,
      isExpired,
      status: company.status,
      maxUsers: company.maxUsers,
      userCount,
      features: company.features as Record<string, boolean>,
    };
  }

  async checkFeatureEnabled(companyId: string, featureKey: string): Promise<boolean> {
    const company = await this.getCompany(companyId);
    if (!company) return false;
    const features = company.features as Record<string, boolean>;
    return features[featureKey] === true;
  }

  async isTrialExpired(companyId: string): Promise<boolean> {
    const company = await this.getCompany(companyId);
    if (!company) return true;
    if (company.status === 'suspended') return true;
    if (company.status === 'expired') return true;
    return new Date(company.trialEndsAt).getTime() <= Date.now();
  }
}
