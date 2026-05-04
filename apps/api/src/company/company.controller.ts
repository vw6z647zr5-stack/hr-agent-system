import { Body, Controller, Get, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../users/user.entity';
import { AuthSessionService } from '../auth/auth-session.service';
import { CompanyService } from './company.service';
import { RegisterCompanyDto } from './company-register.dto';

@ApiTags('companies')
@Controller('companies')
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly jwtService: JwtService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: '注册企业试用', description: '创建企业并开通30天免费试用。' })
  async register(@Body() dto: RegisterCompanyDto) {
    const result = await this.companyService.register(dto);
    const sessionId = this.authSessionService.createSessionId();

    const accessToken = await this.jwtService.signAsync({
      sub: result.user.userId,
      jti: sessionId,
      username: result.user.username,
      email: result.user.email,
      role: result.user.role,
      employeeId: result.user.employeeId,
      displayName: result.user.displayName,
      photoUrl: result.user.photoUrl,
      companyId: result.user.companyId,
    });

    await this.authSessionService.createSession({
      sessionId,
      userId: result.user.userId,
      username: result.user.username,
      role: result.user.role,
    });

    return {
      accessToken,
      user: result.user,
      company: {
        id: result.company.id,
        name: result.company.name,
        trialEndsAt: result.company.trialEndsAt,
        status: result.company.status,
        features: result.company.features,
      },
    };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前企业', description: '返回当前用户所属企业信息。' })
  async getMyCompany(@CurrentUser() user: AuthenticatedUser) {
    return this.companyService.getCompany(user.companyId);
  }

  @Get('me/trial')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取试用状态', description: '返回企业试用期状态、剩余天数和功能开关。' })
  async getTrialStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.companyService.getTrialStatus(user.companyId);
  }
}
