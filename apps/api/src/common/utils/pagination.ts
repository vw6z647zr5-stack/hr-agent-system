import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { ListQueryDto } from '../dto/list-query.dto';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export async function paginateQuery<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  query: ListQueryDto,
): Promise<PaginatedResult<T>> {
  const page = normalizePositiveInteger(query.page, 1, 1, 10_000);
  const limit = normalizePositiveInteger(query.limit, 10, 1, 100);
  const [items, total] = await queryBuilder.skip((page - 1) * limit).take(limit).getManyAndCount();

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

function normalizePositiveInteger(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(numeric), min), max);
}
