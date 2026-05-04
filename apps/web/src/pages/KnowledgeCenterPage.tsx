import {
  BookOutlined,
  DeleteOutlined,
  EditOutlined,
  FileAddOutlined,
  ImportOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  message,
  Popconfirm,
  Segmented,
  Select,
  Spin,
  Statistic,
  Switch,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  createCompanyFact,
  createKnowledgeArticle,
  createManagedKnowledgeDocument,
  createManagedKnowledgeDocumentsBatch,
  getCompanyFact,
  getManagedKnowledgeDocumentDiff,
  getManagedKnowledgeDocumentHistory,
  getKnowledgeBase,
  getKnowledgeSources,
  getManagedKnowledgeDocument,
  listCompanyFacts,
  listKnowledgeArticles,
  listManagedKnowledgeDocuments,
  previewKnowledgeDocumentImport,
  previewKnowledgeDocumentImports,
  removeCompanyFact,
  removeKnowledgeArticle,
  removeManagedKnowledgeDocument,
  runDocumentSearchDiagnostics,
  updateCompanyFact,
  updateKnowledgeArticle,
  updateManagedKnowledgeDocument,
  type CompanyFactItem,
  type DocumentSearchDiagnosticsResult,
  type DocumentImportPreview,
  type KnowledgeBaseArticle,
  type KnowledgeDocumentSource,
  type ManagedKnowledgeDocument,
  type ManagedDocumentDiffResult,
  type ManagedDocumentHistoryItem,
  type ManagedKnowledgeDocumentPayload,
} from '../api/agent';
import { authStore } from '../state/auth.store';
import { formatDisplayValue } from '../utils/display';

type KnowledgeFilter = 'all' | 'kb' | 'doc' | 'fact';
type ManagementTab = 'articles' | 'documents' | 'facts';
type BatchImportItem = DocumentImportPreview &
  ManagedKnowledgeDocumentPayload & {
    key: string;
  };

function parseTagInput(value: string) {
  return String(value || '')
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinTagInput(tags?: string[]) {
  return (tags ?? []).join('，');
}

function buildDocumentFormDefaults(displayName?: string) {
  return {
    title: '',
    scope: 'docs/policies/managed' as const,
    category: 'policy_document',
    slug: '',
    status: 'draft' as const,
    version: '1.0.0',
    owner: displayName ?? '',
    reviewer: '',
    approvedBy: '',
    approvalComment: '',
    effectiveDate: '',
    reviewNotes: '',
    tags: '',
    body: '',
  };
}

const suggestedQuestions = [
  '公司的办公时间、办公地点和混合办公规则是什么？',
  '员工请假、调休和加班审批分别怎么走？',
  '试用期、转正和劳动合同续签有哪些节点？',
  '工资单何时发放，员工通过哪里查看或下载？',
];

const articleCategoryOptions = [
  'company',
  'policy',
  'leave',
  'attendance',
  'overtime',
  'benefits',
  'payroll',
  'probation',
  'security',
  'organization',
  'office',
];

const documentScopeOptions = [
  { label: '制度池', value: 'docs/policies/managed', category: 'policy_document' },
  { label: '公司资料池', value: 'docs/company/managed', category: 'company_profile' },
];

const documentStatusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '待复核', value: 'review' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
];

const companyFactCategoryOptions = [
  'company_overview',
  'office',
  'schedule',
  'benefits',
  'organization',
  'operations',
  'security',
  'support',
];

const companyFactStatusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
];

function getDocumentStatusColor(status: string) {
  if (status === 'published') {
    return 'green';
  }

  if (status === 'review') {
    return 'gold';
  }

  if (status === 'archived') {
    return 'default';
  }

  return 'cyan';
}

