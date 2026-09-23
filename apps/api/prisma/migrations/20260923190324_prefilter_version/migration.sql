-- AlterEnum
ALTER TYPE "SyncRunType" ADD VALUE 'RESCAN';

-- AlterTable
ALTER TABLE "gmail_connections" ADD COLUMN     "prefilter_version" INTEGER NOT NULL DEFAULT 0;
