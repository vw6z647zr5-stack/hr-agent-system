import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateAttendanceDto {
  @IsUUID()
  employeeId!: string;

  @IsDateString()
  workDate!: string;

  @IsOptional()
  @IsDateString()
  clockInAt?: string;

  @IsOptional()
  @IsDateString()
  clockOutAt?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsNumber()
  lateMinutes?: number;

  @IsOptional()
  @IsNumber()
  undertimeMinutes?: number;

  @IsOptional()
  @IsString()
  anomalyReason?: string;
}

export class UpdateAttendanceDto extends CreateAttendanceDto {
  @IsOptional()
  declare employeeId: string;

  @IsOptional()
  declare workDate: string;
}

export class CreateLeaveRequestDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsUUID()
  approverEmployeeId?: string;

  @IsString()
  leaveType!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  durationDays?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsDateString()
  approvedAt?: string;
}

export class UpdateLeaveRequestDto extends CreateLeaveRequestDto {
  @IsOptional()
  declare employeeId: string;

  @IsOptional()
  declare leaveType: string;

  @IsOptional()
  declare startAt: string;

  @IsOptional()
  declare endAt: string;
}

export class CreateLeaveBalanceDto {
  @IsUUID()
  employeeId!: string;

  @IsString()
  leaveType!: string;

  @IsNumber()
  year!: number;

  @IsNumber()
  @Min(0)
  totalDays!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  usedDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  remainingDays?: number;
}

export class UpdateLeaveBalanceDto extends CreateLeaveBalanceDto {
  @IsOptional()
  declare employeeId: string;

  @IsOptional()
  declare leaveType: string;

  @IsOptional()
  declare year: number;

  @IsOptional()
  declare totalDays: number;
}

export class CreateOvertimeRequestDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsUUID()
  approverEmployeeId?: string;

  @IsDateString()
  workDate!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hours?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  approvedAt?: string;
}

export class UpdateOvertimeRequestDto extends CreateOvertimeRequestDto {
  @IsOptional()
  declare employeeId: string;

  @IsOptional()
  declare workDate: string;

  @IsOptional()
  declare startAt: string;

  @IsOptional()
  declare endAt: string;
}
