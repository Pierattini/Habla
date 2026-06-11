-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DOCUMENT_NOT_REQUIRED', 'DOCUMENT_PENDING', 'DOCUMENT_UPLOADED', 'DOCUMENT_GENERATED', 'DOCUMENT_SENT', 'DOCUMENT_FAILED', 'DOCUMENT_CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentMode" AS ENUM ('MANUAL', 'AUTOMATED');

-- CreateEnum
CREATE TYPE "TaxProvider" AS ENUM ('SII', 'AEAT', 'QUIPU', 'HOLDED', 'NUBOX');

-- CreateEnum
CREATE TYPE "TaxDocumentType" AS ENUM ('BOLETA', 'FACTURA', 'INVOICE', 'RECEIPT');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "documentAmount" INTEGER,
ADD COLUMN     "documentCurrency" TEXT NOT NULL DEFAULT 'CLP',
ADD COLUMN     "documentRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "documentRequestedAt" TIMESTAMP(3),
ADD COLUMN     "documentSentAt" TIMESTAMP(3),
ADD COLUMN     "documentStatus" "DocumentStatus" NOT NULL DEFAULT 'DOCUMENT_NOT_REQUIRED';

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "documentAutomationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manualDocumentMode" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "taxAddress" TEXT,
ADD COLUMN     "taxCity" TEXT,
ADD COLUMN     "taxCountry" TEXT,
ADD COLUMN     "taxEmail" TEXT,
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "taxName" TEXT,
ADD COLUMN     "taxProvider" "TaxProvider";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "taxAddress" TEXT,
ADD COLUMN     "taxCity" TEXT,
ADD COLUMN     "taxCountry" TEXT,
ADD COLUMN     "taxEmail" TEXT,
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "taxName" TEXT,
ADD COLUMN     "wantsTaxDocumentByDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TaxDocument" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DOCUMENT_PENDING',
    "mode" "DocumentMode" NOT NULL DEFAULT 'MANUAL',
    "type" "TaxDocumentType",
    "amount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "customerTaxId" TEXT,
    "customerTaxName" TEXT,
    "customerTaxEmail" TEXT,
    "customerTaxAddress" TEXT,
    "customerTaxCountry" TEXT,
    "customerTaxCity" TEXT,
    "professionalTaxId" TEXT,
    "professionalTaxName" TEXT,
    "professionalTaxEmail" TEXT,
    "professionalTaxAddress" TEXT,
    "professionalTaxCountry" TEXT,
    "professionalTaxCity" TEXT,
    "provider" "TaxProvider",
    "providerDocumentId" TEXT,
    "providerPayload" JSONB,
    "providerResponse" JSONB,
    "pdfUrl" TEXT,
    "pdfPublicId" TEXT,
    "fileName" TEXT,
    "localFilePath" TEXT,
    "uploadedById" TEXT,
    "generatedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3),
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxDocumentEvent" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxDocumentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxDocument_appointmentId_key" ON "TaxDocument"("appointmentId");

-- CreateIndex
CREATE INDEX "TaxDocument_status_idx" ON "TaxDocument"("status");

-- CreateIndex
CREATE INDEX "TaxDocument_provider_idx" ON "TaxDocument"("provider");

-- CreateIndex
CREATE INDEX "TaxDocumentEvent_documentId_idx" ON "TaxDocumentEvent"("documentId");

-- CreateIndex
CREATE INDEX "TaxDocumentEvent_actorId_idx" ON "TaxDocumentEvent"("actorId");

-- CreateIndex
CREATE INDEX "TaxDocumentEvent_createdAt_idx" ON "TaxDocumentEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "TaxDocument" ADD CONSTRAINT "TaxDocument_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxDocumentEvent" ADD CONSTRAINT "TaxDocumentEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "TaxDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
