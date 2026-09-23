import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomToken, sha256 } from './crypto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** lastSeenAt/expiry are refreshed at most this often, to avoid a write on every request. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  get ttlMs(): number {
    return this.config.get('SESSION_TTL_DAYS') * DAY_MS;
  }

  /** Returns the raw token; only its hash is persisted. */
  async create(userId: string, userAgent?: string): Promise<string> {
    const token = randomToken();
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + this.ttlMs),
        userAgent: userAgent?.slice(0, 256) ?? null,
      },
    });
    // Housekeeping: drop this user's expired sessions.
    await this.prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
    return token;
  }

  async resolve(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!session) return null;

    const now = Date.now();
    if (session.expiresAt.getTime() <= now) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }
    // Sliding expiration: active sessions stay alive, idle ones expire.
    if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now), expiresAt: new Date(now + this.ttlMs) },
      });
    }
    return session;
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
}
