-- CreateEnum
CREATE TYPE "GmailConnectionStatus" AS ENUM ('ACTIVE', 'NEEDS_REAUTH', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "SyncRunType" AS ENUM ('INITIAL', 'INCREMENTAL', 'MANUAL', 'FALLBACK');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailCategory" AS ENUM ('APPLICATION_SUBMITTED', 'APPLICATION_CONFIRMATION', 'RECRUITER_REPLY', 'INTERVIEW', 'TECHNICAL_INTERVIEW', 'REJECTION', 'OFFER', 'JOB_ALERT', 'IRRELEVANT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EmailProcessingStatus" AS ENUM ('PENDING', 'PROCESSED', 'SKIPPED', 'NEEDS_REVIEW', 'FAILED');

-- CreateTable
CREATE TABLE "gmail_connections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "google_email" TEXT NOT NULL,
    "scopes" TEXT[],
    "refresh_token_enc" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL,
    "status" "GmailConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_history_id" TEXT,
    "last_synced_at" TIMESTAMPTZ(3),
    "initial_sync_completed_at" TIMESTAMPTZ(3),
    "sync_locked_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "gmail_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "type" "SyncRunType" NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "page_token" TEXT,
    "messages_listed" INTEGER NOT NULL DEFAULT 0,
    "candidates" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error_code" TEXT,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_threads" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "gmail_thread_id" TEXT NOT NULL,
    "application_id" UUID,
    "first_message_at" TIMESTAMPTZ(3) NOT NULL,
    "last_message_at" TIMESTAMPTZ(3) NOT NULL,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "gmail_message_id" TEXT NOT NULL,
    "rfc822_message_id" TEXT,
    "from_email" TEXT,
    "from_name" TEXT,
    "from_domain" TEXT,
    "subject" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL,
    "gmail_labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prefilter_reason" TEXT,
    "category" "EmailCategory",
    "confidence" DOUBLE PRECISION,
    "classifier" TEXT,
    "extracted" JSONB,
    "processing_status" "EmailProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3),
    "error_code" TEXT,
    "application_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gmail_connections_user_id_google_email_key" ON "gmail_connections"("user_id", "google_email");

-- CreateIndex
CREATE INDEX "sync_runs_connection_id_started_at_idx" ON "sync_runs"("connection_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "email_threads_application_id_idx" ON "email_threads"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_threads_connection_id_gmail_thread_id_key" ON "email_threads"("connection_id", "gmail_thread_id");

-- CreateIndex
CREATE INDEX "emails_connection_id_processing_status_next_attempt_at_idx" ON "emails"("connection_id", "processing_status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "emails_connection_id_received_at_idx" ON "emails"("connection_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "emails_from_domain_idx" ON "emails"("from_domain");

-- CreateIndex
CREATE INDEX "emails_application_id_idx" ON "emails"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "emails_connection_id_gmail_message_id_key" ON "emails"("connection_id", "gmail_message_id");

-- AddForeignKey
ALTER TABLE "gmail_connections" ADD CONSTRAINT "gmail_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "gmail_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "gmail_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "gmail_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "email_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
