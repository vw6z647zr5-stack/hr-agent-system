import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { COMPANY_FACT_CATEGORIES, COMPANY_FACT_STATUSES } from './company-facts.service';
import { MANAGED_DOCUMENT_CATEGORIES, MANAGED_DOCUMENT_SCOPES, MANAGED_DOCUMENT_STATUSES } from './managed-document.utils';

export class KnowledgeArticleListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  publishedOnly?: boolean;
}

export class CreateKnowledgeArticleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  category!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @IsString()
  @IsNotEmpty()
  question!: string;

  @IsString()
  @IsNotEmpty()
  answer!: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateKnowledgeArticleDto extends CreateKnowledgeArticleDto {
  @IsOptional()
  declare category: string;

  @IsOptional()
  declare title: string;

  @IsOptional()
  declare question: string;

  @IsOptional()
  declare answer: string;
}

export class KnowledgeDocumentListQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(MANAGED_DOCUMENT_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsString()
  @IsIn(MANAGED_DOCUMENT_SCOPES)
  scope?: string;

  @IsOptional()
  @IsString()
  @IsIn(MANAGED_DOCUMENT_STATUSES)
  status?: string;
}

export class UpsertKnowledgeDocumentDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(MANAGED_DOCUMENT_CATEGORIES)
  category!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(MANAGED_DOCUMENT_SCOPES)
  scope!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(MANAGED_DOCUMENT_STATUSES)
  status!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  version!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  owner?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reviewer?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T/)
  submittedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  approvedBy?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T/)
  approvedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  approvalComment?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reviewNotes?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsString()
  @IsNotEmpty()
  body!: string;
}

export class DocumentImportPreviewDto {
  @IsOptional()
  @IsString()
  @IsIn(MANAGED_DOCUMENT_SCOPES)
  scope?: string;
}

export class BatchImportDocumentItemDto extends UpsertKnowledgeDocumentDto {}

export class BatchImportCommitDto {
  @IsArray()
  items!: BatchImportDocumentItemDto[];
}

export class ManagedDocumentHistoryComparisonQueryDto {
  @IsString()
  @IsNotEmpty()
  historyId!: string;
}

export class KnowledgeDiagnosticsQueryDto {
  @IsString()
  @IsNotEmpty()
  query!: string;
}

export class CompanyFactListQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(COMPANY_FACT_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsString()
  @IsIn(COMPANY_FACT_STATUSES)
  status?: string;
}

export class UpsertCompanyFactDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(COMPANY_FACT_CATEGORIES)
  category!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsString()
  @IsNotEmpty()
  @IsIn(COMPANY_FACT_STATUSES)
  status!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10000)
  sortOrder!: number;
}
