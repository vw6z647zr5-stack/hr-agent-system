import { apiRequest, toQueryString } from './http';

export type ProfileChangeReviewStatus = 'all' | 'pending' | 'approved' | 'rejected';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | string;

export interface EmployeeProfileSnapshot {
  id: string;
  employeeNo?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  grade?: string;
  joinDate?: string;
  probationEndDate?: string | null;
  regularizationDate?: string | null;
  employmentType?: string;
  employmentStatus?: string;
  education?: string;
  certificates?: string[];
  address?: string;
  emergencyContact?: {
    name?: string;
    phone?: string;
  } | null;
  nationalIdMasked?: string;
  bankAccountMasked?: string;
  profileSummary?: string;
  avatarUrl?: string;
  profileCompletion?: number;
  tenureDays?: number;
  department?: {
    name?: string;
    code?: string;
  } | null;
  position?: {
    name?: string;
    code?: string;
    level?: string;
  } | null;
  manager?: {
    fullName?: string;
    email?: string;
  } | null;
}

export interface SelfServiceStats {
  pendingLeaveRequests: number;
  pendingOvertimeRequests: number;
  profileChanges: number;
  visiblePayslips: number;
  approvedOvertimeHours: number;
  lateRecords: number;
  anomalyRecords: number;
  annualLeaveRemaining: number;
}

export interface SelfServiceReminder {
  id: string;
  priority: 'high' | 'medium' | 'low' | string;
  title: string;
  description: string;
}

export interface EmploymentSnapshot {
  id: string;
  contractNo: string;
  contractType: string;
  contractStatus: string;
  startDate: string;
  endDate: string | null;
  probationMonths: number;
  salaryBase: number;
  notes?: string;
  hasDocument?: boolean;
  daysToExpire: number | null;
}

export interface LeaveBalanceRow {
  id: string;
  leaveType: string;
  year: number;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
}

export interface AttendanceSummary {
  trackedDays: number;
  presentDays: number;
  lateRecords: number;
  anomalyRecords: number;
  latestStatus: string | null;
  latestWorkDate: string | null;
}

export interface AttendanceRow {
  id: string;
  workDate: string;
  status: string;
  source: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  lateMinutes: number;
  undertimeMinutes: number;
  anomalyReason: string;
}

export interface LeaveRequestRow {
  id: string;
  leaveType: string;
  startAt: string;
  endAt: string;
  durationDays: number;
  reason: string;
  status: RequestStatus;
  approverName: string | null;
  approvedAt: string | null;
  rejectionReason: string;
  createdAt: string;
}

export interface OvertimeRequestRow {
  id: string;
  workDate: string;
  startAt: string;
  endAt: string;
  hours: number;
  reason: string;
  status: RequestStatus;
  approverName: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface ProfileChangeRow {
  id: string;
  status: RequestStatus;
  changes: Record<string, unknown>;
  reviewComment: string;
  reviewerName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ApprovalTimelineRow {
  id: string;
  category: 'leave' | 'overtime' | 'profile' | string;
  status: RequestStatus;
  title: string;
  detail: string;
  submittedAt: string;
  completedAt: string | null;
}

export interface PayslipRow {
  id: string;
  slipNo: string;
  issuedAt: string;
  downloadPath: string;
  salaryRecord: {
    month: string;
    grossPay: number;
    deductions: number;
    netPay: number;
    overtimeHours: number;
    performanceScore: number;
  } | null;
}

export interface CompensationSnapshot {
  month: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  overtimeHours: number;
  performanceScore: number;
  slipNo: string;
  issuedAt: string;
  downloadPath: string;
}

export interface PerformanceSnapshot {
  latestReview: {
    id: string;
    cycleName: string | null;
    overallScore: number;
    rating: string;
    strengths: string;
    improvements: string;
    summary: string;
    reviewerName: string | null;
    createdAt: string;
  } | null;
  activeGoals: Array<{
    id: string;
    title: string;
    category: string;
    weight: number;
    targetValue: string;
    currentValue: string;
    status: string;
    description: string;
    cycleName: string | null;
  }>;
}

export interface KnowledgeBaseTip {
  id: string;
  category: string;
  title: string;
  question: string;
  answer: string;
  tags: string[];
}

export interface SelfServiceDashboard {
  employee: EmployeeProfileSnapshot;
  employment: EmploymentSnapshot | null;
  stats: SelfServiceStats;
  attendanceSummary: AttendanceSummary;
  leaveBalances: LeaveBalanceRow[];
  recentAttendance: AttendanceRow[];
  recentLeaveRequests: LeaveRequestRow[];
  recentOvertimeRequests: OvertimeRequestRow[];
  recentProfileChanges: ProfileChangeRow[];
  approvalTimeline: ApprovalTimelineRow[];
  recentPayslips: PayslipRow[];
  compensation: CompensationSnapshot | null;
  performance: PerformanceSnapshot;
  knowledgeBaseTips: KnowledgeBaseTip[];
  reminders: SelfServiceReminder[];
}

export interface CreateSelfLeaveRequestPayload {
  leaveType: string;
  durationDays?: number;
  startAt: string;
  endAt: string;
  reason?: string;
}

export interface CreateSelfOvertimeRequestPayload {
  workDate: string;
  hours?: number;
  startAt: string;
  endAt: string;
  reason?: string;
}

export function getSelfServiceDashboard() {
  return apiRequest<SelfServiceDashboard>('/self-service/dashboard');
}

export function createSelfLeaveRequest(payload: CreateSelfLeaveRequestPayload) {
  return apiRequest<LeaveRequestRow>('/self-service/leave-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createSelfOvertimeRequest(payload: CreateSelfOvertimeRequestPayload) {
  return apiRequest<OvertimeRequestRow>('/self-service/overtime-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createProfileChangeRequest(payload: { changes: Record<string, unknown> }) {
  return apiRequest<ProfileChangeRow>('/self-service/profile-change-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listMyProfileChangeRequests() {
  return apiRequest<ProfileChangeRow[]>('/self-service/profile-change-requests');
}

export function listProfileChangeReviewQueue(status: ProfileChangeReviewStatus = 'pending') {
  return apiRequest<Array<Record<string, unknown>>>(
    `/self-service/profile-change-requests/review-queue${toQueryString({ status })}`,
  );
}

export function reviewProfileChangeRequest(id: string, payload: { status: 'approved' | 'rejected'; reviewComment?: string }) {
  return apiRequest<Record<string, unknown>>(`/self-service/profile-change-requests/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function getSelfPayslipDownloadUrl(id: string) {
  return `/self-service/payslips/${id}/download`;
}

export function getSelfActiveContractDownloadUrl() {
  return '/self-service/contracts/active/download';
}
