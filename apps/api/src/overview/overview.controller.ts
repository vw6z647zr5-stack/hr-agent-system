import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, Role } from '../users/user.entity';
import { OverviewService } from './overview.service';

@ApiTags('overview')
@ApiBearerAuth()
@Controller('overview')
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  /** 返回按角色裁剪后的统一看板数据。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.overviewService.getDashboard(user);
  }
}
