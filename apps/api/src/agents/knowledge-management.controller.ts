import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Roles } from '../common/decorators/roles.decorator';
import {
  MAX_DOCUMENT_IMPORT_BATCH_COUNT,
  MAX_DOCUMENT_IMPORT_UPLOAD_SIZE_BYTES,
} from '../common/upload-limits';
import { Role } from '../users/user.entity';
import {
  CompanyFactListQueryDto,
  CreateKnowledgeArticleDto,
  BatchImportCommitDto,
  KnowledgeDiagnosticsQueryDto,
  KnowledgeArticleListQueryDto,
  KnowledgeDocumentListQueryDto,
  ManagedDocumentHistoryComparisonQueryDto,
  UpsertCompanyFactDto,
  UpsertKnowledgeDocumentDto,
  UpdateKnowledgeArticleDto,
} from './knowledge-management.dto';
import { CompanyFactsService } from './company-facts.service';
import { DocumentImportService } from './document-import.service';
import { KnowledgeManagementService } from './knowledge-management.service';

@Controller('knowledge-management')
@Roles(Role.ADMIN, Role.HR)
export class KnowledgeManagementController {
  constructor(
    private readonly knowledgeManagementService: KnowledgeManagementService,
    private readonly companyFactsService: CompanyFactsService,
    private readonly documentImportService: DocumentImportService,
  ) {}

  @Get('articles')
  listArticles(@Query() query: KnowledgeArticleListQueryDto) {
    return this.knowledgeManagementService.listArticles(query);
  }

  @Get('articles/:id')
  getArticle(@Param('id') id: string) {
    return this.knowledgeManagementService.getArticle(id);
  }

  @Post('articles')
  createArticle(@Body() payload: CreateKnowledgeArticleDto) {
    return this.knowledgeManagementService.createArticle(payload);
  }

  @Patch('articles/:id')
  updateArticle(@Param('id') id: string, @Body() payload: UpdateKnowledgeArticleDto) {
    return this.knowledgeManagementService.updateArticle(id, payload);
  }

  @Delete('articles/:id')
  removeArticle(@Param('id') id: string) {
    return this.knowledgeManagementService.removeArticle(id);
  }

  @Get('documents')
  listDocuments(@Query() query: KnowledgeDocumentListQueryDto) {
    return this.knowledgeManagementService.listManagedDocuments(query);
  }

  @Get('documents/:id')
  getDocument(@Param('id') id: string) {
    return this.knowledgeManagementService.getManagedDocument(decodeDocumentId(id));
  }

  @Get('documents/:id/history')
  getDocumentHistory(@Param('id') id: string) {
    return this.knowledgeManagementService.listManagedDocumentHistory(decodeDocumentId(id));
  }

  @Get('documents/:id/diff')
  getDocumentDiff(@Param('id') id: string, @Query() query: ManagedDocumentHistoryComparisonQueryDto) {
    return this.knowledgeManagementService.compareManagedDocumentWithHistory(
      decodeDocumentId(id),
      query.historyId,
    );
  }

  @Post('documents')
  createDocument(@Body() payload: UpsertKnowledgeDocumentDto) {
    return this.knowledgeManagementService.upsertManagedDocument(payload);
  }

  @Post('document-imports/batch-commit')
  createDocumentsBatch(@Body() payload: BatchImportCommitDto) {
    return this.knowledgeManagementService.upsertManagedDocumentsBatch(payload.items);
  }

  @Patch('documents/:id')
  updateDocument(@Param('id') id: string, @Body() payload: UpsertKnowledgeDocumentDto) {
    return this.knowledgeManagementService.upsertManagedDocument(payload, decodeDocumentId(id));
  }

  @Delete('documents/:id')
  removeDocument(@Param('id') id: string) {
    return this.knowledgeManagementService.removeManagedDocument(decodeDocumentId(id));
  }

  @Post('document-imports/preview')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_IMPORT_UPLOAD_SIZE_BYTES } }),
  )
  previewDocumentImport(@UploadedFile() file: Express.Multer.File) {
    return this.documentImportService.previewImport(file);
  }

  @Post('document-imports/batch-preview')
  @UseInterceptors(
    FilesInterceptor('files', MAX_DOCUMENT_IMPORT_BATCH_COUNT, {
      limits: { fileSize: MAX_DOCUMENT_IMPORT_UPLOAD_SIZE_BYTES },
    }),
  )
  previewDocumentImports(@UploadedFiles() files: Express.Multer.File[]) {
    return this.documentImportService.previewBatchImport(files);
  }

  @Get('diagnostics/document-search')
  runDocumentSearchDiagnostics(@Query() query: KnowledgeDiagnosticsQueryDto) {
    return this.knowledgeManagementService.runDocumentSearchDiagnostics(query.query);
  }

  @Get('company-facts')
  listCompanyFacts(@Query() query: CompanyFactListQueryDto) {
    return this.companyFactsService.listFacts(query);
  }

  @Get('company-facts/:id')
  getCompanyFact(@Param('id') id: string) {
    return this.companyFactsService.getFact(id);
  }

  @Post('company-facts')
  createCompanyFact(@Body() payload: UpsertCompanyFactDto) {
    return this.companyFactsService.createFact({
      category: payload.category as never,
      label: payload.label,
      value: payload.value,
      description: payload.description ?? '',
      source: payload.source ?? '',
      tags: payload.tags ?? [],
      status: payload.status as never,
      sortOrder: Number(payload.sortOrder ?? 0),
    });
  }

  @Patch('company-facts/:id')
  updateCompanyFact(@Param('id') id: string, @Body() payload: UpsertCompanyFactDto) {
    return this.companyFactsService.updateFact(id, {
      category: payload.category as never,
      label: payload.label,
      value: payload.value,
      description: payload.description ?? '',
      source: payload.source ?? '',
      tags: payload.tags ?? [],
      status: payload.status as never,
      sortOrder: Number(payload.sortOrder ?? 0),
    });
  }

  @Delete('company-facts/:id')
  removeCompanyFact(@Param('id') id: string) {
    return this.companyFactsService.removeFact(id);
  }
}

function decodeDocumentId(id: string) {
  try {
    return decodeURIComponent(id);
  } catch {
    throw new BadRequestException('文档路径参数不合法。');
  }
}
