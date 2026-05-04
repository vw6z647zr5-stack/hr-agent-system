import type { AuthUser, PaginatedResponse } from '../types';
import { apiRequest, toQueryString } from './http';

export interface RecruitmentDashboardStats {
  openJobPostings: number;
  activeCandidates: number;
  interviewsThisWeek: number;
  pendingOffers: number;
  acceptedOffers: number;
  resumeCoverage: number;
  averageAiMatchScore: number;
}

export interface RecruitmentFunnelItem {
  stage: string;
  label: string;
  count: number;
}

export interface RecruitmentSourceItem {
  source: string;
  count: number;
}

export interface RecruitmentJobHealthItem {
  id: string;
  title: string;
  departmentName: string | null;
  positionName: string | null;
  location: string;
  employmentType: string;
  status: string;
  targetCount: number;
  candidateCount: number;
  interviewCount: number;
  offerCount: number;
  acceptedOffers: number;
  progressPercent: number;
  averageMatchScore: number;
  daysOpen: number | null;
  latestInterviewAt: string | null;
  urgencyLevel: 'high' | 'medium' | 'low' | string;
}

export interface PriorityCandidateItem {
  id: string;
  fullName: string;
  jobTitle: string | null;
  stage: string;
  source: string;
  status: string;
  currentCompany: string;
  yearsOfExperience: number;
  aiMatchScore: number;
  hasResume: boolean;
  resumeUpdatedAt: string | null;
  skills: string[];
  latestInterviewStatus: string | null;
  upcomingInterviewAt: string | null;
  latestOfferStatus: string | null;
  nextAction: string;
}

export interface UpcomingInterviewItem {
  id: string;
  candidateName: string | null;
  jobTitle: string | null;
  interviewerName: string | null;
  scheduledAt: string;
  interviewType: string;
  status: string;
}

export interface OfferTrackerItem {
  id: string;
  candidateName: string | null;
  jobTitle: string | null;
  salaryOffered: number;
  status: string;
  offeredAt: string | null;
  acceptedAt: string | null;
  approverName: string | null;
  ageDays: number;
}

export interface ResumeActivityItem {
  id: string;
  candidateId: string;
  candidateName: string | null;
  jobTitle: string | null;
  fileName: string;
  uploadedAt: string;
  parsedSkills: string[];
  summary: string;
}

export interface HiringAlertItem {
  id: string;
  level: 'high' | 'medium' | 'low' | string;
  title: string;
  description: string;
}

export interface RecruitmentDashboardPayload {
  stats: RecruitmentDashboardStats;
  funnel: RecruitmentFunnelItem[];
  sourceBreakdown: RecruitmentSourceItem[];
  openJobHealth: RecruitmentJobHealthItem[];
  priorityCandidates: PriorityCandidateItem[];
  upcomingInterviews: UpcomingInterviewItem[];
  offerTracker: OfferTrackerItem[];
  latestResumeActivity: ResumeActivityItem[];
  hiringAlerts: HiringAlertItem[];
}

export interface PublicJobPostingItem {
  id: string;
  title: string;
  employmentType: string;
  location: string;
  description: string;
  requirements: string;
  targetCount: number;
  publishedAt: string | null;
  department: {
    name: string;
    code: string;
  } | null;
  position: {
    name: string;
    code: string;
    level: string;
  } | null;
}

export interface CandidatePortalResumeItem {
  id: string;
  fileName: string;
  filePath: string;
  uploadedAt: string;
  parsedText?: string;
  parsedProfile: Record<string, unknown>;
}

export interface CandidatePortalInterviewItem {
  id: string;
  scheduledAt: string;
  interviewType: string;
  status: string;
  score: number;
  feedback: string;
  interviewerName: string | null;
  jobTitle: string | null;
}

export interface CandidatePortalOfferItem {
  id: string;
  status: string;
  salaryOffered: number;
  offeredAt: string | null;
  acceptedAt: string | null;
  notes: string;
  jobTitle: string | null;
  approverName: string | null;
}

