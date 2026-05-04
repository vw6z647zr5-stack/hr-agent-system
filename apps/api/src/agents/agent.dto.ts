import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ParseResumeAgentDto {
  @IsOptional()
  @IsUUID()
  resumeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  resumeText?: string;
}

export class MatchScoreAgentDto {
  @IsOptional()
  @IsUUID()
  candidateId?: string;

  @IsOptional()
  @IsUUID()
  jobPostingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  jobRequirements?: string;
}

export class GenerateInterviewEmailDto {
  @IsOptional()
  @IsUUID()
  candidateId?: string;

  @IsOptional()
  @IsUUID()
  jobPostingId?: string;

  @IsDateString()
  interviewTime!: string;

  @IsString()
  interviewerName!: string;
}

export class EmployeeServiceChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000)
  message!: string;
}

export class PerformanceAnalyzeDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  cycleId?: string;
}
