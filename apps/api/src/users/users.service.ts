import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeEntity } from '../organization/organization.entities';
import { UserEntity } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(EmployeeEntity)
    private readonly employeesRepository: Repository<EmployeeEntity>,
  ) {}

  findByUsername(username: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { username }, relations: { company: true } });
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { email }, relations: { company: true } });
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { id }, relations: { company: true } });
  }

  findEmployeeByUserId(userId: string): Promise<EmployeeEntity | null> {
    return this.employeesRepository.findOne({ where: { userId } });
  }

  countActiveByCompany(companyId: string): Promise<number> {
    return this.usersRepository.count({ where: { companyId, isActive: true } });
  }

  async buildAuthenticatedUser(user: UserEntity) {
    const employee = await this.findEmployeeByUserId(user.id);

    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      employeeId: employee?.id ?? null,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
      companyId: user.companyId,
    };
  }

  async createUser(payload: Partial<UserEntity>) {
    return this.usersRepository.save(this.usersRepository.create(payload));
  }

  async assertUserLimit(companyId: string, maxUsers: number) {
    const currentCount = await this.countActiveByCompany(companyId);
    if (currentCount >= maxUsers) {
      throw new BadRequestException('当前试用套餐的用户数已达上限，无法继续添加用户。');
    }
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.usersRepository.update(userId, { lastLoginAt: new Date() });
  }

  async updatePhotoUrl(userId: string, photoUrl: string) {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('未找到当前用户。');
    }

    user.photoUrl = photoUrl;
    const savedUser = await this.usersRepository.save(user);
    const employee = await this.findEmployeeByUserId(userId);

    if (employee) {
      employee.avatarUrl = photoUrl;
      await this.employeesRepository.save(employee);
    }

    return { user: savedUser, employee };
  }
}
