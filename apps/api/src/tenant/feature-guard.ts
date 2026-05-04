import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyService } from '../company/company.service';

export const FEATURE_KEY = 'requiredFeature';

export function RequireFeature(feature: string) {
  return (target: object, key?: string | symbol, descriptor?: TypedPropertyDescriptor<any>) => {
    Reflect.defineMetadata(FEATURE_KEY, feature, descriptor?.value ?? target);
  };
}

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly companyService: CompanyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.get<string>(FEATURE_KEY, context.getHandler());
    if (!featureKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const companyId = request.user?.companyId;
    if (!companyId) {
      return true;
    }

    const enabled = await this.companyService.checkFeatureEnabled(companyId, featureKey);
    if (!enabled) {
      throw new ForbiddenException('当前试用套餐不支持该功能，请联系管理员升级。');
    }

    return true;
  }
}
