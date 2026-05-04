import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSalaryConfigDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsString()
  payType?: string;

  @IsNumber()
  @Min(0)
  baseSalary!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  housingAllowance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  transportAllowance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  socialInsuranceBase?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class UpdateSalaryConfigDto extends CreateSalaryConfigDto {
  @IsOptional()
  declare employeeId: string;

  @IsOptional()
  declare baseSalary: number;

  @IsOptional()
  declare effectiveFrom: string;
}

export class CreateSalaryRecordDto {
  @IsUUID()
  employeeId!: string;

  @IsDateString()
  month!: string;

  @IsOptional()
  @IsNumber()
  attendanceDays?: number;

  @IsOptional()
  @IsNumber()
  overtimeHours?: number;

  @IsOptional()
  @IsNumber()
  performanceScore?: number;

  @IsOptional()
  @IsNumber()
  grossPay?: number;

  @IsOptional()
  @IsNumber()
  deductions?: number;

  @IsOptional()
  @IsNumber()
  netPay?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateSalaryRecordDto extends CreateSalaryRecordDto {
  @IsOptional()
  declare employeeId: string;

  @IsOptional()
  declare month: string;
}

export class GenerateSalaryRecordDto {
  @IsUUID()
  employeeId!: string;

  @IsDateString()
  month!: string;
}

export class CreatePayslipDto {
  @IsUUID()
  salaryRecordId!: string;

  @IsUUID()
  employeeId!: string;

  @IsString()
  slipNo!: string;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  @Matches(/^uploads\/payslips\/[A-Za-z0-9_.\-\u4e00-\u9fff]+\.pdf$/i)
  downloadPath?: string;

  @IsOptional()
  @IsBoolean()
  visibleToEmployee?: boolean;
}

export class UpdatePayslipDto extends CreatePayslipDto {
  @IsOptional()
  declare salaryRecordId: string;

  @IsOptional()
  declare employeeId: string;

  @IsOptional()
  declare slipNo: string;
}
