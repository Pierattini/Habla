ALTER TABLE "Appointment"
  ALTER COLUMN "customerId" DROP NOT NULL,
  ADD COLUMN "guestCustomerName" VARCHAR(80);

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_manual_customer_check"
  CHECK (
    ("source" <> 'PROFESSIONAL_MANUAL' AND "customerId" IS NOT NULL AND "guestCustomerName" IS NULL)
    OR
    ("source" = 'PROFESSIONAL_MANUAL' AND (("customerId" IS NOT NULL) <> ("guestCustomerName" IS NOT NULL)))
  );
