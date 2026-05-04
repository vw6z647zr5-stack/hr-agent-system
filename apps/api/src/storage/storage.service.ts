import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { MAX_PHOTO_UPLOAD_SIZE_BYTES, MAX_RESUME_UPLOAD_SIZE_BYTES } from '../common/upload-limits';
import { repairTextEncoding } from '../common/utils/text-encoding';
import { getFileStorageRoot } from '../config/security';
import { buildSampleResumeDocxBuffer, buildTechCompanyProfileMarkdown } from './sample-documents';

const allowedResumeExtensions = new Set(['.pdf', '.docx']);
const allowedResumeMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
]);
const allowedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedTextFileExtensions = new Set(['.md', '.txt', '.json']);
const maxSafeFileNameLength = 140;

function startsWithBytes(buffer: Buffer, bytes: number[]) {
  return bytes.every((byte, index) => buffer[index] === byte);
}

@Injectable()
export class StorageService {
  private readonly root = resolve(process.cwd(), getFileStorageRoot());
  private readonly publicUploadsRoot = this.root;

  async saveUploadedFile(file: Express.Multer.File, folder: string): Promise<{ relativePath: string; absolutePath: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请先上传简历文件。');
    }

    if (file.size > MAX_RESUME_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException('简历文件大小不能超过 15MB。');
    }

    const originalName = repairTextEncoding(file.originalname);
    const extension = extname(originalName).toLowerCase();

    if (!allowedResumeExtensions.has(extension) || !allowedResumeMimeTypes.has(file.mimetype) || !this.hasValidResumeSignature(file.buffer, extension)) {
      throw new BadRequestException('仅支持上传 PDF 和 DOCX 格式的简历文件。');
    }

    const targetDir = this.resolveInsideRoot(folder, this.root);
    await mkdir(targetDir, { recursive: true });

    const safeName = this.buildStoredFileName(originalName, extension);
    const absolutePath = this.resolveInsideRoot(join(folder, safeName), this.root);
    const relativePath = join('uploads', folder, safeName).replaceAll('\\', '/');

    await writeFile(absolutePath, file.buffer);

