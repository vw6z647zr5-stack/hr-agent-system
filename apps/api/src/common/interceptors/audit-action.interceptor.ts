import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../audit/audit.service';
import {
  AUDIT_ACTION_METADATA,
  AuditActionOptions,
} from '../decorators/audit-action.decorator';
import { Logger } from '../logger';

interface RequestUser {
  id?: string;
  sub?: string;
}

@Injectable()
export class AuditActionInterceptor implements NestInterceptor {
  private readonly logger = Logger.for('AuditActionInterceptor');

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<AuditActionOptions | undefined>(
      AUDIT_ACTION_METADATA,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const args = context.getArgs();
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<{ user?: RequestUser }>();
    const userId = request?.user?.id ?? request?.user?.sub;

    return next.handle().pipe(
      tap((result) => {
        try {
          const entityId = this.resolveEntityId(options, args, result);
          const metadata = {
            riskLevel: options.riskLevel ?? 'low',
            ...(options.resolveMetadata?.(args, result) ?? {}),
          };

          if (userId) {
            this.auditService.logWithUser(userId, options.action, options.entityType, entityId ?? null, metadata);
          } else {
            this.auditService.log(options.action, options.entityType, entityId ?? null, metadata);
          }

          if (options.riskLevel === 'high') {
            this.logger.warn('high_risk_action', {
              action: options.action,
              entityType: options.entityType,
              entityId,
              userId,
            });
          }
        } catch (error) {
          this.logger.error('audit_emit_failed', error, {
            action: options.action,
            entityType: options.entityType,
          });
        }
      }),
    );
  }

  private resolveEntityId(
    options: AuditActionOptions,
    args: unknown[],
    result: unknown,
  ): string | null | undefined {
    if (options.resolveEntityId) {
      return options.resolveEntityId(args, result);
    }

    const first = args[0] as { id?: string } | string | undefined;
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'id' in first) return first.id;

    if (result && typeof result === 'object' && 'id' in (result as Record<string, unknown>)) {
      return (result as { id?: string }).id;
    }

    return null;
  }
}
