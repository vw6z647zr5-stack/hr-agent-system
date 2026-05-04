import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { Repository } from 'typeorm';
import { paginateQuery } from '../common/utils/pagination';
import { KnowledgeBaseArticleEntity } from './agent-support.entities';
import { DocumentRagService } from './document-rag.service';
import { TenantContext } from '../tenant/tenant.context';
import {
  CreateKnowledgeArticleDto,
  KnowledgeArticleListQueryDto,
  KnowledgeDocumentListQueryDto,
  UpsertKnowledgeDocumentDto,
  UpdateKnowledgeArticleDto,
} from './knowledge-management.dto';
import {
  buildManagedDocumentFile,
  isManagedDocumentPath,
  MANAGED_DOCUMENT_SCOPES,
  normalizeManagedDocumentSlug,
  type ManagedDocumentScope,
  parseManagedDocumentFile,
} from './managed-document.utils';

type ManagedDocumentSummary = {
  id: string;
  title: string;
  sourcePath: string;
  category: string;
  scope: ManagedDocumentScope;
  status: 'draft' | 'review' | 'published' | 'archived';
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
  updatedAt: string;
};

type ManagedDocumentHistorySummary = {
  id: string;
  sourcePath: string;
  snapshotPath: string;
  title: string;
  version: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  owner: string;
  savedAt: string;
};

@Injectable()
export class KnowledgeManagementService {
  private readonly managedDirectories: ManagedDocumentScope[] = [...MANAGED_DOCUMENT_SCOPES];
  private readonly historyRoot = join(process.cwd(), 'docs', '.history');

  constructor(
    @InjectRepository(KnowledgeBaseArticleEntity)
    private readonly knowledgeBaseRepository: Repository<KnowledgeBaseArticleEntity>,
    private readonly documentRagService: DocumentRagService,
    private readonly tenantContext: TenantContext,
  ) {}

  listArticles(query: KnowledgeArticleListQueryDto) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.knowledgeBaseRepository
      .createQueryBuilder('article')
      .where('article.company_id = :companyId', { companyId })
      .orderBy('article.updatedAt', 'DESC')
      .addOrderBy('article.createdAt', 'DESC');

    if (query.search) {
      builder.andWhere(
        '(article.title ILIKE :search OR article.question ILIKE :search OR article.answer ILIKE :search)',
        {
          search: `%${query.search}%`,
        },
      );
    }

    if (query.category) {
      builder.andWhere('article.category = :category', { category: query.category });
    }

    if (query.publishedOnly) {
      builder.andWhere('article.isPublished = :isPublished', { isPublished: true });
    }

