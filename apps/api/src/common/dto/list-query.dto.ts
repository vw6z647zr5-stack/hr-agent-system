import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsUUID()
  candidateId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(40)
  stage?: string;
}
