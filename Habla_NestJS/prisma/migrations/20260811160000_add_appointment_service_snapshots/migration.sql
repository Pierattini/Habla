ALTER TABLE "Appointment"
ADD COLUMN "serviceId" TEXT,
ADD COLUMN "serviceNameSnapshot" TEXT,
ADD COLUMN "servicePriceTypeSnapshot" "ProfessionalServicePriceType",
ADD COLUMN "servicePriceAmountSnapshot" INTEGER,
ADD COLUMN "serviceCurrencySnapshot" TEXT,
ADD COLUMN "serviceDurationMinutesSnapshot" INTEGER;

CREATE INDEX "Appointment_serviceId_idx" ON "Appointment"("serviceId");

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "ProfessionalService"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
