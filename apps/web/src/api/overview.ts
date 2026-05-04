import { apiRequest } from './http';

export interface OverviewMetric {
  key: string;
  label: string;
  value: string | number;
  helper: string;
}

export interface OverviewQuickLink {
  label: string;
  path: string;
  description: string;
}

export interface OverviewKnowledgeItem {
  id: string;
  title: string;
  category: string;
  summary: string;
  tags: string[];
}

export interface ManagementDashboardPayload {
  scope: 'management';
  generatedAt: string;
  headline: {
    title: string;
    subtitle: string;
  };
  metrics: OverviewMetric[];
  briefing: {
    headline: string;
    highlights: string[];
    recommendedActions: string[];
  };
  actionCenter: {
    healthScore: number;
    healthLevel: string;
    candidateCoverage: number;
    totalOpenSignals: number;
    executiveSummary: string[];
    focusAreas: Array<{
      key: string;
      title: string;
      level: string;
      score: number;
      signal: string;
      action: string;
      path: string;
    }>;
    workloadByDepartment: Array<{
      id: string;
      departmentName: string;
      score: number;
      level: string;
      headcount: number;
      signals: string[];
      nextAction: string;
    }>;
    automationQueue: Array<{
      id: string;
      title: string;
      category: string;
      level: string;
      reason: string;
      action: string;
      path: string;
    }>;
  };
  dataQuality: {
    overallCompletion: number;
    issues: Array<{
      key: string;
      label: string;
      count: number;
    }>;
  };
  peopleStructure: {
    departmentHeadcount: Array<{
      id: string;
      name: string;
      headcount: number;
      openJobs: number;
      activeCandidates: number;
      pendingChanges: number;
      averageMatchScore: number;
    }>;
    employmentStatus: Array<{
      label: string;
      value: number;
    }>;
    recentJoiners: Array<{
      id: string;
      employeeName: string;
      departmentName: string;
      positionName: string;
      joinDate: string;
      employmentStatus: string;
    }>;
  };
  operations: {
    pendingApprovals: Array<{
      id: string;
      category: string;
      priority: string;
      title: string;
      description: string;
      createdAt: string;
      path: string;
    }>;
    attendanceAlerts: Array<{
      id: string;
      employeeName: string;
      workDate: string;
      status: string;
      lateMinutes: number;
      undertimeMinutes: number;
      anomalyReason: string;
    }>;
    upcomingMilestones: Array<{
      id: string;
      type: string;
      level: string;
      title: string;
      description: string;
      dueAt: string;
      path: string;
    }>;
  };
  recruitment: {
    stats: {
      openJobPostings: number;
      activeCandidates: number;
      interviewsThisWeek: number;
      pendingOffers: number;
      acceptedOffers: number;
      resumeCoverage: number;
      averageAiMatchScore: number;
    };
    alerts: Array<{
      id: string;
      level: string;
      title: string;
      description: string;
    }>;
    funnel: Array<{
      stage: string;
      label: string;
      count: number;
    }>;
    sourceBreakdown: Array<{
      source: string;
      count: number;
    }>;
    openJobHealth: Array<{
      id: string;
      title: string;
      departmentName: string | null;
      candidateCount: number;
      progressPercent: number;
      averageMatchScore: number;
      urgencyLevel: string;
    }>;
    priorityCandidates: Array<{
      id: string;
      fullName: string;
      jobTitle: string | null;
      stage: string;
      aiMatchScore: number;
      nextAction: string;
      skills: string[];
    }>;
    upcomingInterviews: Array<{
      id: string;
      candidateName: string | null;
      jobTitle: string | null;
      interviewerName: string | null;
      scheduledAt: string;
      interviewType: string;
      status: string;
    }>;
  };
  performance: {
    activeCycleName: string | null;
    averageScore: number;
    topPerformers: Array<{
      employee?: string;
      score?: number;
    }>;
    needsAttention: Array<{
      employeeName: string;
      score: number;
    }>;
  };
  riskRadar: {
    highRiskEmployees: Array<{
      employeeName: string;
      department: string;
      riskScore: number;
      recommendation: string;
    }>;
    contractsExpiringSoon: Array<{
      id: string;
      employeeName: string;
      departmentName: string;
      endDate: string;
      daysToExpire: number;
      contractNo: string;
    }>;
    probationEndingSoon: Array<{
      id: string;
      employeeName: string;
      departmentName: string;
      probationEndDate: string;
      daysToProbationEnd: number;
    }>;
    attendanceAnomalies30Days: number;
  };
  knowledgeHighlights: OverviewKnowledgeItem[];
  quickLinks: OverviewQuickLink[];
  suggestedQuestions: string[];
  summary: {
    managers: number;
    contractsExpiringSoon: number;
    publishedPayslipsThisMonth: number;
    performanceReviewsTracked: number;
  };
}

export interface EmployeeDashboardPayload {
  scope: 'employee';
  generatedAt: string;
  headline: {
    title: string;
    subtitle: string;
  };
  metrics: OverviewMetric[];
  employeeSnapshot: {
    fullName: string;
    departmentName: string;
    positionName: string;
    managerName: string;
    joinDate: string | null;
    tenureDays: number;
  };
  reminders: Array<{
    id: string;
    priority: string;
    title: string;
    description: string;
  }>;
  leaveBalances: Array<{
    id: string;
    leaveType: string;
    remainingDays: number;
    usedDays: number;
    year: number;
  }>;
  approvalTimeline: Array<{
    id: string;
    category: string;
    status: string;
    title: string;
    detail: string;
    submittedAt: string;
    completedAt: string | null;
  }>;
  knowledgeHighlights: OverviewKnowledgeItem[];
  quickLinks: OverviewQuickLink[];
  suggestedQuestions: string[];
}

export type OverviewDashboardPayload = ManagementDashboardPayload | EmployeeDashboardPayload;

export function getOverviewDashboard() {
  return apiRequest<OverviewDashboardPayload>('/overview/dashboard');
}
