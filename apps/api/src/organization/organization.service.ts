import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { paginateQuery } from '../common/utils/pagination';
import { StorageService } from '../storage/storage.service';
import { TenantContext } from '../tenant/tenant.context';
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
import {
  DepartmentEntity,
  EmployeeContractEntity,
  EmployeeEntity,
  PositionEntity,
} from './organization.entities';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(DepartmentEntity)
    private readonly departmentsRepository: Repository<DepartmentEntity>,
    @InjectRepository(PositionEntity)
    private readonly positionsRepository: Repository<PositionEntity>,
    @InjectRepository(EmployeeEntity)
    private readonly employeesRepository: Repository<EmployeeEntity>,
    @InjectRepository(EmployeeContractEntity)
    private readonly contractsRepository: Repository<EmployeeContractEntity>,
    private readonly storageService: StorageService,
    private readonly tenantContext: TenantContext,
  ) {}

  async listDepartments(query: ListQueryDto) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.departmentsRepository
      .createQueryBuilder('department')
      .leftJoinAndSelect('department.parent', 'parent')
      .where('department.company_id = :companyId', { companyId })
      .orderBy('department.createdAt', 'DESC');

    if (query.search) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('department.name ILIKE :search', { search: `%${query.search}%` }).orWhere(
            'department.code ILIKE :search',
            { search: `%${query.search}%` },
          );
        }),
      );
    }

    return paginateQuery(builder, query);
  }

  async getDepartmentTree() {
    const companyId = this.tenantContext.getCompanyId();
    const departments = await this.departmentsRepository.find({
      where: { companyId },
      order: { createdAt: 'ASC' },
    });
    const nodeMap = new Map<string, DepartmentEntity & { children: DepartmentEntity[] }>();

    for (const department of departments) {
      nodeMap.set(department.id, { ...department, children: [] });
    }

    const roots: Array<DepartmentEntity & { children: DepartmentEntity[] }> = [];

    for (const department of nodeMap.values()) {
      if (department.parentId && nodeMap.has(department.parentId)) {
        nodeMap.get(department.parentId)?.children.push(department);
      } else {
        roots.push(department);
      }
    }

    return roots;
  }

  async getDepartment(id: string) {
    const companyId = this.tenantContext.getCompanyId();
    const entity = await this.departmentsRepository.findOne({ where: { id, companyId }, relations: { parent: true } });
    if (!entity) {
      throw new NotFoundException('未找到部门。');
    }

    return entity;
  }

  createDepartment(dto: CreateDepartmentDto) {
    const companyId = this.tenantContext.getCompanyId();
    return this.departmentsRepository.save(this.departmentsRepository.create({ ...dto, companyId }));
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    const entity = await this.departmentsRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到部门。');
    }

    return this.departmentsRepository.save(entity);
  }

  async removeDepartment(id: string) {
    await this.getDepartment(id);
    await this.departmentsRepository.delete(id);
    return { success: true };
  }

  async listPositions(query: ListQueryDto) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.positionsRepository
      .createQueryBuilder('position')
      .leftJoinAndSelect('position.department', 'department')
      .where('position.company_id = :companyId', { companyId })
      .orderBy('position.createdAt', 'DESC');

    if (query.search) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('position.name ILIKE :search', { search: `%${query.search}%` }).orWhere(
            'position.code ILIKE :search',
            { search: `%${query.search}%` },
          );
        }),
      );
    }

    if (query.departmentId) {
      builder.andWhere('position.departmentId = :departmentId', { departmentId: query.departmentId });
    }

    return paginateQuery(builder, query);
  }

  async getPosition(id: string) {
    const companyId = this.tenantContext.getCompanyId();
    const entity = await this.positionsRepository.findOne({ where: { id, companyId }, relations: { department: true } });
    if (!entity) {
      throw new NotFoundException('未找到岗位。');
    }

    return entity;
  }

  createPosition(dto: CreatePositionDto) {
    const companyId = this.tenantContext.getCompanyId();
    return this.positionsRepository.save(this.positionsRepository.create({ ...dto, companyId }));
  }

  async updatePosition(id: string, dto: UpdatePositionDto) {
    const entity = await this.positionsRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到岗位。');
    }

    return this.positionsRepository.save(entity);
  }

  async removePosition(id: string) {
    await this.getPosition(id);
    await this.positionsRepository.delete(id);
    return { success: true };
  }

  async listEmployees(query: ListQueryDto) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.employeesRepository
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.department', 'department')
      .leftJoinAndSelect('employee.position', 'position')
      .leftJoinAndSelect('employee.manager', 'manager')
      .leftJoinAndSelect('employee.user', 'user')
      .where('employee.company_id = :companyId', { companyId })
      .orderBy('employee.createdAt', 'DESC');

    if (query.search) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('employee.fullName ILIKE :search', { search: `%${query.search}%` })
            .orWhere('employee.email ILIKE :search', { search: `%${query.search}%` })
            .orWhere('employee.employeeNo ILIKE :search', { search: `%${query.search}%` });
        }),
      );
    }

    if (query.departmentId) {
      builder.andWhere('employee.departmentId = :departmentId', { departmentId: query.departmentId });
    }

    if (query.status) {
      builder.andWhere('employee.employmentStatus = :status', { status: query.status });
    }

    return paginateQuery(builder, query);
  }

  async getEmployee(id: string) {
    const companyId = this.tenantContext.getCompanyId();
    const entity = await this.employeesRepository.findOne({
      where: { id, companyId },
      relations: { department: true, position: true, manager: true, user: true },
    });
    if (!entity) {
      throw new NotFoundException('未找到员工。');
    }

    return entity;
  }

  createEmployee(dto: CreateEmployeeDto) {
    const companyId = this.tenantContext.getCompanyId();
    return this.employeesRepository.save(this.employeesRepository.create({ ...dto, companyId }));
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto) {
    const entity = await this.employeesRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到员工。');
    }

    return this.employeesRepository.save(entity);
  }

  async removeEmployee(id: string) {
    await this.getEmployee(id);
    await this.employeesRepository.delete(id);
    return { success: true };
  }

  async listEmployeeContracts(query: ListQueryDto) {
    const builder = this.contractsRepository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.employee', 'employee')
      .orderBy('contract.createdAt', 'DESC');

    if (query.search) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('contract.contractNo ILIKE :search', { search: `%${query.search}%` }).orWhere(
            'employee.fullName ILIKE :search',
            { search: `%${query.search}%` },
          );
        }),
      );
    }

    if (query.employeeId) {
      builder.andWhere('contract.employeeId = :employeeId', { employeeId: query.employeeId });
    }

    const result = await paginateQuery(builder, query);
    await Promise.all(
      result.items
        .map((item) => item.filePath)
        .filter((item): item is string => Boolean(item))
        .map((item) => this.ensureContractFile(item)),
    );
    return result;
  }

  async getEmployeeContract(id: string) {
    const entity = await this.contractsRepository.findOne({ where: { id }, relations: { employee: true } });
    if (!entity) {
      throw new NotFoundException('未找到劳动合同。');
    }

    if (entity.filePath) {
      await this.ensureContractFile(entity.filePath);
    }

    return entity;
  }

  async getEmployeeContractDownload(id: string) {
    const entity = await this.getEmployeeContract(id);

    if (!entity.filePath?.trim()) {
      throw new NotFoundException('未找到劳动合同附件。');
    }

    await this.ensureContractFile(entity.filePath);
    return this.storageService.prepareDownload(entity.filePath);
  }

  async createEmployeeContract(dto: CreateEmployeeContractDto) {
    const saved = await this.contractsRepository.save(this.contractsRepository.create(dto));
    if (saved.filePath) {
      await this.ensureContractFile(saved.filePath);
    }
    return saved;
  }

  async updateEmployeeContract(id: string, dto: UpdateEmployeeContractDto) {
    const entity = await this.contractsRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到劳动合同。');
    }

    const saved = await this.contractsRepository.save(entity);
    if (saved.filePath) {
      await this.ensureContractFile(saved.filePath);
    }
    return saved;
  }

  async removeEmployeeContract(id: string) {
    await this.getEmployeeContract(id);
    await this.contractsRepository.delete(id);
    return { success: true };
  }

  private ensureContractFile(filePath: string) {
    const normalized = filePath.toLowerCase();
    return normalized.endsWith('.docx')
      ? this.storageService.ensureDocxPlaceholder(filePath)
      : this.storageService.ensurePdfPlaceholder(filePath);
  }
}
