-- Store the verified Firebase/Google identity on the existing Conecta account.
ALTER TABLE "User"
ADD COLUMN "googleId" TEXT,
ADD COLUMN "lastLoginAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
