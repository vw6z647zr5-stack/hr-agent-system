import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RedisService } from '../redis/redis.service';
import { hashPassword, verifyPassword } from '../common/utils/security';
import { EmployeeEntity } from '../organization/organization.entities';
import { CandidateEntity } from '../recruitment/recruitment.entities';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { AuthenticatedUser, Role, UserEntity } from '../users/user.entity';
import { AuthSessionService } from './auth-session.service';
import { CandidateRegisterDto, LoginDto } from './login.dto';

interface LoginFailureRecord {
  count: number;
  lockedUntil?: number;
}

const maxFailedLoginAttempts = 6;
const loginFailureWindowSeconds = 15 * 60;
const loginLockMs = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly authSessionService: AuthSessionService,
    private readonly storageService: StorageService,
    @InjectRepository(EmployeeEntity)
    private readonly employeesRepository: Repository<EmployeeEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidatesRepository: Repository<CandidateEntity>,
  ) {}

  async login(payload: LoginDto) {
    const username = payload.username.trim();
    await this.assertLoginAllowed(username);

    const user = await this.usersService.findByUsername(username);

    if (!user || !user.isActive) {
      await this.recordFailedLogin(username);
      throw new UnauthorizedException('用户名或密码错误。');
    }

    const isValid = await verifyPassword(payload.password, user.passwordHash);

    if (!isValid) {
      await this.recordFailedLogin(username);
      throw new UnauthorizedException('用户名或密码错误。');
    }

    const employee = await this.usersService.findEmployeeByUserId(user.id);

    const authUser = this.toAuthUser(user, employee);
    const sessionId = this.authSessionService.createSessionId();

    const accessToken = await this.jwtService.signAsync({
      sub: authUser.userId,
      jti: sessionId,
      username: authUser.username,
      email: authUser.email,
      role: authUser.role,
      employeeId: authUser.employeeId,
      displayName: authUser.displayName,
      photoUrl: authUser.photoUrl,
    });

    await this.usersService.touchLastLogin(user.id);
    await this.redisService.delete(this.loginFailureKey(username));
    await this.authSessionService.createSession({
      sessionId,
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    return {
      accessToken,
      user: authUser,
    };
  }

  private async assertLoginAllowed(username: string) {
    const record = await this.redisService.getJson<LoginFailureRecord>(this.loginFailureKey(username));

    if (record?.lockedUntil && record.lockedUntil > Date.now()) {
      throw new UnauthorizedException('登录尝试过于频繁，请稍后再试。');
    }
  }

  private async recordFailedLogin(username: string) {
    const key = this.loginFailureKey(username);
    const current = await this.redisService.getJson<LoginFailureRecord>(key);
    const count = (current?.lockedUntil && current.lockedUntil <= Date.now() ? 0 : current?.count ?? 0) + 1;
    const lockedUntil = count >= maxFailedLoginAttempts ? Date.now() + loginLockMs : undefined;

    await this.redisService.setJson(key, { count, lockedUntil }, loginFailureWindowSeconds);
  }

  private loginFailureKey(username: string) {
    return `auth:login-failure:${username.toLowerCase()}`;
  }

  async registerCandidate(payload: CandidateRegisterDto) {
    const [existingByUsername, existingByEmail, existingCandidate] = await Promise.all([
      this.usersService.findByUsername(payload.username),
      this.usersService.findByEmail(payload.email),
      this.candidatesRepository.findOne({ where: { email: payload.email } }),
    ]);

    if (existingByUsername) {
      throw new BadRequestException('用户名已存在。');
    }

    if (existingByEmail) {
      throw new BadRequestException('邮箱已存在。');
    }

    const passwordHash = await hashPassword(payload.password);

    await this.usersService.createUser({
      username: payload.username,
      email: payload.email,
      displayName: payload.fullName,
      passwordHash,
      role: Role.CANDIDATE,
      isActive: true,
    });

    if (existingCandidate) {
      await this.candidatesRepository.save(
        this.candidatesRepository.create({
          ...existingCandidate,
          fullName: payload.fullName,
          phone: payload.phone,
          source: existingCandidate.source || 'career_portal',
          status: 'active',
          currentCompany: payload.currentCompany ?? existingCandidate.currentCompany,
          notes: existingCandidate.notes || '候选人通过门户自助注册。',
        }),
      );
    } else {
      await this.candidatesRepository.save(
        this.candidatesRepository.create({
          fullName: payload.fullName,
          email: payload.email,
          phone: payload.phone,
          source: 'career_portal',
          stage: 'new',
          status: 'active',
          currentCompany: payload.currentCompany ?? '',
          yearsOfExperience: 0,
          skills: [],
          aiMatchScore: 0,
          notes: '候选人通过门户自助注册。',
        }),
      );
    }

    return this.login({
      username: payload.username,
      password: payload.password,
    });
  }

  async me(user: AuthenticatedUser) {
    const [currentUser, employee] = await Promise.all([
      this.usersService.findById(user.userId),
      user.employeeId
      ? await this.employeesRepository.findOne({
          where: { id: user.employeeId },
          relations: { department: true, position: true, manager: true },
        })
        : null,
    ]);

    if (!currentUser) {
      throw new UnauthorizedException('当前用户不存在。');
    }

    return {
      ...this.toAuthUser(currentUser, employee),
      employee,
    };
  }

  async logout(user: AuthenticatedUser) {
    await this.authSessionService.revokeSession(user.userId, user.sessionId);
    return { success: true };
  }

  async uploadMyPhoto(user: AuthenticatedUser, file: Express.Multer.File) {
    const { relativePath } = await this.storageService.saveUserPhoto(file, user.userId);
    const { user: savedUser, employee } = await this.usersService.updatePhotoUrl(user.userId, `/${relativePath}`);

    if (employee) {
      await this.redisService.delete(`dashboard:${employee.id}:self-service-v2`);
      await this.redisService.delete(`dashboard:${employee.id}`);
    }

    return {
      photoUrl: savedUser.photoUrl,
      user: this.toAuthUser(savedUser, employee),
    };
  }

  private toAuthUser(user: UserEntity, employee?: EmployeeEntity | null): AuthenticatedUser {
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
}
