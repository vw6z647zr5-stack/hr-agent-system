import type { FindOptionsWhere, ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export function tenantWhere<T extends ObjectLiteral>(
  companyId: string,
  extra?: FindOptionsWhere<T>,
): FindOptionsWhere<T> {
  return { companyId, ...extra } as unknown as FindOptionsWhere<T>;
}

export function applyTenantScope<T extends ObjectLiteral>(
  companyId: string,
  repoAlias: string,
  qb: SelectQueryBuilder<T>,
) {
  return qb.andWhere(`${repoAlias}.company_id = :_tenantCompanyId`, {
    _tenantCompanyId: companyId,
  });
}
