import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class AgentRunLogListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  agentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;

  @IsOptional()
  @IsIn(['llm', 'fallback', 'grounded'])
  mode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  fallbackReason?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  subjectType?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
