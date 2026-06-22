ALTER TABLE "Professional" ADD COLUMN "slug" TEXT;

UPDATE "Professional" p
SET "slug" = lower(
  regexp_replace(
    regexp_replace(
      coalesce(nullif(p."name", ''), u."name", 'profesional'),
      '[^a-zA-Z0-9]+',
      '-',
      'g'
    ),
    '(^-|-$)',
    '',
    'g'
  )
) || '-' || substr(p."id", 1, 8)
FROM "User" u
WHERE p."userId" = u."id"
  AND p."slug" IS NULL;

CREATE UNIQUE INDEX "Professional_slug_key" ON "Professional"("slug");
