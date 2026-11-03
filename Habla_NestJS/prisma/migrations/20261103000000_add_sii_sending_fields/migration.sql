ALTER TABLE "ProfessionalTaxProviderCredential"
ADD COLUMN IF NOT EXISTS "certificateExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "signerRut" TEXT,
ADD COLUMN IF NOT EXISTS "taxActivity" TEXT,
ADD COLUMN IF NOT EXISTS "resolutionNumber" INTEGER,
ADD COLUMN IF NOT EXISTS "resolutionDate" TEXT;
