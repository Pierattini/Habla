CREATE TYPE "ProfessionalTimeBlockType" AS ENUM ('TIME_RANGE', 'FULL_DAY', 'DATE_RANGE');

CREATE TABLE "ProfessionalTimeBlock" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "type" "ProfessionalTimeBlockType" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalTimeBlock_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProfessionalTimeBlock_valid_range" CHECK ("startAt" < "endAt")
);

CREATE INDEX "ProfessionalTimeBlock_professionalId_startAt_idx"
ON "ProfessionalTimeBlock"("professionalId", "startAt");

CREATE INDEX "ProfessionalTimeBlock_professionalId_endAt_idx"
ON "ProfessionalTimeBlock"("professionalId", "endAt");

ALTER TABLE "ProfessionalTimeBlock"
ADD CONSTRAINT "ProfessionalTimeBlock_professionalId_fkey"
FOREIGN KEY ("professionalId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
