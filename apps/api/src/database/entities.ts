import { KnowledgeBaseArticleEntity, ProfileChangeRequestEntity } from '../agents/agent-support.entities';
import {
  AttendanceEntity,
  LeaveBalanceEntity,
  LeaveRequestEntity,
  OvertimeRequestEntity,
} from '../attendance/attendance.entities';
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

export const DATABASE_ENTITIES = [
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
  ProfileChangeRequestEntity,
] as const;
