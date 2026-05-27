import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export interface CursorPageResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface CursorPaginateOptions {
  cursor?: string | null;
  limit?: number;
  /** 数据库列别名（含表别名前缀），例如 entity.created_at。 */
  orderColumn: string;
  /** 实体属性名，用于读取最后一行的游标值。 */
  orderProperty: string;
  direction?: 'ASC' | 'DESC';
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 20;

function clampLimit(limit?: number) {
  if (!Number.isFinite(limit ?? NaN)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit as number), 1), MAX_LIMIT);
}

export function encodeCursor(value: string | number | Date): string {
  const raw = value instanceof Date ? value.toISOString() : String(value);
  return Buffer.from(raw, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): string | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    return decoded || null;
  } catch {
    return null;
  }
}

export async function paginateByCursor<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  options: CursorPaginateOptions,
): Promise<CursorPageResult<T>> {
  const limit = clampLimit(options.limit);
  const direction = options.direction ?? 'DESC';

  if (options.cursor) {
    const decoded = decodeCursor(options.cursor);
    if (decoded) {
      const operator = direction === 'DESC' ? '<' : '>';
      queryBuilder.andWhere(`${options.orderColumn} ${operator} :cursor`, { cursor: decoded });
    }
  }

  const rows = await queryBuilder
    .orderBy(options.orderColumn, direction)
    .take(limit + 1)
    .getMany();

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const cursorValue = last ? (last as ObjectLiteral)[options.orderProperty] : null;
  const nextCursor = hasMore && cursorValue != null
    ? encodeCursor(cursorValue as string | number | Date)
    : null;

  return { items, nextCursor, hasMore };
}
