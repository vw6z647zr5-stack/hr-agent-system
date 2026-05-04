import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { buildAttachmentContentDisposition } from '../common/utils/content-disposition';
import { Role } from '../users/user.entity';
import {
  CreateDepartmentDto,
  CreateEmployeeContractDto,
  CreateEmployeeDto,
  CreatePositionDto,
  UpdateDepartmentDto,
  UpdateEmployeeContractDto,
  UpdateEmployeeDto,
  UpdatePositionDto,
} from './organization.dto';
import { OrganizationService } from './organization.service';
import { ListQueryDto } from '../common/dto/list-query.dto';

@Controller()
@Roles(Role.ADMIN, Role.HR, Role.MANAGER)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  /** 分页查询部门，支持搜索。 */
  @Get('departments')
  listDepartments(@Query() query: ListQueryDto) {
    return this.organizationService.listDepartments(query);
  }

  /** 返回部门层级树。 */
  @Get('departments/tree')
  getDepartmentTree() {
    return this.organizationService.getDepartmentTree();
  }

  /** 返回单条部门记录。 */
  @Get('departments/:id')
  getDepartment(@Param('id') id: string) {
    return this.organizationService.getDepartment(id);
  }

  /** 创建部门。 */
  @Post('departments')
  createDepartment(@Body() payload: CreateDepartmentDto) {
    return this.organizationService.createDepartment(payload);
  }

  /** 更新部门。 */
  @Patch('departments/:id')
  updateDepartment(@Param('id') id: string, @Body() payload: UpdateDepartmentDto) {
    return this.organizationService.updateDepartment(id, payload);
  }

  /** 删除部门。 */
  @Delete('departments/:id')
  removeDepartment(@Param('id') id: string) {
    return this.organizationService.removeDepartment(id);
  }

  /** 分页查询岗位，支持筛选。 */
  @Get('positions')
  listPositions(@Query() query: ListQueryDto) {
    return this.organizationService.listPositions(query);
  }

  /** 返回单条岗位记录。 */
  @Get('positions/:id')
  getPosition(@Param('id') id: string) {
    return this.organizationService.getPosition(id);
  }

  /** 创建岗位。 */
  @Post('positions')
  createPosition(@Body() payload: CreatePositionDto) {
    return this.organizationService.createPosition(payload);
  }

  /** 更新岗位。 */
  @Patch('positions/:id')
  updatePosition(@Param('id') id: string, @Body() payload: UpdatePositionDto) {
    return this.organizationService.updatePosition(id, payload);
  }

  /** 删除岗位。 */
  @Delete('positions/:id')
  removePosition(@Param('id') id: string) {
    return this.organizationService.removePosition(id);
  }

  /** 分页查询员工，包含关联信息并支持搜索。 */
  @Get('employees')
  listEmployees(@Query() query: ListQueryDto) {
    return this.organizationService.listEmployees(query);
  }

  /** 返回单名员工档案。 */
  @Get('employees/:id')
  getEmployee(@Param('id') id: string) {
    return this.organizationService.getEmployee(id);
  }

  /** 创建员工档案。 */
  @Post('employees')
  createEmployee(@Body() payload: CreateEmployeeDto) {
    return this.organizationService.createEmployee(payload);
  }

  /** 更新员工生命周期或档案信息。 */
  @Patch('employees/:id')
  updateEmployee(@Param('id') id: string, @Body() payload: UpdateEmployeeDto) {
    return this.organizationService.updateEmployee(id, payload);
  }

  /** 删除员工档案。 */
  @Delete('employees/:id')
  removeEmployee(@Param('id') id: string) {
    return this.organizationService.removeEmployee(id);
  }

  /** 分页查询员工劳动合同。 */
  @Get('employee-contracts')
  listEmployeeContracts(@Query() query: ListQueryDto) {
    return this.organizationService.listEmployeeContracts(query);
  }

  /** 返回单份员工劳动合同。 */
  @Get('employee-contracts/:id')
  getEmployeeContract(@Param('id') id: string) {
    return this.organizationService.getEmployeeContract(id);
  }

  /** 下载员工劳动合同文件。 */
  @Get('employee-contracts/:id/download')
  async downloadEmployeeContract(@Param('id') id: string, @Res({ passthrough: true }) response: Response) {
    const file = await this.organizationService.getEmployeeContractDownload(id);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', buildAttachmentContentDisposition(file.fileName));
    response.setHeader('Cache-Control', 'no-store');
    return file.buffer;
  }

  /** 创建员工劳动合同。 */
  @Post('employee-contracts')
  createEmployeeContract(@Body() payload: CreateEmployeeContractDto) {
    return this.organizationService.createEmployeeContract(payload);
  }

  /** 更新员工劳动合同。 */
  @Patch('employee-contracts/:id')
  updateEmployeeContract(@Param('id') id: string, @Body() payload: UpdateEmployeeContractDto) {
    return this.organizationService.updateEmployeeContract(id, payload);
  }

  /** 删除员工劳动合同。 */
  @Delete('employee-contracts/:id')
  removeEmployeeContract(@Param('id') id: string) {
    return this.organizationService.removeEmployeeContract(id);
  }
}
