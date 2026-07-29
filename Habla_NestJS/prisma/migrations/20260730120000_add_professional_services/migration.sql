CREATE TYPE "ProfessionalServiceMode" AS ENUM ('SINGLE_PRICE', 'SERVICE_CATALOG');
CREATE TYPE "ProfessionalServicePriceType" AS ENUM ('FIXED', 'FROM', 'CONSULT', 'FREE');
CREATE TYPE "ProfessionalServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "Professional"
ADD COLUMN "serviceMode" "ProfessionalServiceMode" NOT NULL DEFAULT 'SINGLE_PRICE';

CREATE TABLE "ProfessionalService" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "priceType" "ProfessionalServicePriceType" NOT NULL,
    "priceAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "status" "ProfessionalServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "imageUrl" TEXT,
    "color" TEXT,
    "showInProfile" BOOLEAN NOT NULL DEFAULT true,
    "allowBooking" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProfessionalService_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfessionalService_professionalId_idx"
ON "ProfessionalService"("professionalId");

CREATE INDEX "ProfessionalService_professionalId_status_idx"
ON "ProfessionalService"("professionalId", "status");

CREATE INDEX "ProfessionalService_professionalId_sortOrder_idx"
ON "ProfessionalService"("professionalId", "sortOrder");

CREATE INDEX "ProfessionalService_professionalId_showInProfile_idx"
ON "ProfessionalService"("professionalId", "showInProfile");

ALTER TABLE "ProfessionalService"
ADD CONSTRAINT "ProfessionalService_professionalId_fkey"
FOREIGN KEY ("professionalId") REFERENCES "Professional"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