    return paginateQuery(builder, query);
  }

  async getArticle(id: string) {
    const companyId = this.tenantContext.getCompanyId();
    const article = await this.knowledgeBaseRepository.findOne({ where: { id, companyId } });
    if (!article) {
      throw new NotFoundException('未找到知识库条目。');
    }

    return article;
  }

  createArticle(payload: CreateKnowledgeArticleDto) {
    const companyId = this.tenantContext.getCompanyId();
    return this.knowledgeBaseRepository.save(
      this.knowledgeBaseRepository.create({
        ...payload,
        companyId,
        tags: payload.tags ?? [],
        isPublished: payload.isPublished ?? true,
      }),
    );
  }

  async updateArticle(id: string, payload: UpdateKnowledgeArticleDto) {
    const current = await this.getArticle(id);
    const entity = await this.knowledgeBaseRepository.preload({
      id,
      category: payload.category ?? current.category,
      title: payload.title ?? current.title,
      question: payload.question ?? current.question,
      answer: payload.answer ?? current.answer,
      tags: payload.tags ?? current.tags,
      isPublished: payload.isPublished ?? current.isPublished,
    });

    if (!entity) {
      throw new NotFoundException('未找到知识库条目。');
    }

    return this.knowledgeBaseRepository.save(entity);
  }

  async removeArticle(id: string) {
    await this.getArticle(id);
    await this.knowledgeBaseRepository.delete(id);
    return { success: true };
  }

  async listManagedDocuments(query: KnowledgeDocumentListQueryDto) {
    const scopes = query.scope ? [query.scope as ManagedDocumentScope] : this.managedDirectories;
    const entries = await Promise.all(scopes.map((scope) => this.readManagedDocuments(scope)));
    const normalizedSearch = query.search?.trim().toLowerCase();

    return entries
      .flat()
      .filter((item) => {
        if (query.category && item.category !== query.category) {
          return false;
        }

        if (query.status && item.status !== query.status) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return [
          item.title,
          item.sourcePath,
          item.category,
          item.owner,
          item.reviewer,
          item.approvedBy,
          item.approvalComment,
          item.version,
          item.status,
          item.effectiveDate ?? '',
          ...item.tags,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async getManagedDocument(id: string) {
    const fullPath = this.resolveManagedPath(id);
    const content = await this.readManagedFile(fullPath);
    const metadata = await this.statManagedFile(fullPath);
    const sourcePath = relative(process.cwd(), fullPath).replaceAll('\\', '/');
    const parsed = parseManagedDocumentFile(sourcePath, content, basename(fullPath, '.md'));

    return {
      id: sourcePath,
      title: parsed.metadata.title,
      sourcePath,
      category: parsed.metadata.category,
      scope: parsed.metadata.scope,
      status: parsed.metadata.status,
      version: parsed.metadata.version,
      owner: parsed.metadata.owner,
      reviewer: parsed.metadata.reviewer,
      submittedAt: parsed.metadata.submittedAt,
      approvedBy: parsed.metadata.approvedBy,
      approvedAt: parsed.metadata.approvedAt,
      approvalComment: parsed.metadata.approvalComment,
      effectiveDate: parsed.metadata.effectiveDate,
      reviewNotes: parsed.metadata.reviewNotes,
      tags: parsed.metadata.tags,
      lastPublishedAt: parsed.metadata.lastPublishedAt,
      body: parsed.editableBody,
      markdownBody: parsed.markdownBody,
      updatedAt: metadata.mtime.toISOString(),
    };
  }

  async upsertManagedDocument(payload: UpsertKnowledgeDocumentDto, id?: string) {
    const directory = join(process.cwd(), payload.scope);
    await mkdir(directory, { recursive: true });

    const slug = normalizeManagedDocumentSlug(payload.slug || payload.title) || 'document';
    const fileName = `${slug}.md`;
    const requestedPath = join(directory, fileName);
    let targetPath = requestedPath;
    let fullPath = id ? this.resolveManagedPath(id) : requestedPath;

    if (!id) {
      targetPath = await this.ensureAvailableDocumentPath(requestedPath);
      fullPath = targetPath;
    }

    if (id) {
      const currentPath = relative(process.cwd(), fullPath).replaceAll('\\', '/');
      targetPath = await this.ensureAvailableDocumentPath(requestedPath, currentPath);
      const nextPath = relative(process.cwd(), targetPath).replaceAll('\\', '/');
      if (currentPath !== nextPath) {
        await mkdir(directory, { recursive: true });
        await rename(fullPath, targetPath);
        fullPath = targetPath;
      }
    }

    const sourcePath = relative(process.cwd(), fullPath).replaceAll('\\', '/');
    const current =
      id && sourcePath !== id
        ? await this.getManagedDocument(sourcePath)
        : id
          ? await this.getManagedDocument(id)
          : null;
    const submittedAt = this.resolveSubmittedAt(payload, current);
    const approvedAt = this.resolveApprovedAt(payload, current);
    const lastPublishedAt =
      payload.status === 'published' ? approvedAt ?? new Date().toISOString() : current?.lastPublishedAt ?? null;
    const markdown = buildManagedDocumentFile(
      {
        title: payload.title.trim(),
        category: payload.category,
        scope: payload.scope as ManagedDocumentScope,
        status: payload.status as 'draft' | 'review' | 'published' | 'archived',
        version: payload.version.trim(),
        owner: payload.owner?.trim() ?? '',
        reviewer: payload.reviewer?.trim() ?? current?.reviewer ?? '',
        submittedAt,
        approvedBy:
          payload.approvedBy?.trim() ??
          current?.approvedBy ??
          (payload.status === 'published' ? payload.owner?.trim() ?? current?.owner ?? '' : ''),
        approvedAt,
        approvalComment: payload.approvalComment?.trim() ?? current?.approvalComment ?? '',
        effectiveDate: payload.effectiveDate ?? null,
        reviewNotes: payload.reviewNotes?.trim() ?? '',
        tags: payload.tags ?? [],
        lastPublishedAt,
      },
      payload.body,
    );
    const existingContent = await this.readIfExists(fullPath);
    if (existingContent && existingContent !== markdown) {
      await this.writeHistorySnapshot(sourcePath, existingContent);
    }
    await writeFile(fullPath, markdown, 'utf8');
    this.documentRagService.invalidateCache();

    return this.getManagedDocument(sourcePath);
  }

  async upsertManagedDocumentsBatch(payloads: UpsertKnowledgeDocumentDto[]) {
    const results: Awaited<ReturnType<KnowledgeManagementService['getManagedDocument']>>[] = [];

    for (const payload of payloads) {
      results.push(await this.upsertManagedDocument(payload));
    }

    return results;
  }

  async removeManagedDocument(id: string) {
    const fullPath = this.resolveManagedPath(id);
    const existingContent = await this.readIfExists(fullPath);
    if (existingContent) {
      await this.writeHistorySnapshot(id, existingContent);
    }
    await rm(fullPath, { force: true });
    this.documentRagService.invalidateCache();
    return { success: true };
  }

  async listManagedDocumentHistory(id: string): Promise<ManagedDocumentHistorySummary[]> {
    const normalized = this.normalizeManagedId(id);
    const historyDirectory = this.resolveHistoryDirectory(normalized);

    try {
      const entries = await readdir(historyDirectory, { withFileTypes: true });
      const snapshots = await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
          .map(async (entry) => {
            const fullPath = join(historyDirectory, entry.name);
            const content = await readFile(fullPath, 'utf8');
            const metadata = await stat(fullPath);
            const parsed = parseManagedDocumentFile(normalized, content, basename(entry.name, '.md'));
            const snapshotPath = relative(process.cwd(), fullPath).replaceAll('\\', '/');

            return {
              id: entry.name.replace(/\.md$/i, ''),
              sourcePath: normalized,
              snapshotPath,
              title: parsed.metadata.title,
              version: parsed.metadata.version,
              status: parsed.metadata.status,
              owner: parsed.metadata.owner,
              savedAt: metadata.mtime.toISOString(),
            };
          }),
      );

      return snapshots.sort((left, right) => right.savedAt.localeCompare(left.savedAt));
    } catch {
      return [];
    }
  }

  async compareManagedDocumentWithHistory(id: string, historyId: string) {
    const normalized = this.normalizeManagedId(id);
    const historyPath = this.resolveHistorySnapshotPath(normalized, historyId);
    const current = await this.getManagedDocument(normalized);
    const historyContent = await this.readHistorySnapshot(historyPath);
    const historyParsed = parseManagedDocumentFile(normalized, historyContent, historyId);

    return {
      current: {
        id: current.id,
        title: current.title,
        version: current.version,
        status: current.status,
        updatedAt: current.updatedAt,
        body: current.body ?? '',
      },
      history: {
        id: historyId,
        title: historyParsed.metadata.title,
        version: historyParsed.metadata.version,
        status: historyParsed.metadata.status,
        body: historyParsed.editableBody,
      },
      diff: this.buildLineDiff(historyParsed.editableBody, current.body ?? ''),
    };
  }

  async runDocumentSearchDiagnostics(query: string) {
    const normalizedQuery = query.trim();
    const references = await this.documentRagService.search(normalizedQuery, 8);

    return {
      query: normalizedQuery,
      resultCount: references.length,
      results: references,
    };
  }

  private async readManagedDocuments(scope: ManagedDocumentScope): Promise<ManagedDocumentSummary[]> {
    const directory = join(process.cwd(), scope);
    await mkdir(directory, { recursive: true });

    const entries = await readdir(directory, { withFileTypes: true });
    const documents = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
        .map(async (entry) => {
          const fullPath = join(directory, entry.name);
          const content = await readFile(fullPath, 'utf8');
          const metadata = await stat(fullPath);
          const sourcePath = relative(process.cwd(), fullPath).replaceAll('\\', '/');
          if (sourcePath.endsWith('/company-facts-center.md')) {
            return null;
          }
          const parsed = parseManagedDocumentFile(sourcePath, content, entry.name.replace(/\.md$/i, ''));

          return {
            id: sourcePath,
            title: parsed.metadata.title,
            sourcePath,
            category: parsed.metadata.category,
            scope: parsed.metadata.scope,
            status: parsed.metadata.status,
            version: parsed.metadata.version,
            owner: parsed.metadata.owner,
            reviewer: parsed.metadata.reviewer,
            submittedAt: parsed.metadata.submittedAt,
            approvedBy: parsed.metadata.approvedBy,
            approvedAt: parsed.metadata.approvedAt,
            approvalComment: parsed.metadata.approvalComment,
            effectiveDate: parsed.metadata.effectiveDate,
            reviewNotes: parsed.metadata.reviewNotes,
            tags: parsed.metadata.tags,
            lastPublishedAt: parsed.metadata.lastPublishedAt,
            updatedAt: metadata.mtime.toISOString(),
          };
        }),
    );

    return documents.filter((item): item is NonNullable<(typeof documents)[number]> => item !== null);
  }

  private resolveManagedPath(id: string) {
    const normalized = this.normalizeManagedId(id);
    const isAllowed = isManagedDocumentPath(normalized) || this.managedDirectories.includes(normalized as ManagedDocumentScope);

    if (!isAllowed || !normalized.toLowerCase().endsWith('.md')) {
      throw new NotFoundException('未找到可维护文档。');
    }

    return this.resolveInsideWorkspace(normalized);
  }

  private normalizeManagedId(id: string) {
    const normalized = id.replaceAll('\\', '/').replace(/^\/+/, '').trim();

    if (!normalized || normalized.split('/').some((segment) => segment === '..')) {
      throw new NotFoundException('未找到可维护文档。');
    }

    return normalized;
  }

  private async ensureAvailableDocumentPath(targetPath: string, currentRelativePath?: string) {
    let attempt = 0;
    let candidate = targetPath;

    while (true) {
      const relativeCandidate = relative(process.cwd(), candidate).replaceAll('\\', '/');
      if (currentRelativePath && relativeCandidate === currentRelativePath) {
        return candidate;
      }

      try {
        await access(candidate);
        attempt += 1;
        candidate = targetPath.replace(/\.md$/i, `-${attempt + 1}.md`);
      } catch {
        return candidate;
      }
    }
  }

  private resolveHistoryDirectory(sourcePath: string) {
    const normalized = this.normalizeManagedId(sourcePath);
    const directory = resolve(this.historyRoot, normalized.replaceAll('/', '__').replace(/\.md$/i, ''));
    const relativeToHistoryRoot = relative(this.historyRoot, directory);

    if (relativeToHistoryRoot.startsWith('..') || isAbsolute(relativeToHistoryRoot)) {
      throw new NotFoundException('未找到文档历史。');
    }

    return directory;
  }

  private resolveHistorySnapshotPath(sourcePath: string, historyId: string) {
    const safeHistoryId = historyId.trim().replaceAll('\\', '/');

    if (!/^[A-Za-z0-9_.-]+$/.test(safeHistoryId) || safeHistoryId.includes('..') || safeHistoryId.includes('/')) {
      throw new BadRequestException('历史版本标识不合法。');
    }

    const directory = this.resolveHistoryDirectory(sourcePath);
    const snapshotPath = resolve(directory, `${safeHistoryId}.md`);
    const relativeToDirectory = relative(directory, snapshotPath);

    if (relativeToDirectory.startsWith('..') || isAbsolute(relativeToDirectory)) {
      throw new BadRequestException('历史版本标识不合法。');
    }

    return snapshotPath;
  }

  private resolveInsideWorkspace(relativePath: string) {
    const root = process.cwd();
    const absolutePath = resolve(root, relativePath);
    const relativeToRoot = relative(root, absolutePath);

    if (relativeToRoot.startsWith('..') || isAbsolute(relativeToRoot)) {
      throw new NotFoundException('未找到可维护文档。');
    }

    return absolutePath;
  }

  private async readIfExists(filePath: string) {
    try {
      return await readFile(filePath, 'utf8');
    } catch {
      return null;
    }
  }

  private async readManagedFile(filePath: string) {
    try {
      return await readFile(filePath, 'utf8');
    } catch {
      throw new NotFoundException('未找到可维护文档。');
    }
  }

  private async statManagedFile(filePath: string) {
    try {
      return await stat(filePath);
    } catch {
      throw new NotFoundException('未找到可维护文档。');
    }
  }

  private async readHistorySnapshot(filePath: string) {
    try {
      return await readFile(filePath, 'utf8');
    } catch {
      throw new NotFoundException('未找到文档历史版本。');
    }
  }

  private async writeHistorySnapshot(sourcePath: string, content: string) {
    const historyDirectory = this.resolveHistoryDirectory(sourcePath);
    await mkdir(historyDirectory, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotPath = join(historyDirectory, `${stamp}.md`);
    await writeFile(snapshotPath, content, 'utf8');
  }

  private resolveSubmittedAt(
    payload: UpsertKnowledgeDocumentDto,
    current: Awaited<ReturnType<KnowledgeManagementService['getManagedDocument']>> | null,
  ) {
    if (payload.submittedAt !== undefined) {
      return payload.submittedAt.trim() || null;
    }

    if (payload.status === 'review') {
      return current?.submittedAt ?? new Date().toISOString();
    }

    return current?.submittedAt ?? null;
  }

  private resolveApprovedAt(
    payload: UpsertKnowledgeDocumentDto,
    current: Awaited<ReturnType<KnowledgeManagementService['getManagedDocument']>> | null,
  ) {
    if (payload.approvedAt !== undefined) {
      return payload.approvedAt.trim() || null;
    }

    if (payload.status === 'published') {
      return new Date().toISOString();
    }

    return current?.approvedAt ?? null;
  }

  private buildLineDiff(previousText: string, currentText: string) {
    const previousLines = previousText.split(/\r?\n/);
    const currentLines = currentText.split(/\r?\n/);
    const maxLength = Math.max(previousLines.length, currentLines.length);
    const diff: Array<{ type: 'added' | 'removed' | 'unchanged' | 'changed'; previous: string; current: string }> = [];

    for (let index = 0; index < maxLength; index += 1) {
      const previous = previousLines[index] ?? '';
      const current = currentLines[index] ?? '';

      if (previous === current) {
        diff.push({ type: 'unchanged', previous, current });
        continue;
      }

      if (!previous && current) {
        diff.push({ type: 'added', previous, current });
        continue;
      }

      if (previous && !current) {
        diff.push({ type: 'removed', previous, current });
        continue;
      }

      diff.push({ type: 'changed', previous, current });
    }

    return diff;
  }
}
