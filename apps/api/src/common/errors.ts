import { HttpException } from '@nestjs/common';

export interface AppErrorOptions {
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class AppError extends HttpException {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, statusCode: number, message: string, options: AppErrorOptions = {}) {
    super({ code, message, ...(options.details ? { details: options.details } : {}) }, statusCode);
    this.code = code;
    this.details = options.details;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export class ValidationError extends AppError {
  constructor(message = '请求参数校验失败。', details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', 400, message, { details });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const suffix = id ? `（${id}）` : '';
    super('NOT_FOUND', 404, `${resource}${suffix}不存在或已被删除。`, { details: { resource, id } });
  }
}

export class ConflictError extends AppError {
  constructor(message = '资源已存在或处于冲突状态。', details?: Record<string, unknown>) {
    super('CONFLICT', 409, message, { details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '未授权或登录已过期，请重新登录。') {
    super('UNAUTHORIZED', 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '当前账户没有权限执行此操作。') {
    super('FORBIDDEN', 403, message);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('BUSINESS_RULE', 422, message, { details });
  }
}

export class RateLimitError extends AppError {
  constructor(message = '请求过于频繁，请稍后再试。') {
    super('RATE_LIMITED', 429, message);
  }
}
