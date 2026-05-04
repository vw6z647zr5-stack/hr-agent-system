import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePerformanceCycleDto {
  @IsString()
  name!: string;

  @IsNumber()
  year!: number;

  @IsOptional()
  @IsString()
  periodType?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdatePerformanceCycleDto extends CreatePerformanceCycleDto {
  @IsOptional()
  declare name: string;

  @IsOptional()
  declare year: number;

  @IsOptional()
  declare startDate: string;

  @IsOptional()
  declare endDate: string;
}

export class CreatePerformanceGoalDto {
  @IsUUID()
  cycleId!: string;

  @IsUUID()
  employeeId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsString()
  targetValue?: string;

  @IsOptional()
  @IsString()
  currentValue?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdatePerformanceGoalDto extends CreatePerformanceGoalDto {
  @IsOptional()
  declare cycleId: string;

  @IsOptional()
  declare employeeId: string;

  @IsOptional()
  declare title: string;
}

export class CreatePerformanceReviewDto {
  @IsUUID()
  cycleId!: string;

  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsUUID()
  reviewerEmployeeId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overallScore?: number;

  @IsOptional()
  @IsString()
  rating?: string;

  @IsOptional()
  @IsString()
  strengths?: string;

  @IsOptional()
  @IsString()
  improvements?: string;

  @IsOptional()
  @IsString()
  summary?: string;
}

export class UpdatePerformanceReviewDto extends CreatePerformanceReviewDto {
  @IsOptional()
  declare cycleId: string;

  @IsOptional()
  declare employeeId: string;
}
