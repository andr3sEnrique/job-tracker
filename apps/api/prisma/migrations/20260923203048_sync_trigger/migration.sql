-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('USER', 'SCHEDULER', 'CRON');

-- AlterTable
ALTER TABLE "sync_runs" ADD COLUMN     "trigger" "SyncTrigger" NOT NULL DEFAULT 'USER';

