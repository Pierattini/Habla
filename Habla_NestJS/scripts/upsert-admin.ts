import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

const email = String(process.env.ADMIN_EMAIL || '')
  .trim()
  .toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || '');
const name = String(process.env.ADMIN_NAME || 'Administrador Conecta').trim();
const confirmation = String(
  process.env.CONFIRM_ADMIN_UPSERT || '',
).trim().toLowerCase();

if (!email || !email.includes('@')) {
  throw new Error('ADMIN_EMAIL debe contener un correo válido.');
}

if (password.length < 12) {
  throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
}

if (confirmation !== email) {
  throw new Error(
    'CONFIRM_ADMIN_UPSERT debe coincidir exactamente con ADMIN_EMAIL.',
  );
}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: name || 'Administrador Conecta',
      password: passwordHash,
      role: Role.ADMIN,
      isActive: true,
    },
    update: {
      password: passwordHash,
      role: Role.ADMIN,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  console.log(
    JSON.stringify({
      operation: existing ? 'updated' : 'created',
      id: admin.id,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      passwordHashStored: true,
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'ADMIN_UPSERT_FAILED',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