    return { absolutePath, relativePath };
  }

  async saveUserPhoto(file: Express.Multer.File, userId: string): Promise<{ relativePath: string; absolutePath: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请选择要上传的照片。');
    }

    const originalName = repairTextEncoding(file.originalname);
    const extension = extname(originalName).toLowerCase();

    if (!allowedImageExtensions.has(extension) || !allowedImageMimeTypes.has(file.mimetype) || !this.hasValidImageSignature(file.buffer, extension)) {
      throw new BadRequestException('仅支持 JPG、PNG 或 WebP 格式的照片。');
    }

    if (file.size > MAX_PHOTO_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException('照片大小不能超过 5MB。');
    }

    const safeUserId = this.sanitizePathSegment(userId);
    const targetDir = this.resolveInsideRoot(join('user-photos', safeUserId), this.root);
    await mkdir(targetDir, { recursive: true });

    const safeName = this.buildStoredFileName(originalName, extension);
    const absolutePath = this.resolveInsideRoot(join('user-photos', safeUserId, safeName), this.root);
    const relativePath = join('uploads', 'user-photos', safeUserId, safeName).replaceAll('\\', '/');

    await writeFile(absolutePath, file.buffer);

    return { absolutePath, relativePath };
  }

  async ensurePdfPlaceholder(relativePath: string): Promise<string> {
    const normalizedPath = this.normalizeRelativePath(relativePath);
    this.assertAllowedExtension(normalizedPath, new Set(['.pdf']));
    const absolutePath = this.resolveAbsolutePath(normalizedPath);

    await mkdir(dirname(absolutePath), { recursive: true });

    try {
      await access(absolutePath);
      return absolutePath;
    } catch {
      await writeFile(absolutePath, this.buildPdfBuffer());
      return absolutePath;
    }
  }

  async ensureDocxPlaceholder(relativePath: string): Promise<string> {
    const normalizedPath = this.normalizeRelativePath(relativePath);
    this.assertAllowedExtension(normalizedPath, new Set(['.docx']));
    const absolutePath = this.resolveAbsolutePath(normalizedPath);

    await mkdir(dirname(absolutePath), { recursive: true });

    try {
      await access(absolutePath);
      return absolutePath;
    } catch {
      await writeFile(absolutePath, await buildSampleResumeDocxBuffer());
      return absolutePath;
    }
  }

  async ensureTextFile(relativePath: string, content: string): Promise<string> {
    const normalizedPath = this.normalizeRelativePath(relativePath);
    this.assertAllowedExtension(normalizedPath, allowedTextFileExtensions);
    const absolutePath = this.resolveAbsolutePath(normalizedPath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');
    return absolutePath;
  }

  async ensureTechCompanyProfile(relativePath = 'uploads/supporting/tech-company-profile.md') {
    return this.ensureTextFile(relativePath, buildTechCompanyProfileMarkdown());
  }

  async readStoredFile(relativePath: string): Promise<{ absolutePath: string; buffer: Buffer }> {
    const normalizedPath = this.normalizeRelativePath(relativePath);
    const absolutePath = this.resolveAbsolutePath(normalizedPath);

    try {
      const buffer = await readFile(absolutePath);
      return { absolutePath, buffer };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('未找到文件附件。');
      }

      throw error;
    }
  }

  async prepareDownload(relativePath: string, fileName?: string) {
    const normalizedPath = this.normalizeRelativePath(relativePath);
    const { absolutePath, buffer } = await this.readStoredFile(normalizedPath);
    const resolvedFileName = fileName?.trim() || basename(normalizedPath);

    return {
      absolutePath,
      buffer,
      fileName: resolvedFileName,
      contentType: this.getContentType(resolvedFileName),
    };
  }

  private resolveAbsolutePath(relativePath: string) {
    if (isAbsolute(relativePath)) {
      throw new BadRequestException('文件路径不合法。');
    }

    if (relativePath.startsWith('uploads/')) {
      return this.resolveInsideRoot(relativePath.slice('uploads/'.length), this.publicUploadsRoot);
    }

    return this.resolveInsideRoot(relativePath, this.root);
  }

  private normalizeRelativePath(relativePath: string) {
    if (typeof relativePath !== 'string') {
      throw new BadRequestException('文件路径不合法。');
    }

    const normalized = relativePath.replaceAll('\\', '/').replace(/^\/+/, '').trim();
    const segments = normalized.split('/');

    if (
      !normalized ||
      normalized.length > 260 ||
      /[\u0000-\u001f]/.test(normalized) ||
      segments.some((segment) => !segment || segment === '.' || segment === '..')
    ) {
      throw new BadRequestException('文件路径不合法。');
    }

    return normalized;
  }

  private resolveInsideRoot(relativePath: string, root: string) {
    if (isAbsolute(relativePath)) {
      throw new BadRequestException('文件路径不合法。');
    }

    const normalized = this.normalizeRelativePath(relativePath);
    const absolutePath = resolve(root, normalized);
    const relativeToRoot = relative(root, absolutePath);

    if (relativeToRoot && (relativeToRoot.startsWith('..') || isAbsolute(relativeToRoot))) {
      throw new BadRequestException('文件路径不合法。');
    }

    return absolutePath;
  }

  private buildStoredFileName(originalName: string, fallbackExtension: string) {
    const candidate = basename(originalName || `file${fallbackExtension}`)
      .replace(/[^\w.\-\u4e00-\u9fff]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^\.+|\.+$/g, '');
    const safeName = candidate || `file${fallbackExtension}`;
    const extension = (extname(safeName) || fallbackExtension).toLowerCase();
    const stem = basename(safeName, extname(safeName) || fallbackExtension)
      .replace(/^\.+|\.+$/g, '')
      .slice(0, maxSafeFileNameLength) || 'file';

    return `${Date.now()}-${randomBytes(8).toString('hex')}-${stem}${extension}`;
  }

  private sanitizePathSegment(value: string) {
    return value.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'unknown';
  }

  private assertAllowedExtension(relativePath: string, allowedExtensions: Set<string>) {
    if (!allowedExtensions.has(extname(relativePath).toLowerCase())) {
      throw new BadRequestException('文件路径格式不合法。');
    }
  }

  private getContentType(fileName: string) {
    const extension = extname(fileName).toLowerCase();

    if (extension === '.pdf') {
      return 'application/pdf';
    }

    if (extension === '.doc') {
      return 'application/msword';
    }

    if (extension === '.docx') {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    if (extension === '.md') {
      return 'text/markdown; charset=utf-8';
    }

    return 'application/octet-stream';
  }

  private hasValidResumeSignature(buffer: Buffer, extension: string) {
    if (extension === '.pdf') {
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    }

    if (extension === '.docx') {
      return startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04]);
    }

    return false;
  }

  private hasValidImageSignature(buffer: Buffer, extension: string) {
    if (extension === '.jpg' || extension === '.jpeg') {
      return startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
    }

    if (extension === '.png') {
      return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    }

    if (extension === '.webp') {
      return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    }

    return false;
  }

  private buildPdfBuffer() {
    const content = '';
    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>\nendobj',
      `4 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream\nendobj`,
    ];

    let output = '%PDF-1.4\n';
    const offsets = [0];

    for (const object of objects) {
      offsets.push(Buffer.byteLength(output, 'utf8'));
      output += `${object}\n`;
    }

    const startXref = Buffer.byteLength(output, 'utf8');
    output += `xref\n0 ${objects.length + 1}\n`;
    output += '0000000000 65535 f \n';
    output += offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, '0')} 00000 n `)
      .join('\n');
    output += `\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

    return Buffer.from(output, 'utf8');
  }
}
