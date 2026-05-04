import { Global, Module } from '@nestjs/common';
import { TenantContext } from './tenant.context';
import { TenantInterceptor } from './tenant.interceptor';
import { TenantMiddleware } from './tenant.middleware';

@Global()
@Module({
  providers: [TenantContext, TenantInterceptor, TenantMiddleware],
  exports: [TenantContext],
})
export class TenantModule {}
