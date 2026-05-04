import { IsDateString, IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ListProfileChangeReviewQueueDto {
  @IsOptional()
  @IsIn(['all', 'pending', 'approved', 'rejected'])
  status?: 'all' | 'pending' | 'approved' | 'rejected';
}

export class CreateSelfLeaveRequestDto {
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
  @Min(0.5)
  durationDays?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateSelfOvertimeRequestDto {
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
  @Min(0.5)
  hours?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateProfileChangeRequestDto {
  @IsObject()
  changes!: Record<string, unknown>;
}

export class ReviewProfileChangeRequestDto {
  @IsOptional()
  @IsUUID()
  reviewerEmployeeId?: string;

  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  reviewComment?: string;
}
