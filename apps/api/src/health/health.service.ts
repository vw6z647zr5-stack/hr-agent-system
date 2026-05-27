import { Injectable } from '@nestjs/common';
import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { getFileStorageRoot } from '../config/security';
import { RedisService } from '../redis/redis.service';

type ComponentStatus = 'up' | 'down' | 'degraded' | 'disabled' | 'starting';

interface ComponentCheck {
  status: ComponentStatus;
  latencyMs?: number;
  mode?: string;
  path?: string;
  message?: string;
}

function now() {
  return new Date().toISOString();
}

function durationSince(startedAt: number) {
  return Date.now() - startedAt;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  getLiveness() {
    return {
      status: 'ok',
      service: 'hr-agent-api',
      version: process.env.APP_VERSION || process.env.npm_package_version || '1.0.0',
      nodeEnv: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: now(),
    };
  }

  async getReadiness() {
    const [database, redis, storage] = await Promise.all([
      this.checkDatabase(),
      this.redisService.getHealthStatus(),
      this.checkStorage(),
    ]);

    const criticalReady = database.status === 'up' && storage.status === 'up';
    const hasDegradedDependency = redis.status === 'degraded' || redis.status === 'starting';

    return {
      ready: criticalReady,
      status: criticalReady ? (hasDegradedDependency ? 'degraded' : 'ok') : 'down',
      timestamp: now(),
      checks: {
        database,
        redis,
        storage,
      },
    };
  }

  private async checkDatabase(): Promise<ComponentCheck> {
    const startedAt = Date.now();

    try {
      await this.dataSource.query('select 1');
      return {
        status: 'up',
        latencyMs: durationSince(startedAt),
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: durationSince(startedAt),
        message: error instanceof Error ? error.message : '数据库检查失败',
      };
    }
  }

  private async checkStorage(): Promise<ComponentCheck> {
    const root = resolve(process.cwd(), getFileStorageRoot());

    try {
      await mkdir(root, { recursive: true });
      await access(root, constants.R_OK | constants.W_OK);
      return {
        status: 'up',
        path: root,
      };
    } catch (error) {
      return {
        status: 'down',
        path: root,
        message: error instanceof Error ? error.message : '存储目录检查失败',
      };
    }
  }
}
