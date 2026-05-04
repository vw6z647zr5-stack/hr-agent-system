import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { buildAttachmentContentDisposition } from '../common/utils/content-disposition';
import { AuthenticatedUser, Role } from '../users/user.entity';
import {
  CreateSelfLeaveRequestDto,
  CreateSelfOvertimeRequestDto,
  CreateProfileChangeRequestDto,
  ListProfileChangeReviewQueueDto,
  ReviewProfileChangeRequestDto,
} from './self-service.dto';
import { SelfServiceService } from './self-service.service';

@ApiTags('self-service')
@ApiBearerAuth()
@Controller('self-service')
export class SelfServiceController {
  constructor(private readonly selfServiceService: SelfServiceService) {}

  /** 返回员工自助首页数据。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.selfServiceService.getDashboard(user);
  }

  /** 返回当前员工档案。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Get('profile')
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.selfServiceService.getMyProfile(user);
  }

  /** 返回当前员工假期余额。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Get('leave-balances')
  getMyLeaveBalances(@CurrentUser() user: AuthenticatedUser) {
    return this.selfServiceService.getMyLeaveBalances(user);
  }

  /** 返回当前员工已发布工资单。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Get('payslips')
  getMyPayslips(@CurrentUser() user: AuthenticatedUser) {
    return this.selfServiceService.getMyPayslips(user);
  }

  /** 下载当前员工已发布工资单。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Get('payslips/:id/download')
  async downloadMyPayslip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const file = await this.selfServiceService.downloadMyPayslip(user, id);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', buildAttachmentContentDisposition(file.fileName));
    response.setHeader('Cache-Control', 'no-store');
    response.send(file.buffer);
  }

  /** 下载当前员工有效劳动合同。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Get('contracts/active/download')
  async downloadMyActiveContract(@CurrentUser() user: AuthenticatedUser, @Res() response: Response) {
    const file = await this.selfServiceService.downloadMyActiveContract(user);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', buildAttachmentContentDisposition(file.fileName));
    response.setHeader('Cache-Control', 'no-store');
    response.send(file.buffer);
  }

  /** 以当前员工身份提交请假申请。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Post('leave-requests')
  createMyLeaveRequest(@CurrentUser() user: AuthenticatedUser, @Body() payload: CreateSelfLeaveRequestDto) {
    return this.selfServiceService.createMyLeaveRequest(user, payload);
  }

  /** 以当前员工身份提交加班申请。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Post('overtime-requests')
  createMyOvertimeRequest(@CurrentUser() user: AuthenticatedUser, @Body() payload: CreateSelfOvertimeRequestDto) {
    return this.selfServiceService.createMyOvertimeRequest(user, payload);
  }

  /** 查询当前员工资料变更申请。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Get('profile-change-requests')
  listMyProfileChangeRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.selfServiceService.listMyProfileChangeRequests(user);
  }

  /** 查询人力资源或管理员待审核的资料变更申请。 */
  @Roles(Role.ADMIN, Role.HR)
  @Get('profile-change-requests/review-queue')
  listProfileChangeReviewQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListProfileChangeReviewQueueDto,
  ) {
    return this.selfServiceService.listProfileChangeReviewQueue(user, query.status);
  }

  /** 为当前员工创建资料变更申请。 */
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Post('profile-change-requests')
  createProfileChangeRequest(@CurrentUser() user: AuthenticatedUser, @Body() payload: CreateProfileChangeRequestDto) {
    return this.selfServiceService.createProfileChangeRequest(user, payload);
  }

  /** 审核资料变更申请。 */
  @Roles(Role.ADMIN, Role.HR)
  @Patch('profile-change-requests/:id/review')
  reviewProfileChangeRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() payload: ReviewProfileChangeRequestDto,
  ) {
    return this.selfServiceService.reviewProfileChangeRequest(user, id, payload);
  }
}
