import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const email = String(process.env.ADMIN_EMAIL || '')
  .trim()
  .toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !email.includes('@')) {
  throw new Error('ADMIN_EMAIL debe contener un correo válido.');
}

function getSafeDatabaseTarget() {
  try {
    const databaseUrl = new URL(process.env.DATABASE_URL || '');

    return {
      host: databaseUrl.hostname || 'unknown',
      database: databaseUrl.pathname.replace(/^\//, '') || 'unknown',
    };
  } catch {
    return {
      host: 'unavailable',
      database: 'unavailable',
    };
  }
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      password: true,
    },
  });

  if (!user) {
    console.log(
      JSON.stringify({
        database: getSafeDatabaseTarget(),
        normalizedEmail: email,
        exists: false,
        id: null,
        role: null,
        isActive: null,
        emailVerified: 'FIELD_NOT_PRESENT_IN_SCHEMA',
        passwordHashPresent: false,
        bcryptHashFormat: false,
        passwordCompared: false,
        passwordMatches: null,
        unauthorizedCondition: 'USER_NOT_FOUND',
      }),
    );
    return;
  }

  const passwordHashPresent =
    typeof user.password === 'string' && user.password.length > 0;
  const bcryptHashFormat =
    passwordHashPresent &&
    /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.password);
  const passwordCompared =
    typeof password === 'string' && password.length > 0 && bcryptHashFormat;
  const passwordMatches = passwordCompared
    ? await bcrypt.compare(password, user.password)
    : null;

  const unauthorizedCondition = !user.isActive
    ? 'USER_INACTIVE'
    : !bcryptHashFormat
      ? 'INVALID_PASSWORD_HASH'
      : !passwordCompared
        ? 'PASSWORD_NOT_PROVIDED_FOR_DIAGNOSIS'
        : !passwordMatches
          ? 'PASSWORD_MISMATCH'
          : null;

  console.log(
    JSON.stringify({
      database: getSafeDatabaseTarget(),
      normalizedEmail: user.email,
      exists: true,
      id: user.id,
      role: user.role,
      isActive: user.isActive,
      emailVerified: 'FIELD_NOT_PRESENT_IN_SCHEMA',
      passwordHashPresent,
      bcryptHashFormat,
      passwordCompared,
      passwordMatches,
      unauthorizedCondition,
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'ADMIN_DIAGNOSIS_FAILED',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
