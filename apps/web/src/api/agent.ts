import { apiRequest } from './http';

export interface AgentRunTrace {
  mode: 'llm' | 'fallback' | 'grounded';
  provider: 'mock' | 'openai' | 'deepseek' | 'local' | string;
  model: string;
  toolNames: string[];
  latencyMs: number;
  generatedAt: string;
  fallbackReason?: string;
  errorMessage?: string;
}

export interface AgentRunLog {
  id: string;
  companyId: string;
  userId: string | null;
  employeeId: string | null;
  agentType: string;
  action: string;
  mode: string;
  provider: string;
  model: string;
  fallbackReason: string | null;
  latencyMs: number;
  toolNames: string[];
  subjectType: string;
  subjectId: string | null;
  summary: string;
  errorMessage: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRunSummary {
  total: number;
  fallbackCount: number;
  fallbackRate: number;
  averageLatencyMs: number;
  byMode: Record<string, number>;
  byProvider: Record<string, number>;
  byAgentType: Record<string, number>;
}

export interface AgentReference {
  id: string;
  title: string;
  category: string;
  sourceType: 'knowledge_base' | 'document' | string;
  excerpt?: string;
  sourcePath?: string;
  section?: string;
}

export interface KnowledgeBaseArticle {
  id: string;
  category: string;
  title: string;
  question: string;
  answer: string;
  tags: string[];
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeSourceArticleSummary {
  id: string;
  title: string;
  category: string;
  sourceType: 'knowledge_base';
}

export interface KnowledgeDocumentSource {
  title: string;
  sourcePath: string;
  category: string;
  status: 'draft' | 'review' | 'published' | 'archived' | string;
  version: string;
  owner: string;
  effectiveDate: string | null;
  tags: string[];
  updatedAt: string;
}

export interface ManagedKnowledgeDocument extends KnowledgeDocumentSource {
  id: string;
  scope: 'docs/policies/managed' | 'docs/company/managed';
  reviewNotes: string;
  reviewer: string;
  submittedAt: string | null;
  approvedBy: string;
  approvedAt: string | null;
  approvalComment: string;
  lastPublishedAt: string | null;
  body?: string;
  markdownBody?: string;
}

export interface DocumentImportPreview {
  sourceFileName: string;
  detectedTitle: string;
  suggestedSlug: string;
  suggestedScope: 'docs/policies/managed' | 'docs/company/managed';
  suggestedCategory: 'policy_document' | 'company_profile' | 'general_document';
  cleanedMarkdown: string;
  warnings: string[];
}

export interface ManagedKnowledgeDocumentPayload {
  category: string;
  scope: 'docs/policies/managed' | 'docs/company/managed';
  title: string;
  slug?: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  version: string;
  owner?: string;
  reviewer?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  approvalComment?: string;
  effectiveDate?: string;
  reviewNotes?: string;
  tags?: string[];
  body: string;
}

export interface ManagedDocumentHistoryItem {
  id: string;
  sourcePath: string;
  snapshotPath: string;
  title: string;
  version: string;
  status: 'draft' | 'review' | 'published' | 'archived' | string;
  owner: string;
  savedAt: string;
}

export interface ManagedDocumentDiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'changed';
  previous: string;
  current: string;
}

export interface ManagedDocumentDiffResult {
  current: {
    id: string;
    title: string;
    version: string;
    status: string;
    updatedAt: string;
    body: string;
  };
  history: {
    id: string;
    title: string;
    version: string;
    status: string;
    body: string;
  };
  diff: ManagedDocumentDiffLine[];
}

export interface DocumentSearchDiagnosticsResult {
  query: string;
  resultCount: number;
  results: AgentReference[];
}

export interface CompanyFactItem {
  id: string;
  category: string;
  label: string;
  value: string;
  description: string;
  source: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived' | string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function employeeServiceChat(message: string) {
  return apiRequest<{
    reply: string;
    references: AgentReference[];
    aiTrace?: AgentRunTrace;
  }>('/agent/employee-service/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export function listAgentRuns(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });

  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest<{ items: AgentRunLog[]; summary: AgentRunSummary }>(`/agent/runs${suffix}`);
}

export function getKnowledgeBase() {
  return apiRequest<KnowledgeBaseArticle[]>('/agent/employee-service/knowledge-base');
}

export function getKnowledgeSources() {
  return apiRequest<{
    articles: KnowledgeSourceArticleSummary[];
    documents: KnowledgeDocumentSource[];
    companyFacts: CompanyFactItem[];
  }>('/agent/employee-service/knowledge-sources');
}

export function listKnowledgeArticles(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });

  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest<{
    items: KnowledgeBaseArticle[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }>(`/knowledge-management/articles${suffix}`);
}

export function createKnowledgeArticle(payload: Omit<KnowledgeBaseArticle, 'id'>) {
  return apiRequest<KnowledgeBaseArticle>('/knowledge-management/articles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateKnowledgeArticle(id: string, payload: Partial<Omit<KnowledgeBaseArticle, 'id'>>) {
  return apiRequest<KnowledgeBaseArticle>(`/knowledge-management/articles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function removeKnowledgeArticle(id: string) {
  return apiRequest<{ success: boolean }>(`/knowledge-management/articles/${id}`, {
    method: 'DELETE',
  });
}

export function listManagedKnowledgeDocuments(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value);
    }
  });

  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest<ManagedKnowledgeDocument[]>(`/knowledge-management/documents${suffix}`);
}

export function getManagedKnowledgeDocument(id: string) {
  return apiRequest<ManagedKnowledgeDocument>(`/knowledge-management/documents/${encodeURIComponent(id)}`);
}

export function createManagedKnowledgeDocument(payload: ManagedKnowledgeDocumentPayload) {
  return apiRequest<ManagedKnowledgeDocument>('/knowledge-management/documents', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateManagedKnowledgeDocument(id: string, payload: ManagedKnowledgeDocumentPayload) {
  return apiRequest<ManagedKnowledgeDocument>(`/knowledge-management/documents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function removeManagedKnowledgeDocument(id: string) {
  return apiRequest<{ success: boolean }>(`/knowledge-management/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function previewKnowledgeDocumentImport(file: File) {
  const form = new FormData();
  form.append('file', file);

  return apiRequest<DocumentImportPreview>('/knowledge-management/document-imports/preview', {
    method: 'POST',
    body: form,
  });
}

export function previewKnowledgeDocumentImports(files: File[]) {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));

  return apiRequest<DocumentImportPreview[]>('/knowledge-management/document-imports/batch-preview', {
    method: 'POST',
    body: form,
  });
}

export function createManagedKnowledgeDocumentsBatch(payload: { items: ManagedKnowledgeDocumentPayload[] }) {
  return apiRequest<ManagedKnowledgeDocument[]>('/knowledge-management/document-imports/batch-commit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getManagedKnowledgeDocumentHistory(id: string) {
  return apiRequest<ManagedDocumentHistoryItem[]>(`/knowledge-management/documents/${encodeURIComponent(id)}/history`);
}

export function getManagedKnowledgeDocumentDiff(id: string, historyId: string) {
  return apiRequest<ManagedDocumentDiffResult>(
    `/knowledge-management/documents/${encodeURIComponent(id)}/diff?historyId=${encodeURIComponent(historyId)}`,
  );
}

export function runDocumentSearchDiagnostics(query: string) {
  return apiRequest<DocumentSearchDiagnosticsResult>(
    `/knowledge-management/diagnostics/document-search?query=${encodeURIComponent(query)}`,
  );
}

export function listCompanyFacts(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value);
    }
  });

  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest<CompanyFactItem[]>(`/knowledge-management/company-facts${suffix}`);
}

export function getCompanyFact(id: string) {
  return apiRequest<CompanyFactItem>(`/knowledge-management/company-facts/${id}`);
}

export function createCompanyFact(payload: Omit<CompanyFactItem, 'id' | 'createdAt' | 'updatedAt'>) {
  return apiRequest<CompanyFactItem>('/knowledge-management/company-facts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCompanyFact(id: string, payload: Omit<CompanyFactItem, 'id' | 'createdAt' | 'updatedAt'>) {
  return apiRequest<CompanyFactItem>(`/knowledge-management/company-facts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function removeCompanyFact(id: string) {
  return apiRequest<{ success: boolean }>(`/knowledge-management/company-facts/${id}`, {
    method: 'DELETE',
  });
}

export function parseResume(payload: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>('/agent/recruitment/parse-resume', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function matchScore(payload: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>('/agent/recruitment/match-score', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function generateInterviewEmail(payload: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>('/agent/recruitment/generate-interview-email', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function analyzePerformance(payload: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>('/agent/performance/analyze', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getPerformanceInsights() {
  return apiRequest<Record<string, unknown>>('/agent/performance/insights');
}

export function predictAttrition(employeeId?: string) {
  const suffix = employeeId ? `?employeeId=${employeeId}` : '';
  return apiRequest<Record<string, unknown> | Array<Record<string, unknown>>>(`/agent/attrition/predict${suffix}`);
}

export function getHighRiskAttritionList() {
  return apiRequest<Array<Record<string, unknown>>>('/agent/attrition/high-risk-list');
}

// --- Proactive AI ---

export interface ProactiveInsightPayload {
  type: string;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  details: Record<string, unknown>;
  generatedAt: string;
}

export function getProactiveCheck() {
  return apiRequest<{ insights: ProactiveInsightPayload[] }>('/agent/proactive/check');
}

// --- Pulse Survey ---

export interface PulseSurveyQuestion {
  id: string;
  type: 'rating' | 'choice' | 'text';
  text: string;
  required?: boolean;
  options?: string[];
  minLabel?: string;
  maxLabel?: string;
}

export interface PulseSurvey {
  id: string;
  title: string;
  description: string;
  category: string;
  periodType: string;
  startDate: string;
  endDate: string;
  status: string;
  questions: PulseSurveyQuestion[];
}

export interface PulseSurveyResultsPayload {
  periodStart: string;
  periodEnd: string;
  totalResponses: number;
  sentimentDistribution: { positive: number; neutral: number; negative: number; mixed: number };
  averageSentimentScore: number;
  departmentHeatmap: Array<{
    departmentName: string;
    avgSentiment: number;
    responseCount: number;
    topKeywords: string[];
  }>;
  questionAverages: Array<{
    questionId: string;
    questionText: string;
    type: string;
    average?: number;
    distribution?: Record<string, number>;
  }>;
  topKeywords: Array<{ keyword: string; count: number }>;
}

export function getActivePulseSurvey() {
  return apiRequest<PulseSurvey | null>('/agent/employee-service/pulse-survey');
}

export function submitPulseSurveyResponse(payload: { surveyId: string; answers: Record<string, unknown> }) {
  return apiRequest<{ success: boolean }>('/agent/employee-service/pulse-survey/respond', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getPulseSurveyResults(period = '30d') {
  return apiRequest<PulseSurveyResultsPayload>(`/agent/pulse-survey/results?period=${encodeURIComponent(period)}`);
}