export interface CandidatePortalProfilePayload {
  candidate: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    stage: string;
    status: string;
    source: string;
    currentCompany: string;
    yearsOfExperience: number;
    skills: string[];
    aiMatchScore: number;
    appliedJobPosting: {
      id: string;
      title: string;
      location: string;
      employmentType: string;
      status: string;
    } | null;
  };
  resumes: CandidatePortalResumeItem[];
  interviews: CandidatePortalInterviewItem[];
  offers: CandidatePortalOfferItem[];
  jobMatches: CandidateJobMatchItem[];
}

export interface CandidateJobMatchItem extends PublicJobPostingItem {
  matchScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  matchedRequirements: string[];
  missingRequirements: string[];
  resumeHighlights: string[];
  suggestions: string[];
  analysis: string;
  isApplied: boolean;
}

export interface CandidateResumeUploadResponse {
  resume: CandidatePortalResumeItem;
  analysis: Record<string, unknown>;
  jobMatches: CandidateJobMatchItem[];
}

export interface CandidatePortalChatResponse {
  reply: string;
  references: Array<{
    id: string;
    title: string;
    category: string;
    sourceType: string;
    excerpt?: string;
  }>;
}

export interface ResumeListItem {
  id: string;
  fileName: string;
  filePath: string;
  parsedText: string;
  parsedProfile: Record<string, unknown>;
  uploadedAt: string;
  candidate: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface CandidateRegisterPayload {
  username: string;
  email: string;
  fullName: string;
  password: string;
  phone: string;
  currentCompany?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface CareerApplicationPayload {
  jobPostingId: string;
  fullName: string;
  email: string;
  phone: string;
  currentCompany?: string;
  yearsOfExperience?: number;
  skills?: string[];
  notes?: string;
}

export function getRecruitmentDashboard() {
  return apiRequest<RecruitmentDashboardPayload>('/recruitment/dashboard');
}

export function listPublicJobPostings(params?: { page?: number; limit?: number; search?: string }) {
  return apiRequest<PaginatedResponse<PublicJobPostingItem>>(`/career/job-postings${toQueryString(params ?? {})}`);
}

export function registerCandidate(payload: CandidateRegisterPayload) {
  return apiRequest<LoginResponse>('/auth/candidate-register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitCareerApplication(payload: CareerApplicationPayload, file: File) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value));
      return;
    }

    formData.append(key, String(value));
  });
  formData.append('file', file);

  return apiRequest<{
    candidate: Record<string, unknown>;
    resume: Record<string, unknown>;
    jobPosting: Record<string, unknown>;
  }>('/career/applications', {
    method: 'POST',
    body: formData,
  });
}

export function getCandidatePortalProfile() {
  return apiRequest<CandidatePortalProfilePayload>('/career/me');
}

export function uploadCandidatePortalResume(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return apiRequest<CandidateResumeUploadResponse>('/career/me/resumes', {
    method: 'POST',
    body: formData,
  });
}

export function listCandidatePortalJobMatches() {
  return apiRequest<CandidateJobMatchItem[]>('/career/me/job-matches');
}

export function applyCandidatePortalJob(jobPostingId: string) {
  return apiRequest<{ success: boolean; jobPosting: Pick<PublicJobPostingItem, 'id' | 'title' | 'location' | 'employmentType'> }>(
    `/career/me/applications/${jobPostingId}`,
    {
      method: 'POST',
    },
  );
}

export function candidatePortalChat(message: string) {
  return apiRequest<CandidatePortalChatResponse>('/career/me/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export function listResumes(params?: { page?: number; limit?: number; search?: string; candidateId?: string }) {
  return apiRequest<PaginatedResponse<ResumeListItem>>(`/resumes${toQueryString(params ?? {})}`);
}

export function analyzeResumeRecord(resumeId: string) {
  return apiRequest<Record<string, unknown>>(`/resumes/${resumeId}/analyze`, {
    method: 'POST',
  });
}

export function getResumeDownloadUrl(resumeId: string, own = false) {
  return own ? `/api/career/resumes/${resumeId}/download` : `/api/resumes/${resumeId}/download`;
}
