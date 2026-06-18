-- AlterTable
ALTER TABLE "User"
ADD COLUMN "customerInterests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "preferredAttentionMode" "AttentionModality",
ADD COLUMN "preferredCity" TEXT,
ADD COLUMN "preferredRegion" TEXT;
