import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const requestIdHeader = 'x-request-id';
const requestIdPattern = /^[a-zA-Z0-9._:-]{8,128}$/;
const storage = new AsyncLocalStorage<{ requestId: string; startedAt: number }>();

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeRequestId(value: string | string[] | undefined) {
  const candidate = firstHeaderValue(value)?.trim();
  if (candidate && requestIdPattern.test(candidate)) {
    return candidate;
  }

  return randomUUID();
}

function getRequestPath(request: Request) {
  return request.originalUrl || request.url || request.path || '/';
}

function shouldLogRequest(request: Request, response: Response) {
  const path = getRequestPath(request);
  if (path.includes('/api/health/live') && response.statusCode < 500) {
    return false;
  }

  return response.statusCode >= 400 || path.includes('/api/health/ready');
}

export function requestContextMiddleware(request: Request, response: Response, next: NextFunction) {
  const requestId = normalizeRequestId(request.headers[requestIdHeader]);
  const startedAt = Date.now();

  storage.run({ requestId, startedAt }, () => {
    response.setHeader('X-Request-Id', requestId);
    response.on('finish', () => {
      if (!shouldLogRequest(request, response)) {
        return;
      }

      console.info(
        JSON.stringify({
          event: 'http_request',
          requestId,
          method: request.method,
          path: getRequestPath(request),
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        }),
      );
    });

    next();
  });
}

export function getRequestId() {
  return storage.getStore()?.requestId ?? null;
}
