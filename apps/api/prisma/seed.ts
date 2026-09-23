/**
 * Loads the deterministic sample dataset for the account you log in with
 * (SEED_USER_EMAIL, or the first ALLOWED_GOOGLE_EMAILS entry).
 *   pnpm db:seed          → only if the owner has no applications yet
 *   pnpm db:seed --force  → wipes the owner's data first
 *   pnpm db:seed --clear  → removes the sample data only (for every user), keeping real
 *                           applications (manual ones and those built from your Gmail)
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { generateSampleDataset } from '@jat/shared';
import { config } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { normalizeCompanyName } from '../src/applications/company-name.js';

config({ path: new URL('../../../.env', import.meta.url), quiet: true });

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://jat:jat@localhost:5432/job_tracker';
const ownerEmail = (
  process.env.SEED_USER_EMAIL ??
  process.env.ALLOWED_GOOGLE_EMAILS?.split(',')[0] ??
  'owner@example.com'
)
  .trim()
  .toLowerCase();
const force = process.argv.includes('--force');
const clear = process.argv.includes('--clear');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

/**
 * Sample applications look like email-derived ones but no event points to a real email;
 * real email-derived applications always have at least one.
 */
async function clearSampleData() {
  const { count } = await prisma.application.deleteMany({
    where: { origin: 'EMAIL', events: { none: { emailId: { not: null } } } },
  });
  const orphans = await prisma.company.deleteMany({ where: { applications: { none: {} } } });
  console.warn(`Removed ${count} sample applications and ${orphans.count} unused companies.`);
}

async function main() {
  if (clear) return clearSampleData();
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
