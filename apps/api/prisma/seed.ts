/**
 * Loads the deterministic sample dataset for the owner user.
 *   pnpm db:seed          → only if the owner has no applications yet
 *   pnpm db:seed --force  → wipes the owner's data first
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { generateSampleDataset } from '@jat/shared';
import { config } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { normalizeCompanyName } from '../src/applications/company-name.js';

config({ path: new URL('../../../.env', import.meta.url), quiet: true });

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://jat:jat@localhost:5432/job_tracker';
const ownerEmail = process.env.OWNER_EMAIL ?? 'owner@example.com';
const force = process.argv.includes('--force');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: { email: ownerEmail },
  });

  const existing = await prisma.application.count({ where: { userId: owner.id } });
  if (existing > 0 && !force) {
    console.warn(`Owner already has ${existing} applications. Use --force to replace them.`);
    return;
  }
  if (force) {
    await prisma.application.deleteMany({ where: { userId: owner.id } });
    await prisma.company.deleteMany({ where: { userId: owner.id } });
  }

  const { applications, events } = generateSampleDataset();
  const eventsByApp = Map.groupBy(events, (e) => e.applicationId);

  for (const app of applications) {
    const company = await prisma.company.upsert({
      where: {
        userId_normalizedName: {
          userId: owner.id,
          normalizedName: normalizeCompanyName(app.company.name),
        },
      },
      update: {},
      create: {
        userId: owner.id,
        name: app.company.name,
        normalizedName: normalizeCompanyName(app.company.name),
        domain: app.company.domain,
      },
    });

    await prisma.application.create({
      data: {
        userId: owner.id,
        companyId: company.id,
        roleTitle: app.roleTitle,
        location: app.location,
        workMode: app.workMode,
        salaryMin: app.salary?.min ?? null,
        salaryMax: app.salary?.max ?? null,
        salaryCurrency: app.salary?.currency ?? null,
        salaryPeriod: app.salary?.period ?? null,
        source: app.source,
        jobUrl: app.jobUrl,
        status: app.status,
        appliedAt: new Date(app.appliedAt),
        lastActivityAt: new Date(app.lastActivityAt),
        origin: 'EMAIL',
        needsReview: app.needsReview,
        notes: app.notes,
        events: {
          create: (eventsByApp.get(app.id) ?? []).map((e) => ({
            type: e.type,
            fromStatus: e.fromStatus,
            toStatus: e.toStatus,
            occurredAt: new Date(e.occurredAt),
            source: e.source,
            summary: e.summary,
          })),
        },
      },
    });
  }
  console.warn(
    `Seeded ${applications.length} applications and ${events.length} events for ${ownerEmail}.`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