export function KnowledgeCenterPage() {
  const user = authStore((state) => state.user);
  const canManage = user?.role === 'admin' || user?.role === 'hr';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocumentSource[]>([]);
  const [managedDocuments, setManagedDocuments] = useState<ManagedKnowledgeDocument[]>([]);
  const [companyFacts, setCompanyFacts] = useState<CompanyFactItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<KnowledgeFilter>('all');
  const [managementTab, setManagementTab] = useState<ManagementTab>('articles');
  const [editingArticle, setEditingArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [editingDocument, setEditingDocument] = useState<ManagedKnowledgeDocument | null>(null);
  const [editingFact, setEditingFact] = useState<CompanyFactItem | null>(null);
  const [importPreview, setImportPreview] = useState<DocumentImportPreview | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [historyDocument, setHistoryDocument] = useState<ManagedKnowledgeDocument | null>(null);
  const [documentHistory, setDocumentHistory] = useState<ManagedDocumentHistoryItem[]>([]);
  const [documentDiff, setDocumentDiff] = useState<ManagedDocumentDiffResult | null>(null);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [diagnosticsQuery, setDiagnosticsQuery] = useState('');
  const [diagnosticsResult, setDiagnosticsResult] = useState<DocumentSearchDiagnosticsResult | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [articleDrawerOpen, setArticleDrawerOpen] = useState(false);
  const [documentDrawerOpen, setDocumentDrawerOpen] = useState(false);
  const [factDrawerOpen, setFactDrawerOpen] = useState(false);
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [batchImportDrawerOpen, setBatchImportDrawerOpen] = useState(false);
  const [batchImportFiles, setBatchImportFiles] = useState<File[]>([]);
  const [batchImportItems, setBatchImportItems] = useState<BatchImportItem[]>([]);
  const [articleForm] = Form.useForm();
  const [documentForm] = Form.useForm();
  const [factForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [knowledgeBase, knowledgeSources, managedArticleResponse, managedDocumentResponse, companyFactResponse] = await Promise.all([
        getKnowledgeBase(),
        getKnowledgeSources(),
        canManage ? listKnowledgeArticles({ page: 1, limit: 100 }) : Promise.resolve(null),
        canManage ? listManagedKnowledgeDocuments({}) : Promise.resolve([]),
        canManage ? listCompanyFacts({}) : Promise.resolve([]),
      ]);

      setArticles(canManage && managedArticleResponse ? managedArticleResponse.items : knowledgeBase);
      setDocuments(knowledgeSources.documents);
      setManagedDocuments(Array.isArray(managedDocumentResponse) ? managedDocumentResponse : []);
      setCompanyFacts(canManage ? (Array.isArray(companyFactResponse) ? companyFactResponse : []) : knowledgeSources.companyFacts);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [canManage]);

  const normalizedKeyword = keyword.trim().toLowerCase();

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      if (!normalizedKeyword) {
        return true;
      }

      const haystack = [
        article.title,
        article.question,
        article.answer,
        ...(article.tags ?? []),
        article.category,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedKeyword);
    });
  }, [articles, normalizedKeyword]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((document) => {
      if (!normalizedKeyword) {
        return true;
      }

      return [
        document.title,
        document.sourcePath,
        document.category,
        document.status,
        document.version,
        document.owner,
        ...(document.tags ?? []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword);
    });
  }, [documents, normalizedKeyword]);

  const filteredManagedDocuments = useMemo(() => {
    return managedDocuments.filter((document) => {
      if (!normalizedKeyword) {
        return true;
      }

      return [
        document.title,
        document.sourcePath,
        document.category,
        document.status,
        document.version,
        document.owner,
        document.reviewer,
        document.approvedBy,
        document.approvalComment,
        ...(document.tags ?? []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword);
    });
  }, [managedDocuments, normalizedKeyword]);

  const filteredCompanyFacts = useMemo(() => {
    return companyFacts.filter((fact) => {
      if (!normalizedKeyword) {
        return true;
      }

      return [fact.label, fact.value, fact.description, fact.source, fact.category, fact.status, ...fact.tags]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword);
    });
  }, [companyFacts, normalizedKeyword]);

  const articleCategoryStats = useMemo(() => {
    const counts = new Map<string, number>();

    for (const article of articles) {
      counts.set(article.category, (counts.get(article.category) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
  }, [articles]);

  const documentCategoryStats = useMemo(() => {
    const counts = new Map<string, number>();

    for (const document of documents) {
      counts.set(document.category, (counts.get(document.category) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
  }, [documents]);

  const topQuestionTags = useMemo(() => {
    const counts = new Map<string, number>();

    for (const article of articles) {
      for (const tag of article.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
      .slice(0, 8);
  }, [articles]);

  const openCreateArticle = () => {
    setEditingArticle(null);
    articleForm.setFieldsValue({
      category: 'policy',
      title: '',
      question: '',
      answer: '',
      tags: '',
      isPublished: true,
    });
    setArticleDrawerOpen(true);
  };

  const openEditArticle = (article: KnowledgeBaseArticle) => {
    setEditingArticle(article);
    articleForm.setFieldsValue({
      category: article.category,
      title: article.title,
      question: article.question,
      answer: article.answer,
      tags: (article.tags ?? []).join('，'),
      isPublished: article.isPublished,
    });
    setArticleDrawerOpen(true);
  };

  const openCreateDocument = () => {
    setEditingDocument(null);
    setImportPreview(null);
    setImportFileName('');
    documentForm.setFieldsValue(buildDocumentFormDefaults(user?.displayName));
    setDocumentDrawerOpen(true);
  };

  const openCreateFact = () => {
    setEditingFact(null);
    factForm.setFieldsValue({
      category: 'company_overview',
      label: '',
      value: '',
      description: '',
      source: '',
      tags: '',
      status: 'draft',
      sortOrder: companyFacts.length * 10 + 10,
    });
    setFactDrawerOpen(true);
  };

  const openImportDocument = () => {
    setImportPreview(null);
    setImportFileName('');
    setImportDrawerOpen(true);
  };

  const openBatchImportDocument = () => {
    setBatchImportFiles([]);
    setBatchImportItems([]);
    setBatchImportDrawerOpen(true);
  };

  const openEditDocument = async (document: ManagedKnowledgeDocument) => {
    try {
      setSubmitting(true);
      const detail = await getManagedKnowledgeDocument(document.id);
      setEditingDocument(detail);
      setImportPreview(null);
      setImportFileName('');
      documentForm.setFieldsValue({
        title: detail.title,
        scope: detail.scope,
        category: detail.category,
        slug: detail.sourcePath.split('/').pop()?.replace(/\.md$/i, '') ?? '',
        status: detail.status,
        version: detail.version,
        owner: detail.owner,
        reviewer: detail.reviewer,
        approvedBy: detail.approvedBy,
        approvalComment: detail.approvalComment,
        effectiveDate: detail.effectiveDate ?? '',
        reviewNotes: detail.reviewNotes,
        tags: joinTagInput(detail.tags),
        body: detail.body ?? '',
      });
      setDocumentDrawerOpen(true);
    } catch (editError) {
      void messageApi.error((editError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditFact = async (fact: CompanyFactItem) => {
    try {
      setSubmitting(true);
      const detail = await getCompanyFact(fact.id);
      setEditingFact(detail);
      factForm.setFieldsValue({
        category: detail.category,
        label: detail.label,
        value: detail.value,
        description: detail.description,
        source: detail.source,
        tags: (detail.tags ?? []).join('，'),
        status: detail.status,
        sortOrder: detail.sortOrder,
      });
      setFactDrawerOpen(true);
    } catch (editError) {
      void messageApi.error((editError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArticleSubmit = async () => {
    try {
      const values = await articleForm.validateFields();
      setSubmitting(true);

      const payload = {
        category: values.category,
        title: values.title.trim(),
        question: values.question.trim(),
        answer: values.answer.trim(),
        tags: String(values.tags || '')
          .split(/[，,]/)
          .map((item) => item.trim())
          .filter(Boolean),
        isPublished: Boolean(values.isPublished),
      };

      if (editingArticle) {
        await updateKnowledgeArticle(editingArticle.id, payload);
        void messageApi.success('知识库条目已更新。');
      } else {
        await createKnowledgeArticle(payload);
        void messageApi.success('知识库条目已创建。');
      }

      setArticleDrawerOpen(false);
      await loadData();
    } catch (submitError) {
      if ((submitError as { errorFields?: unknown[] }).errorFields) {
        return;
      }
      void messageApi.error((submitError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDocumentSubmit = async () => {
    try {
      const values = await documentForm.validateFields();
      setSubmitting(true);

      const payload: ManagedKnowledgeDocumentPayload = {
        title: values.title.trim(),
        scope: values.scope,
        category: values.category,
        slug: values.slug?.trim() || undefined,
        status: values.status,
        version: values.version.trim(),
        owner: values.owner?.trim() || undefined,
        reviewer: values.reviewer?.trim() || undefined,
        submittedAt: values.status === 'review' ? new Date().toISOString() : undefined,
        approvedBy:
          values.status === 'published'
            ? values.approvedBy?.trim() || values.owner?.trim() || user?.displayName || undefined
            : values.approvedBy?.trim() || undefined,
        approvedAt: values.status === 'published' ? new Date().toISOString() : undefined,
        approvalComment: values.approvalComment?.trim() || undefined,
        effectiveDate: values.effectiveDate?.trim() || undefined,
        reviewNotes: values.reviewNotes?.trim() || undefined,
        tags: parseTagInput(values.tags),
        body: values.body.trim(),
      };

      if (editingDocument) {
        await updateManagedKnowledgeDocument(editingDocument.id, payload);
        void messageApi.success('文档已更新。');
      } else {
        await createManagedKnowledgeDocument(payload);
        void messageApi.success('文档已创建。');
      }

      setDocumentDrawerOpen(false);
      await loadData();
    } catch (submitError) {
      if ((submitError as { errorFields?: unknown[] }).errorFields) {
        return;
      }
      void messageApi.error((submitError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveArticle = async (id: string) => {
    try {
      setSubmitting(true);
      await removeKnowledgeArticle(id);
      void messageApi.success('知识库条目已删除。');
      await loadData();
    } catch (removeError) {
      void messageApi.error((removeError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveDocument = async (id: string) => {
    try {
      setSubmitting(true);
      await removeManagedKnowledgeDocument(id);
      void messageApi.success('文档已删除。');
      await loadData();
    } catch (removeError) {
      void messageApi.error((removeError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFactSubmit = async () => {
    try {
      const values = await factForm.validateFields();
      setSubmitting(true);

      const payload = {
        category: values.category,
        label: values.label.trim(),
        value: values.value.trim(),
        description: values.description?.trim() || '',
        source: values.source?.trim() || '',
        tags: String(values.tags || '')
          .split(/[，,]/)
          .map((item) => item.trim())
          .filter(Boolean),
        status: values.status,
        sortOrder: Number(values.sortOrder || 0),
      };

      if (editingFact) {
        await updateCompanyFact(editingFact.id, payload);
        void messageApi.success('公司基础信息字段已更新。');
      } else {
        await createCompanyFact(payload);
        void messageApi.success('公司基础信息字段已创建。');
      }

      setFactDrawerOpen(false);
      await loadData();
    } catch (submitError) {
      if ((submitError as { errorFields?: unknown[] }).errorFields) {
        return;
      }
      void messageApi.error((submitError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveFact = async (id: string) => {
    try {
      setSubmitting(true);
      await removeCompanyFact(id);
      void messageApi.success('公司基础信息字段已删除。');
      await loadData();
    } catch (removeError) {
      void messageApi.error((removeError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportPreview = async (file: File) => {
    try {
      setSubmitting(true);
      const preview = await previewKnowledgeDocumentImport(file);
      setImportPreview(preview);
      setImportFileName(file.name);
      void messageApi.success('导入预览已生成。');
    } catch (previewError) {
      void messageApi.error((previewError as Error).message);
    } finally {
      setSubmitting(false);
    }

    return false;
  };

  const handleBatchImportPreview = async (files: File[]) => {
    if (!files.length) {
      setBatchImportFiles([]);
      setBatchImportItems([]);
      return false;
    }

    try {
      setSubmitting(true);
      const previews = await previewKnowledgeDocumentImports(files);
      setBatchImportFiles(files);
      setBatchImportItems(
        previews.map((preview, index) => ({
          key: `${preview.suggestedSlug}-${index}`,
          ...preview,
          title: preview.detectedTitle,
          scope: preview.suggestedScope,
          category: preview.suggestedCategory,
          slug: preview.suggestedSlug,
          status: 'review',
          version: '1.0.0',
          owner: user?.displayName ?? '',
          reviewer: '知识管理员',
          submittedAt: new Date().toISOString(),
          approvedBy: '',
          approvedAt: '',
          approvalComment: '',
          effectiveDate: '',
          reviewNotes: preview.warnings.join(' '),
          tags: [],
          body: preview.cleanedMarkdown,
        })),
      );
      void messageApi.success(`已生成 ${previews.length} 份批量导入预览。`);
    } catch (previewError) {
      void messageApi.error((previewError as Error).message);
    } finally {
      setSubmitting(false);
    }

    return false;
  };

  const updateBatchImportItem = (key: string, patch: Partial<BatchImportItem>) => {
    setBatchImportItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const handleBatchImportCommit = async () => {
    if (!batchImportItems.length) {
      return;
    }

    try {
      setSubmitting(true);
      await createManagedKnowledgeDocumentsBatch({
        items: batchImportItems.map((item) => ({
          title: item.title.trim(),
          scope: item.scope,
          category: item.category,
          slug: item.slug?.trim() || undefined,
          status: item.status,
          version: item.version.trim(),
          owner: item.owner?.trim() || undefined,
          reviewer: item.reviewer?.trim() || undefined,
          submittedAt: item.status === 'review' ? item.submittedAt || new Date().toISOString() : undefined,
          approvedBy: item.status === 'published' ? item.approvedBy?.trim() || item.owner?.trim() || undefined : undefined,
          approvedAt: item.status === 'published' ? item.approvedAt || new Date().toISOString() : undefined,
          approvalComment: item.approvalComment?.trim() || undefined,
          effectiveDate: item.effectiveDate?.trim() || undefined,
          reviewNotes: item.reviewNotes?.trim() || undefined,
          tags: item.tags,
          body: item.body.trim(),
        })),
      });
      setBatchImportDrawerOpen(false);
      setBatchImportFiles([]);
      setBatchImportItems([]);
      void messageApi.success('批量导入文档已提交。');
      await loadData();
    } catch (commitError) {
      void messageApi.error((commitError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const applyImportPreviewToDocumentForm = () => {
    if (!importPreview) {
      return;
    }

    setEditingDocument(null);
    documentForm.setFieldsValue({
      title: importPreview.detectedTitle,
      scope: importPreview.suggestedScope,
      category: importPreview.suggestedCategory,
      slug: importPreview.suggestedSlug,
      status: 'draft',
      version: '1.0.0',
      owner: user?.displayName ?? '',
      reviewer: '',
      approvedBy: '',
      approvalComment: '',
      effectiveDate: '',
      reviewNotes: importPreview.warnings.join(' '),
      tags: '',
      body: importPreview.cleanedMarkdown,
    });
    setImportDrawerOpen(false);
    setDocumentDrawerOpen(true);
  };

  const openDocumentHistory = async (document: ManagedKnowledgeDocument) => {
    try {
      setSubmitting(true);
      const history = await getManagedKnowledgeDocumentHistory(document.id);
      setHistoryDocument(document);
      setDocumentHistory(history);
      setDocumentDiff(null);
      setHistoryDrawerOpen(true);
    } catch (historyError) {
      void messageApi.error((historyError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const compareDocumentHistory = async (historyId: string) => {
    if (!historyDocument) {
      return;
    }

    try {
      setSubmitting(true);
      const diff = await getManagedKnowledgeDocumentDiff(historyDocument.id, historyId);
      setDocumentDiff(diff);
    } catch (diffError) {
      void messageApi.error((diffError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunDiagnostics = async () => {
    try {
      setDiagnosticsLoading(true);
      const result = await runDocumentSearchDiagnostics(diagnosticsQuery.trim());
      setDiagnosticsResult(result);
    } catch (diagnosticsError) {
      void messageApi.error((diagnosticsError as Error).message);
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {contextHolder}
      {error ? <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} /> : null}

      <div className="rounded-[2rem] border border-white/60 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_25%),linear-gradient(135deg,_rgba(255,255,255,0.95),_rgba(239,246,255,0.9))] p-8 shadow-panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Typography.Title level={2} className="!mb-2">
              企业知识中心
            </Typography.Title>
            <Typography.Paragraph className="!mb-3 !max-w-3xl !text-slate-600">
              把制度文档、检索增强语料和知识库问答统一到一个管理视图里，便于持续补充公司基础信息并提高智能助手的命中率。
            </Typography.Paragraph>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadData()}>
              刷新
            </Button>
            {canManage ? (
              <>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateArticle}>
                  新建知识条目
                </Button>
                <Button onClick={openCreateFact}>新建基础字段</Button>
                <Button onClick={openBatchImportDocument}>批量导入</Button>
                <Button icon={<ImportOutlined />} onClick={openImportDocument}>
                  导入制度文件
                </Button>
                <Button icon={<FileAddOutlined />} onClick={openCreateDocument}>
                  新建制度文档
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-brand/10 bg-white/90 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-brand">
                <BookOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold text-ink">{articles.length}</div>
                <div className="text-xs text-slate-500">知识库条目</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-blue-100/60 bg-white/90 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <FileTextOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold text-ink">{documents.length}</div>
                <div className="text-xs text-slate-500">检索增强文档</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-purple-100/60 bg-white/90 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-purple-600">
                <InfoCircleOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold text-ink">{companyFacts.length}</div>
                <div className="text-xs text-slate-500">基础字段</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-100/60 bg-white/90 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <SearchOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold text-ink">{suggestedQuestions.length}</div>
                <div className="text-xs text-slate-500">建议问法</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="rounded-3xl shadow-panel">
          <Typography.Title level={4}>知识结构概览</Typography.Title>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-slate-50 p-5">
              <div className="text-sm text-slate-500">知识库分类</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {articleCategoryStats.length ? (
                  articleCategoryStats.map((item) => (
                    <Tag key={item.category} color="cyan">
                      {formatDisplayValue(item.category)} {item.count}
                    </Tag>
                  ))
                ) : (
                  <Tag>暂无</Tag>
                )}
              </div>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <div className="text-sm text-slate-500">检索增强文档分类</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {documentCategoryStats.length ? (
                  documentCategoryStats.map((item) => (
                    <Tag key={item.category} color="blue">
                      {formatDisplayValue(item.category)} {item.count}
                    </Tag>
                  ))
                ) : (
                  <Tag>暂无</Tag>
                )}
              </div>
            </div>
          </div>

          <Typography.Title level={5} className="!mt-6">
            高频主题
          </Typography.Title>
          <div className="mt-3 flex flex-wrap gap-2">
            {topQuestionTags.length ? (
              topQuestionTags.map((item) => (
                <Tag key={item.tag} color="gold">
                  {item.tag} {item.count}
                </Tag>
              ))
            ) : (
              <Tag>暂无标签</Tag>
            )}
          </div>

          <Typography.Title level={5} className="!mt-6">
            建议补充的知识方向
          </Typography.Title>
          <List
            className="mt-3"
            dataSource={[
              '公司基础信息：办公地点、作息、混合办公、法定福利、入职材料清单。',
              '制度文件：试用期、转正、调岗、晋升、奖惩、保密、信息安全、差旅报销。',
              '运营知识：招聘服务时效、面试官规范、绩效节奏、薪酬发放与社保公积金说明。',
            ]}
            renderItem={(item) => (
              <List.Item>
                <div className="text-slate-700">{item}</div>
              </List.Item>
            )}
          />
          <Alert
            className="mt-6"
            type="info"
            showIcon
            message="治理规则"
            description="草稿和待复核文档仅在管理面板可见；员工问答与知识引用只会检索已发布且已生效的文档。"
          />
          <Typography.Title level={5} className="!mt-6">
            结构化公司事实
          </Typography.Title>
          <List
            className="mt-3"
            dataSource={filteredCompanyFacts.slice(0, 6)}
            locale={{ emptyText: '暂无结构化公司基础信息。' }}
            renderItem={(item) => (
              <List.Item>
                <div className="w-full">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-ink">{item.label}</div>
                    <Tag color={item.status === 'published' ? 'green' : item.status === 'archived' ? 'default' : 'gold'}>
                      {formatDisplayValue(item.status)}
                    </Tag>
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{item.value}</div>
                  <div className="mt-2 text-sm text-slate-500">{item.description || item.source || '-'}</div>
                </div>
              </List.Item>
            )}
          />
        </Card>

        <Card className="rounded-3xl shadow-panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Typography.Title level={4} className="!mb-1">
                知识资产列表
              </Typography.Title>
              <Typography.Text type="secondary">支持按内容类型和关键词筛选。</Typography.Text>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Segmented<KnowledgeFilter>
                value={filter}
                onChange={(value) => setFilter(value)}
                options={[
                  { label: '全部', value: 'all' },
                  { label: '知识库', value: 'kb' },
                  { label: '检索增强文档', value: 'doc' },
                  { label: '基础字段', value: 'fact' },
                ]}
              />
              <Input
                allowClear
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="搜索标题、问题、标签或文档路径"
                className="min-w-[260px]"
              />
            </div>
          </div>

          {(filter === 'all' || filter === 'kb') && (
            <>
              <Typography.Title level={5} className="!mt-6">
                知识库问答
              </Typography.Title>
              {filteredArticles.length ? (
                <List
                  className="mt-3"
                  dataSource={filteredArticles}
                  renderItem={(article) => (
                    <List.Item>
                      <div className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Tag color="cyan">知识库</Tag>
                            <Tag>{formatDisplayValue(article.category)}</Tag>
                            {article.isPublished ? <Tag color="green">已发布</Tag> : <Tag color="gold">草稿</Tag>}
                            {(article.tags ?? []).slice(0, 4).map((tag) => (
                              <Tag key={`${article.id}-${tag}`}>{tag}</Tag>
                            ))}
                          </div>
                          {canManage ? (
                            <div className="flex flex-wrap gap-2">
                              <Button size="small" icon={<EditOutlined />} onClick={() => openEditArticle(article)}>
                                编辑
                              </Button>
                              <Popconfirm
                                title="删除知识条目"
                                description="删除后不会进入知识库与问答检索。"
                                onConfirm={() => void handleRemoveArticle(article.id)}
                              >
                                <Button size="small" danger icon={<DeleteOutlined />}>
                                  删除
                                </Button>
                              </Popconfirm>
                            </div>
                          ) : null}
                        </div>
                        <Typography.Title level={5} className="!mb-0 !mt-3">
                          {article.title}
                        </Typography.Title>
                        <Typography.Paragraph className="!mb-1 !mt-3 text-slate-700">
                          <span className="font-medium text-ink">问：</span>
                          {article.question}
                        </Typography.Paragraph>
                        <Typography.Paragraph className="!mb-0 text-slate-500">
                          <span className="font-medium text-ink">答：</span>
                          {article.answer}
                        </Typography.Paragraph>
                      </div>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty className="my-10" description="没有匹配的知识库条目。" />
              )}
            </>
          )}

          {(filter === 'all' || filter === 'doc') && (
            <>
              <Typography.Title level={5} className="!mt-6">
                本地检索增强文档
              </Typography.Title>
              {filteredDocuments.length ? (
                <List
                  className="mt-3"
                  dataSource={filteredDocuments}
                  renderItem={(document) => (
                    <List.Item>
                      <div className="w-full rounded-3xl border border-slate-200 bg-white p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Tag color="blue">制度文档</Tag>
                          <Tag>{formatDisplayValue(document.category)}</Tag>
                          <Tag color={getDocumentStatusColor(document.status)}>{formatDisplayValue(document.status)}</Tag>
                          <Tag>版本 {document.version}</Tag>
                          {document.owner ? <Tag>{document.owner}</Tag> : null}
                        </div>
                        <Typography.Title level={5} className="!mb-0 !mt-3">
                          {document.title}
                        </Typography.Title>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>更新时间：{document.updatedAt}</span>
                          {document.effectiveDate ? <span>生效日期：{document.effectiveDate}</span> : null}
                        </div>
                        {(document.tags ?? []).length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {document.tags.map((tag) => (
                              <Tag key={`${document.sourcePath}-${tag}`}>{tag}</Tag>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-3 text-sm text-slate-500">{document.sourcePath}</div>
                      </div>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty className="my-10" description="没有匹配的检索增强文档。" />
              )}
            </>
          )}

          {(filter === 'all' || filter === 'fact') && (
            <>
              <Typography.Title level={5} className="!mt-6">
                结构化公司基础信息
              </Typography.Title>
              {filteredCompanyFacts.length ? (
                <List
                  className="mt-3"
                  dataSource={filteredCompanyFacts}
                  renderItem={(fact) => (
                    <List.Item>
                      <div className="w-full rounded-3xl border border-slate-200 bg-white p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Tag color="geekblue">基础字段</Tag>
                          <Tag>{formatDisplayValue(fact.category)}</Tag>
                          <Tag color={fact.status === 'published' ? 'green' : fact.status === 'archived' ? 'default' : 'gold'}>
                            {formatDisplayValue(fact.status)}
                          </Tag>
                        </div>
                        <Typography.Title level={5} className="!mb-0 !mt-3">
                          {fact.label}
                        </Typography.Title>
                        <div className="mt-3 text-sm text-slate-700">{fact.value}</div>
                        <div className="mt-2 text-sm text-slate-500">{fact.description || '-'}</div>
                        <div className="mt-2 text-sm text-slate-500">
                          来源：{fact.source || '-'} · 排序：{fact.sortOrder}
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty className="my-10" description="没有匹配的结构化基础字段。" />
              )}
            </>
          )}
        </Card>
      </div>

      {canManage ? (
        <Card className="rounded-3xl shadow-panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Typography.Title level={4} className="!mb-1">
                管理面板
              </Typography.Title>
              <Typography.Text type="secondary">
                维护知识条目与可编辑文档池，只有已发布且达到生效日期的文档会进入本地检索增强问答。
              </Typography.Text>
            </div>
            <Segmented<ManagementTab>
              value={managementTab}
              onChange={(value) => setManagementTab(value)}
              options={[
                { label: '知识条目', value: 'articles' },
                { label: '可维护文档', value: 'documents' },
                { label: '基础字段', value: 'facts' },
              ]}
            />
          </div>

          {managementTab === 'articles' ? (
            <List
              className="mt-5"
              dataSource={filteredArticles}
              locale={{ emptyText: '暂无可管理知识条目。' }}
              renderItem={(article) => (
                <List.Item>
                  <div className="flex w-full flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-ink">{article.title}</div>
                        <Tag>{formatDisplayValue(article.category)}</Tag>
                        {article.isPublished ? <Tag color="green">已发布</Tag> : <Tag color="gold">草稿</Tag>}
                      </div>
                      <div className="mt-2 text-sm text-slate-500">{article.question}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEditArticle(article)}>
                        编辑
                      </Button>
                      <Popconfirm
                        title="删除知识条目"
                        description="删除后将不再出现在知识问答中。"
                        onConfirm={() => void handleRemoveArticle(article.id)}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          ) : managementTab === 'documents' ? (
            <List
              className="mt-5"
              dataSource={filteredManagedDocuments}
              locale={{ emptyText: '暂无可维护文档。' }}
              renderItem={(document) => (
                <List.Item>
                  <div className="flex w-full flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-ink">{document.title}</div>
                        <Tag>{formatDisplayValue(document.category)}</Tag>
                        <Tag>{document.scope.includes('policies') ? '制度池' : '公司资料池'}</Tag>
                        <Tag color={getDocumentStatusColor(document.status)}>{formatDisplayValue(document.status)}</Tag>
                        <Tag>版本 {document.version}</Tag>
                        {document.owner ? <Tag>{document.owner}</Tag> : null}
                      </div>
                      <div className="mt-2 text-sm text-slate-500">
                        {document.sourcePath}
                        {document.effectiveDate ? ` · 生效 ${document.effectiveDate}` : ''}
                        {document.lastPublishedAt ? ` · 最近发布 ${document.lastPublishedAt.slice(0, 10)}` : ''}
                      </div>
                      {document.reviewer || document.approvedBy ? (
                        <div className="mt-2 text-sm text-slate-500">
                          {document.reviewer ? `审核人：${document.reviewer}` : ''}
                          {document.reviewer && document.approvedBy ? ' · ' : ''}
                          {document.approvedBy ? `批准人：${document.approvedBy}` : ''}
                        </div>
                      ) : null}
                      {document.submittedAt || document.approvedAt ? (
                        <div className="mt-1 text-xs text-slate-400">
                          {document.submittedAt ? `提交 ${document.submittedAt.slice(0, 10)}` : ''}
                          {document.submittedAt && document.approvedAt ? ' · ' : ''}
                          {document.approvedAt ? `批准 ${document.approvedAt.slice(0, 10)}` : ''}
                        </div>
                      ) : null}
                      {document.approvalComment ? (
                        <div className="mt-2 text-sm text-slate-500">批准意见：{document.approvalComment}</div>
                      ) : null}
                      {document.reviewNotes ? (
                        <div className="mt-2 text-sm text-slate-500">说明：{document.reviewNotes}</div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="small" onClick={() => void openDocumentHistory(document)}>
                        历史
                      </Button>
                      <Button size="small" icon={<EditOutlined />} onClick={() => void openEditDocument(document)}>
                        编辑
                      </Button>
                      <Popconfirm
                        title="删除文档"
                        description="删除后将不再参与检索增强问答。"
                        onConfirm={() => void handleRemoveDocument(document.id)}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <List
              className="mt-5"
              dataSource={filteredCompanyFacts}
              locale={{ emptyText: '暂无可维护基础字段。' }}
              renderItem={(fact) => (
                <List.Item>
                  <div className="flex w-full flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-ink">{fact.label}</div>
                        <Tag>{formatDisplayValue(fact.category)}</Tag>
                        <Tag color={fact.status === 'published' ? 'green' : fact.status === 'archived' ? 'default' : 'gold'}>
                          {formatDisplayValue(fact.status)}
                        </Tag>
                        <Tag>排序 {fact.sortOrder}</Tag>
                      </div>
                      <div className="mt-2 text-sm text-slate-700">{fact.value}</div>
                      <div className="mt-2 text-sm text-slate-500">
                        {fact.description || fact.source || '-'}
                        {fact.source ? ` · 来源：${fact.source}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="small" icon={<EditOutlined />} onClick={() => void openEditFact(fact)}>
                        编辑
                      </Button>
                      <Popconfirm
                        title="删除基础字段"
                        description="删除后将从结构化事实中心和自动生成的检索增强文档中移除。"
                        onConfirm={() => void handleRemoveFact(fact.id)}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          )}
        </Card>
      ) : null}

      {canManage ? (
        <Card className="rounded-3xl shadow-panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Typography.Title level={4} className="!mb-1">
                检索诊断
              </Typography.Title>
              <Typography.Text type="secondary">
                直接测试当前检索增强文档结果，验证制度标题、关键词和章节是否能被命中。
              </Typography.Text>
            </div>
            <div className="w-full max-w-2xl">
              <Input.Search
                allowClear
                value={diagnosticsQuery}
                onChange={(event) => setDiagnosticsQuery(event.target.value)}
                onSearch={() => void handleRunDiagnostics()}
                placeholder="输入要测试的制度标题、问题或关键词"
                enterButton="运行诊断"
                loading={diagnosticsLoading}
              />
            </div>
          </div>

          {diagnosticsResult ? (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Tag color="blue">命中 {diagnosticsResult.resultCount}</Tag>
                <Tag>{diagnosticsResult.query}</Tag>
              </div>
              {diagnosticsResult.results.length ? (
                <List
                  dataSource={diagnosticsResult.results}
                  renderItem={(item) => (
                    <List.Item>
                      <div className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Tag color="geekblue">{item.sourceType}</Tag>
                          <Tag>{formatDisplayValue(item.category)}</Tag>
                        </div>
                        <div className="mt-2 font-medium text-ink">{item.title}</div>
                        {item.section ? <div className="mt-1 text-sm text-slate-500">{item.section}</div> : null}
                        {item.sourcePath ? <div className="mt-1 text-xs text-slate-400">{item.sourcePath}</div> : null}
                        {item.excerpt ? <div className="mt-3 text-sm text-slate-700">{item.excerpt}</div> : null}
                      </div>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty className="py-6" description="当前查询没有命中文档结果" />
              )}
            </div>
          ) : (
            <Alert className="mt-5" type="info" showIcon message="尚未运行诊断" />
          )}
        </Card>
      ) : null}

      <Card className="rounded-3xl shadow-panel">
        <div className="flex items-center gap-3 mb-4">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-brand">
            <SearchOutlined className="text-base" />
          </div>
          <Typography.Title level={4} className="!mb-0">
            建议问法模板
          </Typography.Title>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {suggestedQuestions.map((item, i) => (
            <div
              key={item}
              className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 text-sm text-slate-700 transition-all hover:border-brand/30 hover:shadow-md"
            >
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-md bg-brand/10 text-xs font-semibold text-brand">
                {i + 1}
              </span>
              {item}
            </div>
          ))}
        </div>
      </Card>

      <Drawer
        title={historyDocument ? `文档历史 - ${historyDocument.title}` : '文档历史'}
        width={1080}
        open={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
      >
        {documentHistory.length ? (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div>
              <Typography.Title level={5}>历史快照</Typography.Title>
              <List
                dataSource={documentHistory}
                renderItem={(item) => (
                  <List.Item>
                    <div className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag color={getDocumentStatusColor(item.status)}>{formatDisplayValue(item.status)}</Tag>
                        <Tag>版本 {item.version}</Tag>
                      </div>
                      <div className="mt-2 font-medium text-ink">{item.title}</div>
                      <div className="mt-2 text-xs text-slate-500">{item.savedAt}</div>
                      <Button className="mt-3" block onClick={() => void compareDocumentHistory(item.id)}>
                        查看对比
                      </Button>
                    </div>
                  </List.Item>
                )}
              />
            </div>

            <div>
              {documentDiff ? (
                <div className="space-y-4">
                  <Alert
                    type="info"
                    showIcon
                    message={`对比 ${documentDiff.history.version} -> ${documentDiff.current.version}`}
                    description={`当前状态 ${formatDisplayValue(documentDiff.current.status)}，历史状态 ${formatDisplayValue(documentDiff.history.status)}`}
                  />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="rounded-3xl border border-slate-200 shadow-none">
                      <Typography.Title level={5}>历史版本</Typography.Title>
                      <Input.TextArea value={documentDiff.history.body} readOnly autoSize={{ minRows: 18, maxRows: 28 }} />
                    </Card>
                    <Card className="rounded-3xl border border-slate-200 shadow-none">
                      <Typography.Title level={5}>当前版本</Typography.Title>
                      <Input.TextArea value={documentDiff.current.body} readOnly autoSize={{ minRows: 18, maxRows: 28 }} />
                    </Card>
                  </div>
                  <Card className="rounded-3xl border border-slate-200 shadow-none">
                    <Typography.Title level={5}>差异摘要</Typography.Title>
                    <List
                      dataSource={documentDiff.diff.filter((item) => item.type !== 'unchanged').slice(0, 20)}
                      locale={{ emptyText: '当前没有可展示的文本差异。' }}
                      renderItem={(item) => (
                        <List.Item>
                          <div className="w-full text-sm">
                            <Tag color={item.type === 'added' ? 'green' : item.type === 'removed' ? 'red' : 'gold'}>
                              {item.type}
                            </Tag>
                            {item.previous ? <div className="mt-2 text-slate-500">旧：{item.previous}</div> : null}
                            {item.current ? <div className="mt-1 text-slate-700">新：{item.current}</div> : null}
                          </div>
                        </List.Item>
                      )}
                    />
                  </Card>
                </div>
              ) : (
                <Empty className="py-10" description="从左侧选择一个历史快照查看版本差异" />
              )}
            </div>
          </div>
        ) : (
          <Empty className="py-12" description="该文档还没有历史快照" />
        )}
      </Drawer>

      <Drawer
        title="导入制度文件"
        width={760}
        open={importDrawerOpen}
        onClose={() => setImportDrawerOpen(false)}
        extra={
          <Button type="primary" disabled={!importPreview} onClick={applyImportPreviewToDocumentForm}>
            使用预览结果
          </Button>
        }
      >
        <div className="space-y-5">
          <Alert
            type="info"
            showIcon
            message="支持便携文档、文字文档、标记文档和纯文本"
            description="系统会抽取文本、清洗格式并生成结构化预览。保存和发布仍走受管文档治理流程。"
          />
          <Upload.Dragger
            multiple={false}
            maxCount={1}
            accept=".pdf,.docx,.md,.txt"
            beforeUpload={(file) => handleImportPreview(file)}
            showUploadList={false}
            disabled={submitting}
          >
            <p className="text-base font-medium text-ink">上传制度文件或公司资料</p>
            <p className="mt-2 text-sm text-slate-500">拖拽到此处，或点击选择文件生成清洗预览</p>
          </Upload.Dragger>

          {importPreview ? (
            <Card className="rounded-3xl border border-slate-200 shadow-none">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-slate-500">源文件</div>
                  <div className="mt-1 font-medium text-ink">{importFileName || importPreview.sourceFileName}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">建议标题</div>
                  <div className="mt-1 font-medium text-ink">{importPreview.detectedTitle}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">建议作用域</div>
                  <div className="mt-1">
                    {documentScopeOptions.find((item) => item.value === importPreview.suggestedScope)?.label ??
                      importPreview.suggestedScope}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">建议分类 / 文件标识</div>
                  <div className="mt-1">
                    {formatDisplayValue(importPreview.suggestedCategory)} / {importPreview.suggestedSlug}
                  </div>
                </div>
              </div>

              {importPreview.warnings.length ? (
                <Alert
                  className="mt-4"
                  type="warning"
                  showIcon
                  message="预览提醒"
                  description={importPreview.warnings.join(' ')}
                />
              ) : null}

              <Form layout="vertical" className="mt-4">
                <Form.Item label="清洗后内容预览">
                  <Input.TextArea
                    value={importPreview.cleanedMarkdown}
                    readOnly
                    autoSize={{ minRows: 16, maxRows: 28 }}
                  />
                </Form.Item>
              </Form>
            </Card>
          ) : (
            <Empty className="py-8" description="上传文件后将在这里显示清洗预览" />
          )}
        </div>
      </Drawer>

      <Drawer
        title="批量导入知识文档"
        width={960}
        open={batchImportDrawerOpen}
        onClose={() => setBatchImportDrawerOpen(false)}
        extra={
          <Button type="primary" disabled={!batchImportItems.length} loading={submitting} onClick={() => void handleBatchImportCommit()}>
            提交批量导入
          </Button>
        }
      >
        <div className="space-y-5">
          <Alert
            type="info"
            showIcon
            message="先批量预览，再进入审核流"
            description="批量导入会先生成内容清洗结果，确认标题、作用域、文件标识、审核人和状态后，再一次性写入受管知识中心。"
          />
          <Upload.Dragger
            multiple
            maxCount={20}
            accept=".pdf,.docx,.md,.txt"
            beforeUpload={() => false}
            disabled={submitting}
            onChange={(info) => {
              const files = info.fileList
                .map((file) => file.originFileObj)
                .filter((file): file is NonNullable<typeof file> => Boolean(file));
              setBatchImportFiles(files);
              setBatchImportItems([]);
            }}
          >
            <p className="text-base font-medium text-ink">一次上传多份制度文件或公司资料</p>
            <p className="mt-2 text-sm text-slate-500">支持便携文档、文字文档、标记文档和纯文本，建议单次不超过 20 份</p>
          </Upload.Dragger>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm text-slate-500">已选择 {batchImportFiles.length} 份文件</div>
            <Button type="primary" disabled={!batchImportFiles.length} loading={submitting} onClick={() => void handleBatchImportPreview(batchImportFiles)}>
              生成批量预览
            </Button>
          </div>

          {batchImportItems.length ? (
            <List
              dataSource={batchImportItems}
              renderItem={(item) => (
                <List.Item>
                  <Card className="w-full rounded-3xl border border-slate-200 shadow-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-400">{item.sourceFileName}</div>
                        <div className="mt-1 text-lg font-medium text-ink">{item.title}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Tag>{formatDisplayValue(item.category)}</Tag>
                        <Tag color={getDocumentStatusColor(item.status)}>{formatDisplayValue(item.status)}</Tag>
                      </div>
                    </div>

                    {item.warnings.length ? (
                      <Alert className="mt-4" type="warning" showIcon message="预览提醒" description={item.warnings.join(' ')} />
                    ) : null}

                    <Form layout="vertical" className="mt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Form.Item label="标题">
                          <Input value={item.title} onChange={(event) => updateBatchImportItem(item.key, { title: event.target.value })} />
                        </Form.Item>
                        <Form.Item label="文件标识">
                          <Input value={item.slug} onChange={(event) => updateBatchImportItem(item.key, { slug: event.target.value })} />
                        </Form.Item>
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <Form.Item label="文档池">
                          <Select
                            value={item.scope}
                            options={documentScopeOptions}
                            onChange={(value) => {
                              const matched = documentScopeOptions.find((option) => option.value === value);
                              updateBatchImportItem(item.key, {
                                scope: value,
                                category: matched?.category ?? item.category,
                              });
                            }}
                          />
                        </Form.Item>
                        <Form.Item label="分类">
                          <Select
                            value={item.category}
                            options={[
                              { label: '制度文档', value: 'policy_document' },
                              { label: '公司资料', value: 'company_profile' },
                              { label: '通用文档', value: 'general_document' },
                            ]}
                            onChange={(value) => updateBatchImportItem(item.key, { category: value })}
                          />
                        </Form.Item>
                        <Form.Item label="状态">
                          <Select value={item.status} options={documentStatusOptions} onChange={(value) => updateBatchImportItem(item.key, { status: value })} />
                        </Form.Item>
                        <Form.Item label="版本号">
                          <Input value={item.version} onChange={(event) => updateBatchImportItem(item.key, { version: event.target.value })} />
                        </Form.Item>
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <Form.Item label="负责人">
                          <Input value={item.owner} onChange={(event) => updateBatchImportItem(item.key, { owner: event.target.value })} />
                        </Form.Item>
                        <Form.Item label="审核人">
                          <Input value={item.reviewer} onChange={(event) => updateBatchImportItem(item.key, { reviewer: event.target.value })} />
                        </Form.Item>
                        <Form.Item label="批准人">
                          <Input value={item.approvedBy} onChange={(event) => updateBatchImportItem(item.key, { approvedBy: event.target.value })} />
                        </Form.Item>
                        <Form.Item label="生效日期">
                          <Input type="date" value={item.effectiveDate} onChange={(event) => updateBatchImportItem(item.key, { effectiveDate: event.target.value })} />
                        </Form.Item>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Form.Item label="标签">
                          <Input
                            value={joinTagInput(item.tags)}
                            onChange={(event) => updateBatchImportItem(item.key, { tags: parseTagInput(event.target.value) })}
                          />
                        </Form.Item>
                        <Form.Item label="复核说明">
                          <Input
                            value={item.reviewNotes}
                            onChange={(event) => updateBatchImportItem(item.key, { reviewNotes: event.target.value })}
                          />
                        </Form.Item>
                      </div>

                      <Form.Item label="批准意见">
                        <Input.TextArea
                          autoSize={{ minRows: 2, maxRows: 4 }}
                          value={item.approvalComment}
                          onChange={(event) => updateBatchImportItem(item.key, { approvalComment: event.target.value })}
                        />
                      </Form.Item>

                      <Form.Item label="清洗后内容">
                        <Input.TextArea value={item.body} readOnly autoSize={{ minRows: 10, maxRows: 18 }} />
                      </Form.Item>
                    </Form>
                  </Card>
                </List.Item>
              )}
            />
          ) : (
            <Empty className="py-8" description="上传多份文件并生成预览后，将在这里逐项调整批量导入参数。" />
          )}
        </div>
      </Drawer>

      <Drawer
        title={editingArticle ? '编辑知识条目' : '新建知识条目'}
        width={720}
        open={articleDrawerOpen}
        onClose={() => setArticleDrawerOpen(false)}
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={() => void handleArticleSubmit()}>
            保存
          </Button>
        }
      >
        <Form layout="vertical" form={articleForm}>
          <Form.Item label="分类" name="category" rules={[{ required: true, message: '请选择分类。' }]}>
            <Select
              options={articleCategoryOptions.map((item) => ({
                label: formatDisplayValue(item),
                value: item,
              }))}
            />
          </Form.Item>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题。' }]}>
            <Input placeholder="例如：工资单查看" />
          </Form.Item>
          <Form.Item label="问题" name="question" rules={[{ required: true, message: '请输入问题。' }]}>
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item label="答案" name="answer" rules={[{ required: true, message: '请输入答案。' }]}>
            <Input.TextArea autoSize={{ minRows: 5, maxRows: 10 }} />
          </Form.Item>
          <Form.Item label="标签" name="tags">
            <Input placeholder="用中文逗号分隔，例如：工资单，薪酬，发薪" />
          </Form.Item>
          <Form.Item label="发布状态" name="isPublished" valuePropName="checked">
            <Switch checkedChildren="已发布" unCheckedChildren="草稿" />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={editingDocument ? '编辑制度文档' : '新建制度文档'}
        width={820}
        open={documentDrawerOpen}
        onClose={() => setDocumentDrawerOpen(false)}
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={() => void handleDocumentSubmit()}>
            保存
          </Button>
        }
      >
        {importPreview?.warnings.length ? (
          <Alert
            className="mb-4"
            type="warning"
            showIcon
            message="导入预览提醒"
            description={importPreview.warnings.join(' ')}
          />
        ) : null}
        {editingDocument?.submittedAt || editingDocument?.approvedAt ? (
          <Alert
            className="mb-4"
            type="info"
            showIcon
            message="当前审核流信息"
            description={[
              editingDocument?.submittedAt ? `提交时间：${editingDocument.submittedAt}` : '',
              editingDocument?.approvedAt ? `批准时间：${editingDocument.approvedAt}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        ) : null}
        <Form
          layout="vertical"
          form={documentForm}
          onValuesChange={(changedValues) => {
            if (changedValues.scope) {
              const matched = documentScopeOptions.find((item) => item.value === changedValues.scope);
              if (matched) {
                documentForm.setFieldValue('category', matched.category);
              }
            }
          }}
        >
          <Form.Item label="文档标题" name="title" rules={[{ required: true, message: '请输入文档标题。' }]}>
            <Input placeholder="例如：报销与差旅制度" />
          </Form.Item>
          <div className="grid gap-4 md:grid-cols-3">
            <Form.Item label="归属文档池" name="scope" rules={[{ required: true, message: '请选择文档池。' }]}>
              <Select options={documentScopeOptions} />
            </Form.Item>
            <Form.Item label="检索分类" name="category" rules={[{ required: true, message: '请选择分类。' }]}>
              <Select
                options={[
                  { label: '制度文档', value: 'policy_document' },
                  { label: '公司资料', value: 'company_profile' },
                  { label: '通用文档', value: 'general_document' },
                ]}
              />
            </Form.Item>
            <Form.Item label="文件标识" name="slug" tooltip="用于生成文件名，可为空。">
              <Input placeholder="例如：baoxiao-chailv-zhidu" />
            </Form.Item>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <Form.Item label="文档状态" name="status" rules={[{ required: true, message: '请选择文档状态。' }]}>
              <Select options={documentStatusOptions} />
            </Form.Item>
            <Form.Item label="版本号" name="version" rules={[{ required: true, message: '请输入版本号。' }]}>
              <Input placeholder="例如：1.0.0" />
            </Form.Item>
            <Form.Item label="负责人" name="owner">
              <Input placeholder="例如：人力资源部" />
            </Form.Item>
            <Form.Item label="生效日期" name="effectiveDate">
              <Input type="date" />
            </Form.Item>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item label="审核人" name="reviewer">
              <Input placeholder="例如：人力资源业务伙伴或制度管理员" />
            </Form.Item>
            <Form.Item label="批准人" name="approvedBy">
              <Input placeholder="例如：人力资源负责人" />
            </Form.Item>
          </div>
          <Form.Item label="标签" name="tags">
            <Input placeholder="用中文逗号分隔，例如：报销，差旅，制度" />
          </Form.Item>
          <Form.Item label="批准意见" name="approvalComment">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="例如：内容准确，可正式发布。" />
          </Form.Item>
          <Form.Item label="复核说明" name="reviewNotes">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="例如：完成人力资源与财务复核，可发布。" />
          </Form.Item>
          <Form.Item
            label="文档正文"
            name="body"
            rules={[{ required: true, message: '请输入文档正文。' }]}
            extra="首行标题会自动按上面的文档标题生成；正文支持标题、列表等标记语法。草稿和待复核文档不会进入检索增强问答。"
          >
            <Input.TextArea
              autoSize={{ minRows: 18, maxRows: 28 }}
              placeholder={'## 1. 适用范围\n- ...\n\n## 2. 提交流程\n- ...'}
            />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={editingFact ? '编辑基础字段' : '新建基础字段'}
        width={720}
        open={factDrawerOpen}
        onClose={() => setFactDrawerOpen(false)}
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={() => void handleFactSubmit()}>
            保存
          </Button>
        }
      >
        <Form layout="vertical" form={factForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item label="分类" name="category" rules={[{ required: true, message: '请选择分类。' }]}>
              <Select
                options={companyFactCategoryOptions.map((item) => ({
                  label: formatDisplayValue(item),
                  value: item,
                }))}
              />
            </Form.Item>
            <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态。' }]}>
              <Select options={companyFactStatusOptions} />
            </Form.Item>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item label="字段名称" name="label" rules={[{ required: true, message: '请输入字段名称。' }]}>
              <Input placeholder="例如：公司名称" />
            </Form.Item>
            <Form.Item label="排序值" name="sortOrder" rules={[{ required: true, message: '请输入排序值。' }]}>
              <Input type="number" placeholder="例如：100" />
            </Form.Item>
          </div>
          <Form.Item label="字段值" name="value" rules={[{ required: true, message: '请输入字段值。' }]}>
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item label="来源" name="source">
            <Input placeholder="例如：办公与福利指南" />
          </Form.Item>
          <Form.Item label="标签" name="tags">
            <Input placeholder="用中文逗号分隔，例如：办公，地址，总部" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
