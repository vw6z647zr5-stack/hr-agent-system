import {
  IsArray,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateJobPostingDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsString()
  description!: string;

  @IsString()
  requirements!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  targetCount?: number;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @IsOptional()
  @IsDateString()
  closedAt?: string;
}

export class UpdateJobPostingDto extends CreateJobPostingDto {
  @IsOptional()
  declare title: string;

  @IsOptional()
  declare description: string;

  @IsOptional()
  declare requirements: string;
}

export class CreateCandidateDto {
  @IsOptional()
  @IsUUID()
  appliedJobPostingId?: string;

  @IsString()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  currentCompany?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  yearsOfExperience?: number;

  @IsOptional()
  @IsArray()
  skills?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  aiMatchScore?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCandidateDto extends CreateCandidateDto {
  @IsOptional()
  declare fullName: string;

  @IsOptional()
  declare email: string;

  @IsOptional()
  declare phone: string;
}

export class CreateResumeDto {
  @IsUUID()
  candidateId!: string;

  @IsString()
  fileName!: string;

  @IsString()
  @MaxLength(220)
  @Matches(/^uploads\/resumes\/[A-Za-z0-9_.\-\u4e00-\u9fff]+\.((pdf)|(docx))$/i)
  filePath!: string;

  @IsOptional()
  @IsString()
  parsedText?: string;

  @IsOptional()
  parsedProfile?: Record<string, unknown>;
}

export class UpdateResumeDto extends CreateResumeDto {
  @IsOptional()
  declare candidateId: string;

  @IsOptional()
  declare fileName: string;

  @IsOptional()
  declare filePath: string;
}

export class CreateInterviewDto {
  @IsUUID()
  candidateId!: string;

  @IsOptional()
  @IsUUID()
  jobPostingId?: string;

  @IsOptional()
  @IsUUID()
  interviewerEmployeeId?: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  interviewType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  score?: number;

  @IsOptional()
  @IsString()
  feedback?: string;
}

export class UpdateInterviewDto extends CreateInterviewDto {
  @IsOptional()
  declare candidateId: string;

  @IsOptional()
  declare scheduledAt: string;
}

export class CreateOfferDto {
  @IsUUID()
  candidateId!: string;

  @IsOptional()
  @IsUUID()
  jobPostingId?: string;

  @IsOptional()
  @IsUUID()
  approvalByEmployeeId?: string;

  @IsOptional()
  @IsNumber()
  salaryOffered?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  offeredAt?: string;

  @IsOptional()
  @IsDateString()
  acceptedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateOfferDto extends CreateOfferDto {
  @IsOptional()
  declare candidateId: string;
}

export class CandidatePortalApplicationDto {
  @IsUUID()
  jobPostingId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @IsString()
  currentCompany?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  yearsOfExperience?: number;

  @IsOptional()
  @IsArray()
  skills?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CandidatePortalChatDto {
  @IsString()
  @IsNotEmpty()
  message!: string;
}
