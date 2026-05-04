import { BadRequestException, Injectable } from '@nestjs/common';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { basename, extname } from 'node:path';
import { MAX_DOCUMENT_IMPORT_UPLOAD_SIZE_BYTES } from '../common/upload-limits';
import {
  MANAGED_DOCUMENT_SCOPES,
  normalizeManagedDocumentSlug,
  type ManagedDocumentScope,
} from './managed-document.utils';

const allowedExtensions = new Set(['.pdf', '.docx', '.md', '.txt']);
const allowedTextMimeTypes = new Set(['text/plain', 'text/markdown', 'application/octet-stream']);
const scopeKeywordMap: Array<{ keyword: string; scope: ManagedDocumentScope }> = [
  { keyword: '制度', scope: 'docs/policies/managed' },
  { keyword: '规定', scope: 'docs/policies/managed' },
  { keyword: '规范', scope: 'docs/policies/managed' },
  { keyword: '流程', scope: 'docs/policies/managed' },
  { keyword: '手册', scope: 'docs/policies/managed' },
  { keyword: '员工', scope: 'docs/policies/managed' },
];
const categoryKeywordMap: Array<{ keyword: string; category: string }> = [
  { keyword: '制度', category: 'policy_document' },
  { keyword: '规定', category: 'policy_document' },
  { keyword: '规范', category: 'policy_document' },
  { keyword: '流程', category: 'policy_document' },
  { keyword: '公司', category: 'company_profile' },
  { keyword: '组织', category: 'company_profile' },
  { keyword: '概况', category: 'company_profile' },
  { keyword: '简介', category: 'company_profile' },
];

export interface DocumentImportPreviewResult {
  sourceFileName: string;
  detectedTitle: string;
  suggestedSlug: string;
  suggestedScope: ManagedDocumentScope;
  suggestedCategory: 'policy_document' | 'company_profile' | 'general_document';
  cleanedMarkdown: string;
  warnings: string[];
}

