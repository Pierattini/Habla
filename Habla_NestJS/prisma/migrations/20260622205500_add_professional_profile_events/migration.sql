CREATE TYPE "ProfileEventType" AS ENUM ('VIEW', 'COPY_LINK', 'SHARE');

CREATE TABLE "ProfessionalProfileEvent" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "type" "ProfileEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalProfileEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfessionalProfileEvent_professionalId_idx" ON "ProfessionalProfileEvent"("professionalId");
CREATE INDEX "ProfessionalProfileEvent_type_idx" ON "ProfessionalProfileEvent"("type");
CREATE INDEX "ProfessionalProfileEvent_createdAt_idx" ON "ProfessionalProfileEvent"("createdAt");

ALTER TABLE "ProfessionalProfileEvent"
ADD CONSTRAINT "ProfessionalProfileEvent_professionalId_fkey"
FOREIGN KEY ("professionalId") REFERENCES "Professional"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
