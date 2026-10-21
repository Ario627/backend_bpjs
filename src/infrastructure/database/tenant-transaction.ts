import { ForbiddenError } from '../../common/errors/app-error';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 60000;

export const DEFAULT_TENANT_TIMEOUT_MS = 15_000;
export const TENANT_TRANSACTION_MAX_WAIT_MS = 5_000;
export const DEFAULT_TENANT_RETRIES = 2;

export type TransactionIsolation = 'ReadCommitted' | 'RepeatableRead' | 'Serializable';

export interface TenantTransactionOptions {
  readonly actorId?: string;
  readonly timeoutMs?: number;
  readonly isolationLevel?: TransactionIsolation;
  readonly retries?: number;
}

export interface TenantSession {
  readonly tenantId: string;
  readonly actorId: string | null;
  readonly timeoutMs: number;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function parseTenantSession(
  tenantId: unknown,
  options: TenantTransactionOptions = {},
): TenantSession {
  if (!isUuid(tenantId)) {
    throw new ForbiddenError('TENANT_FORBIDDEN', 'Konteks tenant tidak valid.');
  }

  const actorId = options.actorId ?? null;

  if (actorId !== null && !isUuid(actorId)) {
    throw new Error('Konteks aktor tidak valid.');
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TENANT_TIMEOUT_MS;

  if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new RangeError(
      `timeoutMs harus bilangan bulat antara ${MIN_TIMEOUT_MS} dan ${MAX_TIMEOUT_MS}.`,
    );
  }

  return Object.freeze({ tenantId, actorId, timeoutMs });
}

export function backoffMs(attempt: number): number {
  const base = 25 * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(Math.random() * 20);

  return Math.min(400, base + jitter);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref();
  });
}