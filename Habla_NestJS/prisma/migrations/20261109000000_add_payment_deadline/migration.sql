ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "paymentDeadlineHours" INTEGER NOT NULL DEFAULT 48;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "paymentDeadlineAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "paymentReminderSentAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "paymentLastReminderSentAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Appointment_status_paymentDeadlineAt_idx" ON "Appointment"("status", "paymentDeadlineAt");
