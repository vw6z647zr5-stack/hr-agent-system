import { Injectable } from '@nestjs/common';
import { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { isManagedDocumentPath, parseManagedDocumentFile } from './managed-document.utils';

type RagDocument = {
  id: string;
  title: string;
  sourcePath: string;
  category: string;
  content: string;
  status: string;
  version: string;
  owner: string;
  effectiveDate: string | null;
  tags: string[];
  updatedAt: string;
};

type RagChunk = {
  id: string;
  documentId: string;
  title: string;
  sourcePath: string;
  category: string;
  content: string;
  section: string;
  owner: string;
  version: string;
  tags: string[];
};

export interface RagReference {
  id: string;
  title: string;
  sourcePath: string;
  category: string;
  section: string;
  excerpt: string;
  score: number;
}

@Injectable()
export class DocumentRagService {
  private readonly docsRoot = join(process.cwd(), 'docs');
  private cachedDocuments: RagDocument[] | null = null;
  private cachedChunks: RagChunk[] | null = null;
  private lastLoadedAt = 0;
  private readonly cacheTtlMs = 60_000;

  async search(query: string, limit = 5): Promise<RagReference[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return [];
    }

    const chunks = await this.loadChunks();
    const queryTerms = this.tokenize(normalizedQuery);

    const ranked = chunks
      .map((chunk) => {
        const haystack = `${chunk.title} ${chunk.category} ${chunk.section} ${chunk.owner} ${chunk.version} ${chunk.tags.join(' ')} ${chunk.content}`.toLowerCase();
        const termMatches = queryTerms.reduce((sum, term) => sum + this.countOccurrences(haystack, term), 0);
        const phraseBonus = haystack.includes(normalizedQuery.toLowerCase()) ? 6 : 0;
        const categoryBonus = queryTerms.some((term) => chunk.category.toLowerCase().includes(term)) ? 2 : 0;
        const titleBonus = queryTerms.some((term) => chunk.title.toLowerCase().includes(term)) ? 3 : 0;
        const score = termMatches + phraseBonus + categoryBonus + titleBonus;

        return { chunk, score };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.chunk.sourcePath.localeCompare(right.chunk.sourcePath))
      .slice(0, limit);

    return ranked.map(({ chunk, score }) => ({
      id: chunk.id,
      title: chunk.title,
      sourcePath: chunk.sourcePath,
      category: chunk.category,
      section: chunk.section,
      excerpt: this.buildExcerpt(chunk.content, queryTerms),
      score,
    }));
  }

  async listSources() {
    const documents = await this.loadDocuments();
    return documents
      .map((document) => ({
        title: document.title,
        sourcePath: document.sourcePath,
        category: document.category,
        status: document.status,
        version: document.version,
        owner: document.owner,
        effectiveDate: document.effectiveDate,
        tags: document.tags,
        updatedAt: document.updatedAt,
      }))
      .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  }

  invalidateCache() {
    this.cachedDocuments = null;
    this.cachedChunks = null;
    this.lastLoadedAt = 0;
  }

  private async loadDocuments() {
    const now = Date.now();
    if (this.cachedDocuments && now - this.lastLoadedAt < this.cacheTtlMs) {
      return this.cachedDocuments;
    }

    this.cachedDocuments = await this.readMarkdownDocuments(this.docsRoot);
    this.cachedChunks = this.cachedDocuments.flatMap((document) => this.chunkDocument(document));
    this.lastLoadedAt = now;
    return this.cachedDocuments;
  }

  private async loadChunks() {
    if (!this.cachedChunks) {
      await this.loadDocuments();
    }

    return this.cachedChunks ?? [];
  }

  private async readMarkdownDocuments(root: string): Promise<RagDocument[]> {
    let entries: Dirent[];
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      return [];
    }

    const documents: RagDocument[] = [];

    for (const entry of entries) {
      const fullPath = join(root, entry.name);
      const relativePath = relative(process.cwd(), fullPath).replaceAll('\\', '/');

      if (entry.isDirectory()) {
        if (this.shouldIgnorePath(relativePath)) {
          continue;
        }

        documents.push(...(await this.readMarkdownDocuments(fullPath)));
        continue;
      }

      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) {
        continue;
      }

      if (this.shouldIgnorePath(relativePath)) {
        continue;
      }

      const sourcePath = relativePath;
      const file = await this.readMarkdownFile(fullPath);
      if (!file) {
        continue;
      }

      if (isManagedDocumentPath(sourcePath)) {
        const parsed = parseManagedDocumentFile(sourcePath, file.content, basename(fullPath, '.md'));
        if (!this.isManagedDocumentVisible(parsed.metadata.status, parsed.metadata.effectiveDate)) {
          continue;
        }

        documents.push({
          id: sourcePath,
          title: parsed.metadata.title,
          sourcePath,
          category: parsed.metadata.category,
          content: parsed.editableBody || parsed.markdownBody,
          status: parsed.metadata.status,
          version: parsed.metadata.version,
          owner: parsed.metadata.owner,
          effectiveDate: parsed.metadata.effectiveDate,
          tags: parsed.metadata.tags,
          updatedAt: file.updatedAt,
        });
        continue;
      }

      documents.push({
        id: sourcePath,
        title: this.extractTitle(file.content) ?? entry.name.replace(/\.md$/i, ''),
        sourcePath,
        category: this.inferCategory(sourcePath),
        content: file.content,
        status: 'published',
        version: '1.0.0',
        owner: '',
        effectiveDate: null,
        tags: [],
        updatedAt: file.updatedAt,
      });
    }

    return documents;
  }

  private async readMarkdownFile(fullPath: string) {
    try {
      const [content, fileStats] = await Promise.all([readFile(fullPath, 'utf8'), stat(fullPath)]);
      return {
        content,
        updatedAt: fileStats.mtime.toISOString(),
      };
    } catch {
      return null;
    }
  }

  private chunkDocument(document: RagDocument): RagChunk[] {
    const lines = document.content.split(/\r?\n/);
    const chunks: RagChunk[] = [];
    let currentSection = document.title;
    let buffer: string[] = [];
    let index = 0;

    const flush = () => {
      const content = buffer.join('\n').trim();
      if (!content) {
        return;
      }

      chunks.push({
        id: `${document.id}#${index}`,
        documentId: document.id,
        title: document.title,
        sourcePath: document.sourcePath,
        category: document.category,
        section: currentSection,
        content,
        owner: document.owner,
        version: document.version,
        tags: document.tags,
      });
      index += 1;
      buffer = [];
    };

    for (const line of lines) {
      if (/^##\s+/.test(line)) {
        flush();
        currentSection = line.replace(/^##\s+/, '').trim();
        continue;
      }

      buffer.push(line);
    }

    flush();

    return chunks.length > 0
      ? chunks
      : [
          {
            id: `${document.id}#0`,
            documentId: document.id,
            title: document.title,
            sourcePath: document.sourcePath,
            category: document.category,
            section: document.title,
            content: document.content.trim(),
            owner: document.owner,
            version: document.version,
            tags: document.tags,
          },
        ];
  }

  private isManagedDocumentVisible(status: string, effectiveDate: string | null) {
    if (status !== 'published') {
      return false;
    }

    if (!effectiveDate) {
      return true;
    }

    return effectiveDate <= new Date().toISOString().slice(0, 10);
  }

  private tokenize(input: string) {
    const compact = input.toLowerCase().trim();
    const words = compact.split(/[\s,，。；：:、/()（）\-]+/).filter((item) => item.length >= 2);
    const cjkTerms = (compact.match(/[\u4e00-\u9fff]{2,}/g) ?? []).flatMap((term) => this.expandCjkTerms(term));
    const expandedTerms = [...words, ...cjkTerms].flatMap((term) => this.expandDomainTerms(term));
    return Array.from(new Set(expandedTerms));
  }

  private countOccurrences(haystack: string, needle: string) {
    if (!needle) {
      return 0;
    }

    let count = 0;
    let start = 0;

    while (true) {
      const index = haystack.indexOf(needle, start);
      if (index === -1) {
        return count;
      }

      count += 1;
      start = index + needle.length;
    }
  }

  private buildExcerpt(content: string, queryTerms: string[]) {
    const normalized = content.replace(/\s+/g, ' ').trim();
    const firstMatchedTerm = queryTerms.find((term) => normalized.toLowerCase().includes(term));

    if (!firstMatchedTerm) {
      return normalized.slice(0, 180);
    }

    const index = normalized.toLowerCase().indexOf(firstMatchedTerm);
    const start = Math.max(0, index - 40);
    const end = Math.min(normalized.length, index + 120);
    return normalized.slice(start, end).trim();
  }

  private extractTitle(content: string) {
    const firstHeading = content.split(/\r?\n/).find((line) => /^#\s+/.test(line));
    return firstHeading ? firstHeading.replace(/^#\s+/, '').trim() : null;
  }

  private inferCategory(sourcePath: string) {
    if (sourcePath.includes('/policies/')) {
      return 'policy_document';
    }

    if (sourcePath.includes('/company/')) {
      return 'company_profile';
    }

    if (sourcePath.includes('company-profile')) {
      return 'company_profile';
    }

    if (sourcePath.includes('architecture')) {
      return 'architecture';
    }

    return 'general_document';
  }

  private shouldIgnorePath(relativePath: string) {
    return relativePath.includes('/samples/') || relativePath.includes('/.history/');
  }

  private expandCjkTerms(value: string) {
    const terms = new Set<string>([value]);
    const maxLength = Math.min(value.length, 4);

    for (let size = 2; size <= maxLength; size += 1) {
      for (let index = 0; index <= value.length - size; index += 1) {
        terms.add(value.slice(index, index + size));
      }
    }

    return Array.from(terms);
  }

  private expandDomainTerms(value: string) {
    const synonyms: Record<string, string[]> = {
      公司: ['企业', '单位', '组织'],
      企业: ['公司', '组织'],
      基础信息: ['公司信息', '企业信息', '概况'],
      公司信息: ['基础信息', '企业信息', '公司概况'],
      办公: ['办公地点', '办公时间', '办公模式'],
      上班: ['工作时间', '出勤', '考勤'],
      工作时间: ['上班时间', '办公时间'],
      考勤: ['打卡', '迟到', '早退'],
      打卡: ['考勤', '上班', '下班'],
      请假: ['休假', '假期', '年假', '病假'],
      假期: ['请假', '休假', '年假'],
      年假: ['假期', '请假', '休假'],
      加班: ['延时工作', '调休'],
      薪资: ['工资', '薪酬', '工资单'],
      工资: ['薪资', '薪酬', '工资单'],
      薪酬: ['薪资', '工资', '工资单'],
      工资单: ['薪资', '工资', '发薪'],
      福利: ['补贴', '津贴', '保险'],
      试用期: ['转正', '入职'],
      转正: ['试用期', '晋升'],
      报销: ['差旅', '费用', ' reimbursement '],
      差旅: ['报销', '出差'],
      安全: ['信息安全', '数据安全', '保密'],
      保密: ['信息安全', '数据安全'],
      招聘: ['面试', '候选人', '录用'],
    };

    const results = new Set<string>([value]);

    for (const [key, related] of Object.entries(synonyms)) {
      if (value.includes(key) || key.includes(value)) {
        related.forEach((item) => results.add(item.toLowerCase()));
      }
    }

    return Array.from(results).filter((item) => item.trim().length >= 2);
  }
}
