import { getRequestId } from './request-context';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  message: string;
  context?: string;
  [key: string]: unknown;
}

const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const levelRank: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function shouldEmit(level: LogLevel) {
  return levelRank[level] >= levelRank[minLevel];
}

function emit(level: LogLevel, payload: LogPayload) {
  if (!shouldEmit(level)) return;

  const requestId = getRequestId();
  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: 'hr-agent-api',
    environment: process.env.NODE_ENV ?? 'development',
    ...(requestId ? { requestId } : {}),
    ...payload,
  };

  const line = JSON.stringify(record);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export class Logger {
  constructor(private readonly context?: string) {}

  static for(context: string) {
    return new Logger(context);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    emit('debug', { message, context: this.context, ...meta });
  }

  info(message: string, meta?: Record<string, unknown>) {
    emit('info', { message, context: this.context, ...meta });
  }

  warn(message: string, meta?: Record<string, unknown>) {
    emit('warn', { message, context: this.context, ...meta });
  }

  error(message: string, error?: unknown, meta?: Record<string, unknown>) {
    const errorMeta = error instanceof Error
      ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
      : error !== undefined
        ? { error }
        : {};
    emit('error', { message, context: this.context, ...errorMeta, ...meta });
  }
}

export const rootLogger = new Logger('app');
