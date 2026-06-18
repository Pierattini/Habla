-- CreateTable
CREATE TABLE "ProfessionalCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profession" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profession_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN "professionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalCategory_slug_key" ON "ProfessionalCategory"("slug");
CREATE INDEX "ProfessionalCategory_isActive_sortOrder_idx" ON "ProfessionalCategory"("isActive", "sortOrder");
CREATE UNIQUE INDEX "Profession_slug_key" ON "Profession"("slug");
CREATE INDEX "Profession_categoryId_isActive_sortOrder_idx" ON "Profession"("categoryId", "isActive", "sortOrder");
CREATE INDEX "Profession_isActive_sortOrder_idx" ON "Profession"("isActive", "sortOrder");
CREATE INDEX "Professional_professionId_idx" ON "Professional"("professionId");
CREATE INDEX "Professional_attentionMode_idx" ON "Professional"("attentionMode");

-- AddForeignKey
ALTER TABLE "Profession" ADD CONSTRAINT "Profession_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProfessionalCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Professional" ADD CONSTRAINT "Professional_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
