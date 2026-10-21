import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { getRequestActor } from '../../common/context/request-context';
import { ForbiddenError } from '../../common/errors/app-error';
import { isRetryableTransactionError, toAppError } from '../../common/errors/prisma-error';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaClient, type Prisma } from '../../generated/prisma/client';
import {
  DEFAULT_TENANT_RETRIES,
  TENANT_TRANSACTION_MAX_WAIT_MS,
  backoffMs,
  delay,
  parseTenantSession,
  type TenantSession,
  type TenantTransactionOptions,
  type TransactionIsolation,
} from './tenant-transaction';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor(configService: AppConfigService) {
    const config = configService.value;

    this.prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: config.database.url,
        max: config.database.poolMax,
        statement_timeout: config.database.statementTimeoutMs,
        application_name: 'jaga-klaim-api',
        keepAlive: true,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      }),
    });
  }

  get system(): PrismaClient {
    return this.prisma;
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  async withTenant<T>(
    tenantId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    options: TenantTransactionOptions = {},
  ): Promise<T> {
    const session = parseTenantSession(tenantId, options);
    const isolationLevel = options.isolationLevel ?? 'ReadCommitted';
    const maxRetries = options.retries ?? DEFAULT_TENANT_RETRIES;

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.runTenantTransaction(session, work, isolationLevel);
      } catch (error) {
        if (attempt >= maxRetries || !isRetryableTransactionError(error)) {
          throw toAppError(error) ?? error;
        }

        await delay(backoffMs(attempt + 1));
      }
    }
  }

  async withCurrentActor<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    options: Omit<TenantTransactionOptions, 'actorId'> = {},
  ): Promise<T> {
    const actor = getRequestActor();

    if (actor === null) {
      throw new ForbiddenError('TENANT_FORBIDDEN', 'Konteks pengguna tidak tersedia.');
    }

    return this.withTenant(actor.tenantId, work, { ...options, actorId: actor.userId });
  }

  private async runTenantTransaction<T>(
    session: TenantSession,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    isolationLevel: TransactionIsolation,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.tenant_id', ${session.tenantId}, true), set_config('app.actor_id', ${session.actorId ?? ''}, true), set_config('statement_timeout', ${`${session.timeoutMs}ms`}, true)`;

        return work(tx);
      },
      {
        maxWait: TENANT_TRANSACTION_MAX_WAIT_MS,
        timeout: session.timeoutMs,
        isolationLevel,
      },
    );
  }
}