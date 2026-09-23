-- AlterTable
ALTER TABLE "application_events" ADD COLUMN     "email_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "application_events_email_id_key" ON "application_events"("email_id");

-- AddForeignKey
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE SET NULL ON UPDATE CASCADE;

