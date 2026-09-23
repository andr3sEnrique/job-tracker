import { Injectable } from '@nestjs/common';
import { GmailConnectionsService } from '../gmail/gmail-connections.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gmail: GmailConnectionsService,
  ) {}

  /**
   * Right to erasure: revokes Gmail access at Google, then deletes the user and everything
   * that hangs from it (sessions, applications, history, companies, stored email metadata).
   * AI usage rows lose their email link but stay, so the monthly budget cannot be reset
   * this way; they never contain email text.
   */
  async delete(userId: string): Promise<void> {
    await this.gmail.disconnect(userId);
    await this.prisma.$transaction([
      // Applications first: companies are protected while an application points at them.
      this.prisma.application.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
  }
}
