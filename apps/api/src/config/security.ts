import './env';
import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const insecureJwtSecrets = new Set([
  '',
  'secret',
  'jwt-secret',
  'changeme',
  'change-me',
  'replace-with-a-strong-secret',
  'change-this-to-a-long-random-secret',
]);

const localDevelopmentOrigins = [
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

let cachedJwtSecret: string | undefined;
let warnedAboutDevJwtSecret = false;

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production';
}

function splitEnvList(value?: string) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isSecureJwtSecret(secret: string) {
  return secret.length >= 32 && !insecureJwtSecrets.has(secret.toLowerCase());
}

export function getJwtSecret() {
  const configured = process.env.JWT_SECRET?.trim() ?? '';

  if (isSecureJwtSecret(configured)) {
    return configured;
  }

  if (isProductionRuntime()) {
    throw new Error('JWT_SECRET_INVALID');
  }

  if (!cachedJwtSecret) {
    cachedJwtSecret = randomBytes(32).toString('hex');
  }

  if (!warnedAboutDevJwtSecret) {
    warnedAboutDevJwtSecret = true;
    console.warn('JWT_SECRET_DEV_EPHEMERAL');
  }

  return cachedJwtSecret;
}

export function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN?.trim() || '12h';
}

export function getPort() {
  const port = Number(process.env.PORT ?? 3000);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT_INVALID');
  }

  return port;
}

export function getDatabaseUrl() {
  const configured = process.env.DATABASE_URL?.trim();

  if (configured) {
    return configured;
  }

  if (isProductionRuntime()) {
    throw new Error('DATABASE_URL_REQUIRED');
  }

  const database = process.env.POSTGRES_DB?.trim();
  const username = process.env.POSTGRES_USER?.trim();
  const password = process.env.POSTGRES_PASSWORD?.trim();

  if (!database || !username || !password) {
    throw new Error('DATABASE_URL_REQUIRED');
  }

  return `postgres://${encodeURIComponent(username)}:${encodeURIComponent(password)}@localhost:5432/${encodeURIComponent(database)}`;
}

export function getHost() {
  const host = process.env.HOST?.trim() || (isProductionRuntime() ? '0.0.0.0' : '127.0.0.1');

  if (!/^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|[a-zA-Z0-9.-]+)$/.test(host)) {
    throw new Error('HOST_INVALID');
  }

  return host;
}

export function getFileStorageRoot() {
  const root = process.env.FILE_STORAGE_ROOT?.trim() || 'uploads';

  if (!root || root.includes('\0')) {
    throw new Error('FILE_STORAGE_ROOT_INVALID');
  }

  return root;
}

export function getAllowedCorsOrigins() {
  const configuredOrigins = splitEnvList(process.env.CORS_ORIGINS);
  const legacyWebOrigin = splitEnvList(process.env.WEB_URL);
  const origins = new Set([
    ...configuredOrigins,
    ...legacyWebOrigin,
    ...(isProductionRuntime() ? [] : localDevelopmentOrigins),
  ]);

  origins.delete('*');
  return Array.from(origins);
}

export function isCorsOriginAllowed(origin?: string) {
  if (!origin) {
    return true;
  }

  return getAllowedCorsOrigins().includes(origin);
}

export function getCorsOptions() {
  return {
    credentials: true,
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      callback(null, isCorsOriginAllowed(origin));
    },
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 86400,
  };
}

export function securityHeadersMiddleware(request: Request, response: Response, next: NextFunction) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  const path = request.path || request.url || '/';
  if (path.startsWith('/api/docs')) {
    response.setHeader('X-Frame-Options', 'SAMEORIGIN');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:",
    );
  } else {
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  }

  next();
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();
const defaultRateLimitWindowMs = 60_000;
const defaultRateLimitMax = 240;
const authRateLimitMax = 30;
const uploadRateLimitMax = 40;

function getClientIp(request: Request) {
  const forwardedFor = request.headers['x-forwarded-for'];
  const firstForwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0];

  return (firstForwardedIp || request.ip || request.socket.remoteAddress || 'unknown').trim();
}

function getRateLimitMax(path: string) {
  if (path.includes('/auth/login') || path.includes('/auth/candidate-register')) {
    return authRateLimitMax;
  }

  if (path.includes('/upload') || path.includes('/applications') || path.includes('/document-imports')) {
    return uploadRateLimitMax;
  }

  return defaultRateLimitMax;
}

export function rateLimitMiddleware(request: Request, response: Response, next: NextFunction) {
  if (request.method === 'OPTIONS') {
    next();
    return;
  }

  const now = Date.now();
  const path = request.path || request.url || '/';
  const max = getRateLimitMax(path);
  const key = `${getClientIp(request)}:${path.split('?')[0]}`;
  const current = rateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + defaultRateLimitWindowMs });
    next();
    return;
  }

  current.count += 1;
  response.setHeader('RateLimit-Limit', String(max));
  response.setHeader('RateLimit-Remaining', String(Math.max(0, max - current.count)));
  response.setHeader('RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

  if (current.count > max) {
    response.status(429).json({
      statusCode: 429,
      message: '请求过于频繁，请稍后再试。',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
    return;
  }

  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}, defaultRateLimitWindowMs).unref();
