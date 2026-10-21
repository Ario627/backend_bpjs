import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  type AppError,
} from './app-error';

interface PrismaErrorShape {
  readonly name: string;
  readonly code: string;
}

const RETRYABLE_CODES: ReadonlySet<string> = new Set(['P2034']);
const NOT_FOUND_CODES: ReadonlySet<string> = new Set(['P2025']);
const RELATION_CODES: ReadonlySet<string> = new Set(['P2002', 'P2003', 'P2014']);
const UNAVAILABLE_CODES: ReadonlySet<string> = new Set([
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2024',
  'P2028',
]);

export function isPrismaError(error: unknown): error is PrismaErrorShape {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { name?: unknown; code?: unknown };

  return (
    typeof candidate.name === 'string' &&
    candidate.name.startsWith('PrismaClient') &&
    typeof candidate.code === 'string'
  );
}

export function isRetryableTransactionError(error: unknown): boolean {
  return isPrismaError(error) && RETRYABLE_CODES.has(error.code);
}

export function toAppError(error: unknown): AppError | null {
  if (!isPrismaError(error)) {
    return null;
  }

  if (NOT_FOUND_CODES.has(error.code)) {
    return new NotFoundError('Resource tidak ditemukan.');
  }

  if (RELATION_CODES.has(error.code)) {
    return new ConflictError('CONFLICT', 'Operasi bertentangan dengan data yang sudah ada.');
  }

  if (RETRYABLE_CODES.has(error.code)) {
    return new ConflictError('CONFLICT', 'Terjadi konflik konkurensi. Ulangi permintaan.');
  }

  if (UNAVAILABLE_CODES.has(error.code)) {
    return new ServiceUnavailableError('DEPENDENCY_UNAVAILABLE', 'Basis data tidak tersedia.');
  }

  return null;
}