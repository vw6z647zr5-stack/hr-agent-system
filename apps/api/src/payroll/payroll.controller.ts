import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { buildAttachmentContentDisposition } from '../common/utils/content-disposition';
import { AuthenticatedUser, Role } from '../users/user.entity';
import {
  CreatePayslipDto,
  CreateSalaryConfigDto,
  CreateSalaryRecordDto,
  GenerateSalaryRecordDto,
  UpdatePayslipDto,
  UpdateSalaryConfigDto,
  UpdateSalaryRecordDto,
} from './payroll.dto';
import { PayrollService } from './payroll.service';

@Controller()
@Roles(Role.ADMIN, Role.HR, Role.MANAGER)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  /** 分页查询薪资配置。 */
  @Get('salary-configs')
  listSalaryConfigs(@Query() query: ListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payrollService.listSalaryConfigs(query, user);
  }

  /** 返回单条薪资配置。 */
  @Get('salary-configs/:id')
  getSalaryConfig(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payrollService.getSalaryConfig(id, user);
  }

  /** 创建薪资配置。 */
  @Post('salary-configs')
  createSalaryConfig(@Body() payload: CreateSalaryConfigDto) {
    return this.payrollService.createSalaryConfig(payload);
  }

  /** 更新薪资配置。 */
  @Patch('salary-configs/:id')
  updateSalaryConfig(@Param('id') id: string, @Body() payload: UpdateSalaryConfigDto) {
    return this.payrollService.updateSalaryConfig(id, payload);
  }

  /** 删除薪资配置。 */
  @Delete('salary-configs/:id')
  removeSalaryConfig(@Param('id') id: string) {
    return this.payrollService.removeSalaryConfig(id);
  }

  /** 分页查询工资记录。 */
  @Get('salary-records')
  listSalaryRecords(@Query() query: ListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payrollService.listSalaryRecords(query, user);
  }

  /** 返回单条工资记录。 */
  @Get('salary-records/:id')
  getSalaryRecord(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payrollService.getSalaryRecord(id, user);
  }

  /** 手动创建工资记录。 */
  @Post('salary-records')
  createSalaryRecord(@Body() payload: CreateSalaryRecordDto) {
    return this.payrollService.createSalaryRecord(payload);
  }

  /** 根据考勤和绩效数据生成工资记录。 */
  @Post('salary-records/generate')
  generateSalaryRecord(@Body() payload: GenerateSalaryRecordDto) {
    return this.payrollService.generateSalaryRecord(payload);
  }

  /** 更新工资记录。 */
  @Patch('salary-records/:id')
  updateSalaryRecord(@Param('id') id: string, @Body() payload: UpdateSalaryRecordDto) {
    return this.payrollService.updateSalaryRecord(id, payload);
  }

  /** 删除工资记录。 */
  @Delete('salary-records/:id')
  removeSalaryRecord(@Param('id') id: string) {
    return this.payrollService.removeSalaryRecord(id);
  }

  /** 分页查询工资单。 */
  @Get('payslips')
  listPayslips(@Query() query: ListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payrollService.listPayslips(query, user);
  }

  /** 返回单张工资单。 */
  @Get('payslips/:id')
  getPayslip(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payrollService.getPayslip(id, user);
  }

  /** 下载工资单文件并执行权限校验。 */
  @Get('payslips/:id/download')
  async downloadPayslip(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.payrollService.getPayslipDownload(id, user);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', buildAttachmentContentDisposition(file.fileName));
    response.setHeader('Cache-Control', 'no-store');
    return file.buffer;
  }

  /** 创建工资单。 */
  @Post('payslips')
  createPayslip(@Body() payload: CreatePayslipDto) {
    return this.payrollService.createPayslip(payload);
  }

  /** 更新工资单。 */
  @Patch('payslips/:id')
  updatePayslip(@Param('id') id: string, @Body() payload: UpdatePayslipDto) {
    return this.payrollService.updatePayslip(id, payload);
  }

  /** 删除工资单。 */
  @Delete('payslips/:id')
  removePayslip(@Param('id') id: string) {
    return this.payrollService.removePayslip(id);
  }
}
