import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

interface TenantStore {
  companyId?: string;
}

const storage = new AsyncLocalStorage<TenantStore>();

@Injectable()
export class TenantContext {
  run(fn: () => void) {
    storage.run({}, fn);
  }

  setCompanyId(id: string) {
    const store = storage.getStore();
    if (store) {
      store.companyId = id;
    }
  }

  getCompanyId(): string {
    const store = storage.getStore();
    if (!store?.companyId) {
      throw new InternalServerErrorException('租户上下文未初始化');
    }
    return store.companyId;
  }

  getCompanyIdOrNull(): string | null {
    return storage.getStore()?.companyId ?? null;
  }
}
