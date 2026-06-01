export { AgentRunLogListQueryDto } from './agent-run-log.dto';

import { IsDateString, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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

export class PulseSurveyRespondDto {
  @IsUUID()
  surveyId!: string;

  @IsObject()
  answers!: Record<string, unknown>;
}

// --- Attrition Risk v2 types ---

export interface AttritionFactorBreakdown {
  factor: string;
  label: string;
  weight: number;
  score: number;
  weightedScore: number;
  evidence: string[];
}

export interface AttritionRiskProfile {
  employeeId: string;
  employeeName: string;
  department: string;
  riskScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  explanation: string;
  factorBreakdown: AttritionFactorBreakdown[];
  indicators: {
    lateCount: number;
    leaveCount: number;
    overtimeCount: number;
    currentScore: number;
    previousScore: number;
    profileChangeCount: number;
    tenureMonths: number;
    monthsSinceLastPromotion: number;
    sickLeaveCount: number;
    overtimeMonthlyAvg: number;
  };
  recommendation: string;
  generatedAt: string;
}
