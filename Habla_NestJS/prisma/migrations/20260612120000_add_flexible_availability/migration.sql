CREATE TYPE "ScheduleMode" AS ENUM ('CONTINUOUS', 'SPECIFIC');

ALTER TABLE "Availability"
ADD COLUMN     "scheduleMode" "ScheduleMode" NOT NULL DEFAULT 'CONTINUOUS',
ADD COLUMN     "breakMinute" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "specificSlots" JSONB,
ADD COLUMN     "blockedRanges" JSONB;
