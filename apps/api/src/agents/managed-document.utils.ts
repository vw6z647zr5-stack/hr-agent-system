export const MANAGED_DOCUMENT_SCOPES = ['docs/policies/managed', 'docs/company/managed'] as const;
export const MANAGED_DOCUMENT_STATUSES = ['draft', 'review', 'published', 'archived'] as const;
export const MANAGED_DOCUMENT_CATEGORIES = ['policy_document', 'company_profile', 'general_document'] as const;

export type ManagedDocumentScope = (typeof MANAGED_DOCUMENT_SCOPES)[number];
export type ManagedDocumentStatus = (typeof MANAGED_DOCUMENT_STATUSES)[number];

export interface ManagedDocumentMetadata {
  title: string;
  category: string;
  scope: ManagedDocumentScope;
  status: ManagedDocumentStatus;
  version: string;
  owner: string;
  reviewer: string;
  submittedAt: string | null;
  approvedBy: string;
  approvedAt: string | null;
  approvalComment: string;
  effectiveDate: string | null;
  reviewNotes: string;
  tags: string[];
  lastPublishedAt: string | null;
}

export interface ParsedManagedDocument {
  metadata: ManagedDocumentMetadata;
  markdownBody: string;
  editableBody: string;
}

type FrontmatterResult = {
  hasFrontmatter: boolean;
  fields: Record<string, string>;
  body: string;
};

export function isManagedDocumentPath(sourcePath: string) {
  return (
    !sourcePath.split('/').some((segment) => segment === '..') &&
    MANAGED_DOCUMENT_SCOPES.some((scope) => sourcePath.startsWith(`${scope}/`))
  );
}

export function inferManagedDocumentScope(sourcePath: string): ManagedDocumentScope {
  return sourcePath.startsWith('docs/policies/managed/') ? 'docs/policies/managed' : 'docs/company/managed';
}

export function inferManagedDocumentCategory(sourcePath: string) {
  if (sourcePath.startsWith('docs/policies/')) {
    return 'policy_document';
  }

  if (sourcePath.startsWith('docs/company/')) {
    return 'company_profile';
  }

  return 'general_document';
}

export function normalizeManagedDocumentStatus(
  value?: string,
  fallback: ManagedDocumentStatus = 'draft',
): ManagedDocumentStatus {
  return MANAGED_DOCUMENT_STATUSES.includes(value as ManagedDocumentStatus)
    ? (value as ManagedDocumentStatus)
    : fallback;
}

export function normalizeManagedDocumentCategory(value?: string, fallback = 'general_document') {
  return MANAGED_DOCUMENT_CATEGORIES.includes(value as (typeof MANAGED_DOCUMENT_CATEGORIES)[number]) ? value! : fallback;
}

export function parseManagedDocumentFile(
  sourcePath: string,
  rawContent: string,
  fallbackTitle: string,
): ParsedManagedDocument {
  const { fields, body } = readFrontmatter(rawContent);
  const markdownBody = body.trim();
  const title = sanitizeFrontmatterValue(fields.title) || extractMarkdownTitle(markdownBody) || fallbackTitle;

  return {
    metadata: {
      title,
      category: normalizeManagedDocumentCategory(fields.category, inferManagedDocumentCategory(sourcePath)),
      scope: inferManagedDocumentScope(sourcePath),
      status: normalizeManagedDocumentStatus(fields.status, 'published'),
      version: sanitizeFrontmatterValue(fields.version) || '1.0.0',
      owner: sanitizeFrontmatterValue(fields.owner),
      reviewer: sanitizeFrontmatterValue(fields.reviewer),
      submittedAt: normalizeIsoDateTime(fields.submittedAt),
      approvedBy: sanitizeFrontmatterValue(fields.approvedBy),
      approvedAt: normalizeIsoDateTime(fields.approvedAt),
      approvalComment: sanitizeFrontmatterValue(fields.approvalComment),
      effectiveDate: normalizeIsoDate(fields.effectiveDate),
      reviewNotes: sanitizeFrontmatterValue(fields.reviewNotes),
      tags: parseFrontmatterTags(fields.tags),
      lastPublishedAt: normalizeIsoDateTime(fields.lastPublishedAt),
    },
    markdownBody,
    editableBody: stripLeadingMarkdownTitle(markdownBody).trim(),
  };
}

export function buildManagedDocumentFile(metadata: ManagedDocumentMetadata, body: string) {
  const cleanedBody = stripLeadingMarkdownTitle(readFrontmatter(body).body).trim();
  const frontmatterLines = [
    '---',
    `title: ${sanitizeFrontmatterValue(metadata.title)}`,
    `category: ${normalizeManagedDocumentCategory(metadata.category, inferManagedDocumentCategory(metadata.scope))}`,
    `scope: ${metadata.scope}`,
    `status: ${normalizeManagedDocumentStatus(metadata.status)}`,
    `version: ${sanitizeFrontmatterValue(metadata.version) || '1.0.0'}`,
    `owner: ${sanitizeFrontmatterValue(metadata.owner)}`,
    `reviewer: ${sanitizeFrontmatterValue(metadata.reviewer)}`,
    `submittedAt: ${metadata.submittedAt ?? ''}`,
    `approvedBy: ${sanitizeFrontmatterValue(metadata.approvedBy)}`,
    `approvedAt: ${metadata.approvedAt ?? ''}`,
    `approvalComment: ${sanitizeFrontmatterValue(metadata.approvalComment)}`,
    `effectiveDate: ${metadata.effectiveDate ?? ''}`,
    `tags: ${metadata.tags.join(', ')}`,
    `reviewNotes: ${sanitizeFrontmatterValue(metadata.reviewNotes)}`,
    `lastPublishedAt: ${metadata.lastPublishedAt ?? ''}`,
    '---',
    '',
    `# ${metadata.title.trim()}`,
  ];

  if (!cleanedBody) {
    return `${frontmatterLines.join('\n')}\n`;
  }

  return `${frontmatterLines.join('\n')}\n\n${cleanedBody}\n`;
}

export function extractMarkdownTitle(content: string) {
  const firstHeading = content.split(/\r?\n/).find((line) => /^#\s+/.test(line));
  return firstHeading ? firstHeading.replace(/^#\s+/, '').trim() : '';
}

export function stripLeadingMarkdownTitle(content: string) {
  return content.replace(/^#\s+.+?(?:\r?\n){1,2}/, '');
}

export function normalizeManagedDocumentSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-\u4e00-\u9fff]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function readFrontmatter(content: string): FrontmatterResult {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return { hasFrontmatter: false, fields: {}, body: content };
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closingIndex === -1) {
    return { hasFrontmatter: false, fields: {}, body: content };
  }

  const fields: Record<string, string> = {};
  for (const line of lines.slice(1, closingIndex)) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) {
      fields[key] = value;
    }
  }

  return {
    hasFrontmatter: true,
    fields,
    body: lines.slice(closingIndex + 1).join('\n'),
  };
}

function sanitizeFrontmatterValue(value?: string | null) {
  return String(value ?? '')
    .replace(/\r?\n+/g, ' ')
    .trim();
}

function parseFrontmatterTags(value?: string) {
  return sanitizeFrontmatterValue(value)
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeIsoDate(value?: string) {
  const normalized = sanitizeFrontmatterValue(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normalizeIsoDateTime(value?: string) {
  const normalized = sanitizeFrontmatterValue(value);
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
