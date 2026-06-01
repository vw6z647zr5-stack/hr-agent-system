import { AgentRunLogEntity, KnowledgeBaseArticleEntity, ProfileChangeRequestEntity } from '../agents/agent-support.entities';
import {
  AttendanceEntity,
  LeaveBalanceEntity,
  LeaveRequestEntity,
  OvertimeRequestEntity,
} from '../attendance/attendance.entities';
import { PulseSurveyEntity, PulseSurveyResponseEntity } from '../agents/pulse-survey.entities';
import { AuditLogEntity } from '../audit/audit.entity';
import { CompanyEntity } from '../company/company.entity';
import {
  DepartmentEntity,
  EmployeeContractEntity,
  EmployeeEntity,
  PositionEntity,
} from '../organization/organization.entities';
import {
  PerformanceCycleEntity,
  PerformanceGoalEntity,
  PerformanceReviewEntity,
} from '../performance/performance.entities';
import { PayslipEntity, SalaryConfigEntity, SalaryRecordEntity } from '../payroll/payroll.entities';
import {
  CandidateEntity,
  InterviewEntity,
  JobPostingEntity,
  OfferEntity,
  ResumeEntity,
} from '../recruitment/recruitment.entities';
import { UserEntity } from '../users/user.entity';
import {
  WorkflowEventEntity,
  WorkflowNotificationEntity,
  WorkflowTaskEntity,
} from '../workflows/workflow.entities';

export const DATABASE_ENTITIES = [
  CompanyEntity,
  PulseSurveyEntity,
  PulseSurveyResponseEntity,
  UserEntity,
  DepartmentEntity,
  PositionEntity,
  EmployeeEntity,
  EmployeeContractEntity,
  JobPostingEntity,
  CandidateEntity,
  ResumeEntity,
  InterviewEntity,
  OfferEntity,
  AttendanceEntity,
  LeaveRequestEntity,
  LeaveBalanceEntity,
  OvertimeRequestEntity,
  PerformanceCycleEntity,
  PerformanceGoalEntity,
  PerformanceReviewEntity,
  SalaryConfigEntity,
  SalaryRecordEntity,
  PayslipEntity,
  KnowledgeBaseArticleEntity,
  AgentRunLogEntity,
  ProfileChangeRequestEntity,
  AuditLogEntity,
  WorkflowNotificationEntity,
  WorkflowTaskEntity,
  WorkflowEventEntity,
] as const;
