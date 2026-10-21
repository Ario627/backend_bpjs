import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { PrismaPg } from '@prisma/adapter-pg';
import { argon2id, hash } from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';

const ARGON2_OPTIONS = Object.freeze({
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

const MIN_PASSWORD_LENGTH = 12;
const DEFAULT_SEED_PASSWORD = 'Jaga-Klaim-Demo-2026';

const TENANTS = [
  {
    id: '01920000-0000-7000-8000-000000000001',
    name: 'RS Fiktif Sehat',
    facilityType: 'RS_C',
    regionCode: '31',
    bedCount: 120,
    hasIcu: true,
    rmeMaturity: 'MEDIUM',
    tariffScheme: 'INA_CBG',
  },
  {
    id: '01920000-0000-7000-8000-000000000002',
    name: 'Klinik Fiktif Prima',
    facilityType: 'KLINIK',
    regionCode: '31',
    bedCount: null,
    hasIcu: false,
    rmeMaturity: 'LOW',
    tariffScheme: 'INA_CBG',
  },
] as const;

const USERS = [
  {
    id: '01920000-0000-7000-8000-000000000101',
    tenantId: TENANTS[0].id,
    email: 'admin@rs-fiktif-sehat.test',
    role: 'ADMIN',
  },
  {
    id: '01920000-0000-7000-8000-000000000102',
    tenantId: TENANTS[0].id,
    email: 'verifikator@rs-fiktif-sehat.test',
    role: 'VERIFIER',
  },
  {
    id: '01920000-0000-7000-8000-000000000103',
    tenantId: TENANTS[0].id,
    email: 'governance@rs-fiktif-sehat.test',
    role: 'GOVERNANCE',
  },
  {
    id: '01920000-0000-7000-8000-000000000104',
    tenantId: TENANTS[0].id,
    email: 'manager@rs-fiktif-sehat.test',
    role: 'MANAGER',
  },
  {
    id: '01920000-0000-7000-8000-000000000105',
    tenantId: TENANTS[1].id,
    email: 'verifikator@klinik-fiktif-prima.test',
    role: 'VERIFIER',
  },
] as const;

async function upsertTenants(prisma: PrismaClient): Promise<void> {
  for (const tenant of TENANTS) {
    await prisma.tenant.upsert({
      where: { id: tenant.id },
      create: {
        id: tenant.id,
        name: tenant.name,
        facilityType: tenant.facilityType,
        regionCode: tenant.regionCode,
        bedCount: tenant.bedCount,
        hasIcu: tenant.hasIcu,
        rmeMaturity: tenant.rmeMaturity,
        tariffScheme: tenant.tariffScheme,
      },
      update: {
        name: tenant.name,
        facilityType: tenant.facilityType,
        regionCode: tenant.regionCode,
        bedCount: tenant.bedCount,
        hasIcu: tenant.hasIcu,
        rmeMaturity: tenant.rmeMaturity,
        tariffScheme: tenant.tariffScheme,
        status: 'ACTIVE',
      },
    });
  }
}

async function upsertUsers(prisma: PrismaClient, password: string): Promise<void> {
  for (const user of USERS) {
    const passwordHash = await hash(password, ARGON2_OPTIONS);

    await prisma.user.upsert({
      where: { email: user.email },
      create: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        passwordHash,
        role: user.role,
      },
      update: {
        tenantId: user.tenantId,
        passwordHash,
        role: user.role,
        status: 'ACTIVE',
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
  }
}

async function main(): Promise<void> {
  if (existsSync('.env')) {
    loadEnvFile('.env');
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL belum diatur.');
  }

  const password = process.env.SEED_PASSWORD ?? DEFAULT_SEED_PASSWORD;

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`SEED_PASSWORD minimal ${MIN_PASSWORD_LENGTH} karakter.`);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    await upsertTenants(prisma);
    await upsertUsers(prisma, password);
    console.log(`seed selesai: ${TENANTS.length} tenant, ${USERS.length} pengguna`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});