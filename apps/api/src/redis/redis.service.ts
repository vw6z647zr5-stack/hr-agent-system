import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

type CachedValue = {
  value: string;
  expiresAt?: number;
};

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: Redis;
  private isReady = false;
  private isRedisEnabled = false;
  private connectionFailed = false;
  private readonly memoryStore = new Map<string, CachedValue>();
  private readonly maxMemoryEntries = 1_000;

  onModuleInit(): void {
    const redisUrl = process.env.REDIS_URL?.trim();
    this.isRedisEnabled = Boolean(redisUrl);

    if (!redisUrl) {
      return;
    }

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.connectionFailed = false;
      this.logger.log('Redis connected');
    });

    this.client.on('close', () => {
      this.isReady = false;
    });

    this.client.on('error', (err) => {
      if (!this.connectionFailed) {
        this.isReady = false;
      }
      // Swallow ECONNREFUSED after first occurrence to prevent log storm
      if (err?.message?.includes('ECONNREFUSED') || (err as any)?.code === 'ECONNREFUSED') {
        if (!this.connectionFailed) {
          this.connectionFailed = true;
          this.logger.warn('Redis unavailable, falling back to in-memory cache');
        }
      }
    });

    void this.client
      .connect()
      .catch(() => {
        this.connectionFailed = true;
        this.isReady = false;
        this.isRedisEnabled = false;
        this.logger.warn('Redis connection failed, falling back to in-memory cache');
        this.client?.disconnect(false);
      });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    let payload: string;

    try {
      payload = JSON.stringify(value);
    } catch {
      return;
    }

    if (this.isRedisEnabled && this.isReady && this.client) {
      try {
        if (ttlSeconds) {
          await this.client.set(key, payload, 'EX', ttlSeconds);
          return;
        }

        await this.client.set(key, payload);
        return;
      } catch {
        this.isReady = false;
      }
    }

    this.pruneMemoryStore();
    this.memoryStore.set(key, {
      value: payload,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (this.isRedisEnabled && this.isReady && this.client) {
      try {
        const payload = await this.client.get(key);
        if (payload) {
          const parsed = parseJsonSafely<T>(payload);
          if (parsed === null) {
            await this.client.del(key).catch(() => undefined);
          }

          return parsed;
        }
      } catch {
        this.isReady = false;
      }
    }

    const cached = this.memoryStore.get(key);
    if (!cached) {
      return null;
    }

    if (cached.expiresAt && cached.expiresAt <= Date.now()) {
      this.memoryStore.delete(key);
      return null;
    }

    const parsed = parseJsonSafely<T>(cached.value);
    if (parsed === null) {
      this.memoryStore.delete(key);
    }

    return parsed;
  }

  async delete(key: string): Promise<void> {
    this.memoryStore.delete(key);

    if (this.isRedisEnabled && this.isReady && this.client) {
      try {
        await this.client.del(key);
        return;
      } catch {
        this.isReady = false;
      }
    }

    this.memoryStore.delete(key);
  }

  private pruneMemoryStore(): void {
    const now = Date.now();

    for (const [key, cached] of this.memoryStore.entries()) {
      if (cached.expiresAt && cached.expiresAt <= now) {
        this.memoryStore.delete(key);
      }
    }

    while (this.memoryStore.size >= this.maxMemoryEntries) {
      const oldestKey = this.memoryStore.keys().next().value;
      if (!oldestKey) {
        return;
      }

      this.memoryStore.delete(oldestKey);
    }
  }
}
