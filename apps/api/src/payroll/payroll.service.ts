import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AuthenticatedUser, Role } from '../users/user.entity';
import { canViewSalaryDetails, maskCurrency } from '../common/utils/masking';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { paginateQuery } from '../common/utils/pagination';
import { AttendanceEntity, OvertimeRequestEntity } from '../attendance/attendance.entities';
import { PerformanceReviewEntity } from '../performance/performance.entities';
import { StorageService } from '../storage/storage.service';
import { TenantContext } from '../tenant/tenant.context';
import {
  CreatePayslipDto,
  CreateSalaryConfigDto,
  CreateSalaryRecordDto,
  GenerateSalaryRecordDto,
  UpdatePayslipDto,
  UpdateSalaryConfigDto,
  UpdateSalaryRecordDto,
} from './payroll.dto';
import { PayslipEntity, SalaryConfigEntity, SalaryRecordEntity } from './payroll.entities';

@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(SalaryConfigEntity)
    private readonly salaryConfigsRepository: Repository<SalaryConfigEntity>,
    @InjectRepository(SalaryRecordEntity)
    private readonly salaryRecordsRepository: Repository<SalaryRecordEntity>,
    @InjectRepository(PayslipEntity)
    private readonly payslipsRepository: Repository<PayslipEntity>,
    @InjectRepository(AttendanceEntity)
    private readonly attendanceRepository: Repository<AttendanceEntity>,
    @InjectRepository(OvertimeRequestEntity)
    private readonly overtimeRepository: Repository<OvertimeRequestEntity>,
    @InjectRepository(PerformanceReviewEntity)
    private readonly reviewsRepository: Repository<PerformanceReviewEntity>,
    private readonly storageService: StorageService,
    private readonly tenantContext: TenantContext,
  ) {}

  async listSalaryConfigs(query: ListQueryDto, user: AuthenticatedUser) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.salaryConfigsRepository
      .createQueryBuilder('salaryConfig')
      .leftJoinAndSelect('salaryConfig.employee', 'employee')
      .where('employee.company_id = :companyId', { companyId })
      .orderBy('salaryConfig.createdAt', 'DESC');

    if (query.search) {
      builder.andWhere('employee.fullName ILIKE :search', { search: `%${query.search}%` });
    }

    if (query.employeeId) {
      builder.andWhere('salaryConfig.employeeId = :employeeId', { employeeId: query.employeeId });
    }

    const result = await paginateQuery(builder, query);
    return {
      ...result,
      items: result.items.map((item) => this.presentSalaryConfig(item, user)),
    };
  }

  async getSalaryConfig(id: string, user: AuthenticatedUser) {
    const entity = await this.salaryConfigsRepository.findOne({ where: { id }, relations: { employee: true } });
    if (!entity) {
      throw new NotFoundException('未找到薪资配置。');
    }

    return this.presentSalaryConfig(entity, user);
  }

  createSalaryConfig(dto: CreateSalaryConfigDto) {
    return this.salaryConfigsRepository.save(this.salaryConfigsRepository.create(dto));
  }

  async updateSalaryConfig(id: string, dto: UpdateSalaryConfigDto) {
    const entity = await this.salaryConfigsRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到薪资配置。');
    }

    return this.salaryConfigsRepository.save(entity);
  }

  async removeSalaryConfig(id: string) {
    const entity = await this.salaryConfigsRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('未找到薪资配置。');
    }

    await this.salaryConfigsRepository.delete(id);
    return { success: true };
  }

  async listSalaryRecords(query: ListQueryDto, user: AuthenticatedUser) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.salaryRecordsRepository
      .createQueryBuilder('salaryRecord')
      .leftJoinAndSelect('salaryRecord.employee', 'employee')
      .where('employee.company_id = :companyId', { companyId })
      .orderBy('salaryRecord.month', 'DESC');

    if (query.search) {
      builder.andWhere('employee.fullName ILIKE :search', { search: `%${query.search}%` });
    }

    if (query.employeeId) {
      builder.andWhere('salaryRecord.employeeId = :employeeId', { employeeId: query.employeeId });
    }

    if (query.status) {
      builder.andWhere('salaryRecord.status = :status', { status: query.status });
    }

    const result = await paginateQuery(builder, query);
    return {
      ...result,
      items: result.items.map((item) => this.presentSalaryRecord(item, user)),
    };
  }

  async getSalaryRecord(id: string, user: AuthenticatedUser) {
    const entity = await this.salaryRecordsRepository.findOne({ where: { id }, relations: { employee: true } });
    if (!entity) {
      throw new NotFoundException('未找到工资记录。');
    }

    return this.presentSalaryRecord(entity, user);
  }

  createSalaryRecord(dto: CreateSalaryRecordDto) {
    return this.salaryRecordsRepository.save(this.salaryRecordsRepository.create(dto));
  }

  async generateSalaryRecord(dto: GenerateSalaryRecordDto) {
    const config = await this.salaryConfigsRepository.findOne({
      where: { employeeId: dto.employeeId },
      order: { effectiveFrom: 'DESC' },
    });

    if (!config) {
      throw new NotFoundException('未找到该员工的薪资配置。');
    }

    const monthStart = new Date(dto.month);
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

    const attendanceDays = await this.attendanceRepository
      .createQueryBuilder('attendance')
      .where('attendance.employeeId = :employeeId', { employeeId: dto.employeeId })
      .andWhere('attendance.workDate >= :monthStart AND attendance.workDate < :monthEnd', {
        monthStart: dto.month,
        monthEnd: monthEnd.toISOString().slice(0, 10),
      })
      .getCount();

    const overtimeRows = await this.overtimeRepository
      .createQueryBuilder('overtime')
      .where('overtime.employeeId = :employeeId', { employeeId: dto.employeeId })
      .andWhere('overtime.status = :status', { status: 'approved' })
      .andWhere('overtime.workDate >= :monthStart AND overtime.workDate < :monthEnd', {
        monthStart: dto.month,
        monthEnd: monthEnd.toISOString().slice(0, 10),
      })
      .getMany();

    const overtimeHours = overtimeRows.reduce((sum, row) => sum + Number(row.hours), 0);

    const latestReview = await this.reviewsRepository
      .createQueryBuilder('review')
      .where('review.employeeId = :employeeId', { employeeId: dto.employeeId })
      .orderBy('review.createdAt', 'DESC')
      .getOne();

    const performanceScore = Number(latestReview?.overallScore ?? 3.5);
    const baseSalary = Number(config.baseSalary);
    const housingAllowance = Number(config.housingAllowance);
    const transportAllowance = Number(config.transportAllowance);
    const bonus = baseSalary * Number(config.bonusRate) * (performanceScore / 5);
    const overtimePay = overtimeHours * (baseSalary / 21.75 / 8) * 1.5;
    const grossPay = baseSalary + housingAllowance + transportAllowance + bonus + overtimePay;
    const deductions = Number(config.socialInsuranceBase) * 0.105 + grossPay * Number(config.taxRate);
    const netPay = grossPay - deductions;

    const existing = await this.salaryRecordsRepository.findOne({
      where: { employeeId: dto.employeeId, month: dto.month },
    });

    const entity = existing
      ? await this.salaryRecordsRepository.preload({
          id: existing.id,
          employeeId: dto.employeeId,
          month: dto.month,
          attendanceDays,
          overtimeHours,
          performanceScore,
          grossPay,
          deductions,
          netPay,
          status: 'generated',
          generatedAt: new Date(),
        })
      : this.salaryRecordsRepository.create({
          employeeId: dto.employeeId,
          month: dto.month,
          attendanceDays,
          overtimeHours,
          performanceScore,
          grossPay,
          deductions,
          netPay,
          status: 'generated',
          generatedAt: new Date(),
        });

    const saved = await this.salaryRecordsRepository.save(entity!);

    const slipNo = `PS-${dto.month.slice(0, 7).replace('-', '')}-${dto.employeeId.slice(-4).toUpperCase()}`;
    const payslip = await this.payslipsRepository.findOne({ where: { salaryRecordId: saved.id } });

    if (!payslip) {
      const downloadPath = `uploads/payslips/${slipNo}.pdf`;
      await this.storageService.ensurePdfPlaceholder(downloadPath);
      await this.payslipsRepository.save(
        this.payslipsRepository.create({
          salaryRecordId: saved.id,
          employeeId: dto.employeeId,
          slipNo,
          issuedAt: new Date(),
          downloadPath,
          visibleToEmployee: true,
        }),
      );
    }

    return saved;
  }

  async updateSalaryRecord(id: string, dto: UpdateSalaryRecordDto) {
    const entity = await this.salaryRecordsRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到工资记录。');
    }

    return this.salaryRecordsRepository.save(entity);
  }

  async removeSalaryRecord(id: string) {
    const entity = await this.salaryRecordsRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('未找到工资记录。');
    }

    await this.salaryRecordsRepository.delete(id);
    return { success: true };
  }

  async listPayslips(query: ListQueryDto, user: AuthenticatedUser) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.payslipsRepository
      .createQueryBuilder('payslip')
      .leftJoinAndSelect('payslip.salaryRecord', 'salaryRecord')
      .leftJoinAndSelect('payslip.employee', 'employee')
      .where('employee.company_id = :companyId', { companyId })
      .orderBy('payslip.issuedAt', 'DESC');

    if (query.search) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('payslip.slipNo ILIKE :search', { search: `%${query.search}%` }).orWhere(
            'employee.fullName ILIKE :search',
            { search: `%${query.search}%` },
          );
        }),
      );
    }

    if (query.employeeId) {
      builder.andWhere('payslip.employeeId = :employeeId', { employeeId: query.employeeId });
    }

    const result = await paginateQuery(builder, query);
    await Promise.all(
      result.items
        .map((item) => item.downloadPath)
        .filter((item): item is string => Boolean(item))
        .map((item) => this.storageService.ensurePdfPlaceholder(item)),
    );
    return {
      ...result,
      items: result.items.map((item) => this.presentPayslip(item, user)),
    };
  }

  async getPayslip(id: string, user: AuthenticatedUser) {
    const entity = await this.payslipsRepository.findOne({
      where: { id },
      relations: { employee: true, salaryRecord: true },
    });
    if (!entity) {
      throw new NotFoundException('未找到工资单。');
    }

    if (entity.downloadPath) {
      await this.storageService.ensurePdfPlaceholder(entity.downloadPath);
    }

    return this.presentPayslip(entity, user);
  }

  async getPayslipDownload(id: string, user: AuthenticatedUser) {
    const entity = await this.payslipsRepository.findOne({
      where: { id },
      relations: { employee: true, salaryRecord: true },
    });

    if (!entity) {
      throw new NotFoundException('未找到工资单。');
    }

    if (!canViewSalaryDetails(user, entity.employeeId)) {
      throw new ForbiddenException('当前无权下载该工资单。');
    }

    if (user.role === Role.EMPLOYEE && !entity.visibleToEmployee) {
      throw new ForbiddenException('该工资单暂未对员工开放。');
    }

    if (!entity.downloadPath?.trim()) {
      throw new NotFoundException('未找到工资单附件。');
    }

    await this.storageService.ensurePdfPlaceholder(entity.downloadPath);
    return this.storageService.prepareDownload(entity.downloadPath, `${entity.slipNo}.pdf`);
  }

  createPayslip(dto: CreatePayslipDto) {
    return this.createPayslipWithFile(dto);
  }

  async updatePayslip(id: string, dto: UpdatePayslipDto) {
    const entity = await this.payslipsRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到工资单。');
    }

    if (entity.downloadPath) {
      await this.storageService.ensurePdfPlaceholder(entity.downloadPath);
    }

    return this.payslipsRepository.save(entity);
  }

  async removePayslip(id: string) {
    const entity = await this.payslipsRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('未找到工资单。');
    }

    await this.payslipsRepository.delete(id);
    return { success: true };
  }

  private presentSalaryConfig(entity: SalaryConfigEntity, user: AuthenticatedUser) {
    if (canViewSalaryDetails(user, entity.employeeId)) {
      return entity;
    }

    return {
      ...entity,
      baseSalary: maskCurrency(entity.baseSalary),
      housingAllowance: maskCurrency(entity.housingAllowance),
      transportAllowance: maskCurrency(entity.transportAllowance),
      socialInsuranceBase: maskCurrency(entity.socialInsuranceBase),
    };
  }

  private presentSalaryRecord(entity: SalaryRecordEntity, user: AuthenticatedUser) {
    if (canViewSalaryDetails(user, entity.employeeId)) {
      return entity;
    }

    return {
      ...entity,
      grossPay: maskCurrency(entity.grossPay),
      deductions: maskCurrency(entity.deductions),
      netPay: maskCurrency(entity.netPay),
    };
  }

  private presentPayslip(entity: PayslipEntity, user: AuthenticatedUser) {
    const salaryRecord = entity.salaryRecord ? this.presentSalaryRecord(entity.salaryRecord, user) : entity.salaryRecord;
    return { ...entity, salaryRecord };
  }

  private async createPayslipWithFile(dto: CreatePayslipDto) {
    if (dto.downloadPath) {
      await this.storageService.ensurePdfPlaceholder(dto.downloadPath);
    }

    return this.payslipsRepository.save(this.payslipsRepository.create(dto));
  }
}
