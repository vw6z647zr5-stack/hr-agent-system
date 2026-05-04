import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../redis/redis.service';

export interface AuthSessionRecord {
  sessionId: string;
  userId: string;
  username: string;
  role: string;
  issuedAt: number;
}

const defaultSessionTtlSeconds = 12 * 60 * 60;

@Injectable()
export class AuthSessionService {
  constructor(private readonly redisService: RedisService) {}

  createSessionId() {
    return randomUUID();
  }

  async createSession(record: Omit<AuthSessionRecord, 'issuedAt'>, ttlSeconds = defaultSessionTtlSeconds) {
    await this.redisService.setJson<AuthSessionRecord>(
      this.sessionKey(record.userId, record.sessionId),
      {
        ...record,
        issuedAt: Date.now(),
      },
      ttlSeconds,
    );
  }

  async assertSession(userId: string, sessionId?: string) {
    if (!sessionId) {
      throw new UnauthorizedException('登录状态已失效，请重新登录。');
    }

    const record = await this.redisService.getJson<AuthSessionRecord>(this.sessionKey(userId, sessionId));

    if (!record || record.userId !== userId || record.sessionId !== sessionId) {
      throw new UnauthorizedException('登录状态已失效，请重新登录。');
    }
  }

  async revokeSession(userId: string, sessionId?: string) {
    if (!sessionId) {
      return;
    }

    await this.redisService.delete(this.sessionKey(userId, sessionId));
  }

  private sessionKey(userId: string, sessionId: string) {
    return `session:${userId}:${sessionId}`;
  }
}