@Injectable()
export class DocumentImportService {
  async previewImport(file: Express.Multer.File): Promise<DocumentImportPreviewResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请先上传文件。');
    }

    if (file.size > MAX_DOCUMENT_IMPORT_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException('导入文件大小不能超过 20MB。');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension) || !this.hasValidFileSignature(file, extension)) {
      throw new BadRequestException('仅支持导入 PDF、DOCX、Markdown 和 TXT 文件。');
    }

    const rawText = await this.extractText(file, extension);
    const cleanedText = this.normalizeRawText(rawText);
    if (!cleanedText) {
      throw new BadRequestException('上传文档未包含可读取的文本内容。');
    }

    const detectedTitle = this.detectTitle(cleanedText, file.originalname);
    const suggestedScope = this.suggestScope(detectedTitle, cleanedText);
    const suggestedCategory = this.suggestCategory(detectedTitle, cleanedText, suggestedScope);
    const cleanedMarkdown = this.toMarkdown(cleanedText, detectedTitle);
    const warnings = this.buildWarnings(cleanedText, cleanedMarkdown);

    return {
      sourceFileName: file.originalname,
      detectedTitle,
      suggestedSlug: normalizeManagedDocumentSlug(detectedTitle || basename(file.originalname, extension)) || '导入文档',
      suggestedScope,
      suggestedCategory,
      cleanedMarkdown,
      warnings,
    };
  }

  async previewBatchImport(files: Express.Multer.File[]): Promise<DocumentImportPreviewResult[]> {
    if (!Array.isArray(files) || files.length === 0) {
      throw new BadRequestException('请至少上传一个文件。');
    }

    return Promise.all(files.map((file) => this.previewImport(file)));
  }

  private async extractText(file: Express.Multer.File, extension: string) {
    try {
      if (file.mimetype.includes('pdf') || extension === '.pdf') {
        const result = await pdfParse(file.buffer);
        return result.text;
      }

      if (
        file.mimetype.includes('word') ||
        file.mimetype.includes('officedocument') ||
        extension === '.docx'
      ) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return result.value;
      }

      return file.buffer.toString('utf8');
    } catch (error) {
      throw new BadRequestException('文档导入解析失败，请确认文件内容可读取。');
    }
  }

  private hasValidFileSignature(file: Express.Multer.File, extension: string) {
    if (extension === '.pdf') {
      return file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    }

    if (extension === '.docx') {
      return file.buffer[0] === 0x50 && file.buffer[1] === 0x4b && file.buffer[2] === 0x03 && file.buffer[3] === 0x04;
    }

    if (extension === '.md' || extension === '.txt') {
      return allowedTextMimeTypes.has(file.mimetype) && !file.buffer.includes(0);
    }

    return false;
  }

  private normalizeRawText(text: string) {
    return text
      .replace(/\u0000/g, ' ')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[•●▪◦]/g, '- ')
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map((line) => line.trim())
      .filter((line, index, lines) => !(line === '' && lines[index - 1] === ''))
      .join('\n')
      .trim();
  }

  private detectTitle(text: string, fileName: string) {
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const heading = lines.find((line) => /^#/.test(line))?.replace(/^#+\s*/, '').trim();
    if (heading) {
      return heading;
    }

    const candidate = lines.find((line) => line.length >= 4 && line.length <= 40 && !/^[-*]\s+/.test(line));
    if (candidate) {
      return candidate.replace(/[:：]\s*$/, '');
    }

    return basename(fileName, extname(fileName));
  }

  private suggestScope(title: string, text: string): ManagedDocumentScope {
    const combined = `${title}\n${text}`.toLowerCase();
    const matched = scopeKeywordMap.find((item) => combined.includes(item.keyword.toLowerCase()));
    return matched?.scope ?? MANAGED_DOCUMENT_SCOPES[1];
  }

  private suggestCategory(title: string, text: string, scope: ManagedDocumentScope) {
    const combined = `${title}\n${text}`.toLowerCase();
    const matched = categoryKeywordMap.find((item) => combined.includes(item.keyword.toLowerCase()));

    if (matched?.category) {
      return matched.category as 'policy_document' | 'company_profile' | 'general_document';
    }

    if (scope === 'docs/policies/managed') {
      return 'policy_document';
    }

    if (scope === 'docs/company/managed') {
      return 'company_profile';
    }

    return 'general_document';
  }

  private toMarkdown(text: string, title: string) {
    const lines = text.split('\n').map((line) => line.trim());
    const normalizedTitle = title.trim();
    const bodyLines: string[] = [];

    for (const rawLine of lines) {
      if (!rawLine) {
        if (bodyLines[bodyLines.length - 1] !== '') {
          bodyLines.push('');
        }
        continue;
      }

      const line = rawLine.replace(/^#+\s*/, '');
      if (line === normalizedTitle) {
        continue;
      }

      if (/^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
        bodyLines.push(line.replace(/^\d+[.)]\s+/, '- '));
        continue;
      }

      if (/[:：]$/.test(line) && line.length <= 24) {
        bodyLines.push(`## ${line.replace(/[:：]$/, '')}`);
        continue;
      }

      if (line.length <= 22 && /[管理制度流程规定指南办法守则简介概况手册规则方案]/.test(line)) {
        bodyLines.push(`## ${line}`);
        continue;
      }

      bodyLines.push(line);
    }

    const compacted = this.mergeWrappedParagraphs(bodyLines);
    return compacted.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  private mergeWrappedParagraphs(lines: string[]) {
    const output: string[] = [];

    for (const line of lines) {
      if (!line) {
        if (output[output.length - 1] !== '') {
          output.push('');
        }
        continue;
      }

      if (!output.length) {
        output.push(line);
        continue;
      }

      const previous = output[output.length - 1] ?? '';
      const currentStartsBlock = /^##\s+/.test(line) || /^[-*]\s+/.test(line);
      const previousEndsBlock = previous === '' || /^##\s+/.test(previous) || /^[-*]\s+/.test(previous);
      const shouldJoin =
        !currentStartsBlock &&
        !previousEndsBlock &&
        !/[。！？.!?:：]$/.test(previous) &&
        line.length < 70;

      if (shouldJoin) {
        output[output.length - 1] = `${previous} ${line}`.replace(/\s+/g, ' ').trim();
      } else {
        output.push(line);
      }
    }

    return output;
  }

  private buildWarnings(rawText: string, markdown: string) {
    const warnings: string[] = [];

    if (rawText.length < 80) {
      warnings.push('导入文本较短，请确认识别结果或源文件格式是否完整。');
    }

    if (!markdown.includes('## ') && !markdown.includes('- ')) {
      warnings.push('未检测到清晰标题或项目列表，发布前请复核清洗后的正文。');
    }

    if (/[^\x00-\x7F\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(rawText)) {
      warnings.push('文档中保留了部分特殊字符，保存前请确认预览显示正常。');
    }

    return warnings;
  }
}
