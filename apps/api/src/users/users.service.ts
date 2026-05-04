import { Injectable, NotFoundException } from '@nestjs/common';
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
    return this.usersRepository.findOne({ where: { username } });
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findEmployeeByUserId(userId: string): Promise<EmployeeEntity | null> {
    return this.employeesRepository.findOne({ where: { userId } });
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
    };
  }

  createUser(payload: Partial<UserEntity>) {
    return this.usersRepository.save(this.usersRepository.create(payload));
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
