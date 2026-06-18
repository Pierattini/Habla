-- CreateEnum
CREATE TYPE "AttentionModality" AS ENUM ('ONLINE', 'PRESENTIAL', 'BOTH');

-- CreateEnum
CREATE TYPE "VideoProvider" AS ENUM ('JITSI', 'GOOGLE_MEET', 'ZOOM', 'CUSTOM');

-- AlterTable
ALTER TABLE "Professional"
ADD COLUMN "attentionMode" "AttentionModality" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN "officeAddress" TEXT,
ADD COLUMN "officeCity" TEXT,
ADD COLUMN "officeRegion" TEXT,
ADD COLUMN "officeCountry" TEXT,
ADD COLUMN "officeLatitude" DOUBLE PRECISION,
ADD COLUMN "officeLongitude" DOUBLE PRECISION,
ADD COLUMN "arrivalInstructions" TEXT,
ADD COLUMN "videoProvider" "VideoProvider" NOT NULL DEFAULT 'JITSI',
ADD COLUMN "customVideoUrl" TEXT;

-- AlterTable
ALTER TABLE "Appointment"
ADD COLUMN "attentionMode" "AttentionModality" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN "appointmentAddress" TEXT,
ADD COLUMN "appointmentCity" TEXT,
ADD COLUMN "appointmentRegion" TEXT,
ADD COLUMN "appointmentCountry" TEXT,
ADD COLUMN "appointmentLatitude" DOUBLE PRECISION,
ADD COLUMN "appointmentLongitude" DOUBLE PRECISION,
ADD COLUMN "arrivalInstructions" TEXT,
ADD COLUMN "videoProvider" "VideoProvider";
