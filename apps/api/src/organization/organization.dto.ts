import {
  IsArray,
  IsDateString,
  IsEmail,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDepartmentDto {
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(60)
  code!: string;

  @IsOptional()
  @IsUUID()
  managerEmployeeId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateDepartmentDto extends CreateDepartmentDto {
  @IsOptional()
  declare name: string;

  @IsOptional()
  declare code: string;
}

export class CreatePositionDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsString()
  level!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdatePositionDto extends CreatePositionDto {
  @IsOptional()
  declare name: string;

  @IsOptional()
  declare code: string;

  @IsOptional()
  declare level: string;
}

export class CreateEmployeeDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  employeeNo!: string;

  @IsString()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @IsUUID()
  managerEmployeeId?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsString()
  employmentStatus?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsDateString()
  joinDate!: string;

  @IsOptional()
  @IsDateString()
  probationEndDate?: string;

  @IsOptional()
  @IsDateString()
  regularizationDate?: string;

  @IsOptional()
  @IsDateString()
  exitDate?: string;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsArray()
  certificates?: string[];

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsObject()
  emergencyContact?: Record<string, string>;

  @IsOptional()
  @IsString()
  nationalIdMasked?: string;

  @IsOptional()
  @IsString()
  bankAccountMasked?: string;

  @IsOptional()
  @IsString()
  profileSummary?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class UpdateEmployeeDto extends CreateEmployeeDto {
  @IsOptional()
  declare employeeNo: string;

  @IsOptional()
  declare fullName: string;

  @IsOptional()
  declare email: string;

  @IsOptional()
  declare phone: string;

  @IsOptional()
  declare joinDate: string;
}

export class CreateEmployeeContractDto {
  @IsUUID()
  employeeId!: string;

  @IsString()
  contractNo!: string;

  @IsString()
  contractType!: string;

  @IsString()
  status!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  probationMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryBase?: number;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  @Matches(/^uploads\/contracts\/[A-Za-z0-9_.\-\u4e00-\u9fff]+\.((pdf)|(docx))$/i)
  filePath?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEmployeeContractDto extends CreateEmployeeContractDto {
  @IsOptional()
  declare employeeId: string;

  @IsOptional()
  declare contractNo: string;

  @IsOptional()
  declare contractType: string;

  @IsOptional()
  declare status: string;

  @IsOptional()
  declare startDate: string;
}
