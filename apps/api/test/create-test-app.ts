import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication({ logger: false }));
  await app.init();
  const prisma = app.get(PrismaService);

  // Guard against ever truncating a real database.
  const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  if (rows[0]?.db === 'job_tracker') {
    throw new Error('Integration tests must not run against the dev database');
  }

  return { app, prisma };
}

/** Wipes domain data between tests (users are kept so the owner id stays stable). */
export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRaw`TRUNCATE application_events, applications, companies RESTART IDENTITY CASCADE`;
}
