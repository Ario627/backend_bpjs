import { ConflictError, NotFoundError, ServiceUnavailableError } from './app-error';
import { isPrismaError, isRetryableTransactionError, toAppError } from './prisma-error';

function prismaError(code: string, name = 'PrismaClientKnownRequestError'): Error {
  return Object.assign(new Error('prisma'), { name, code });
}

describe('isPrismaError', () => {
  it('mengenali error prisma', () => {
    expect(isPrismaError(prismaError('P2002'))).toBe(true);
    expect(isPrismaError(prismaError('P1001', 'PrismaClientInitializationError'))).toBe(true);
  });

  it('menolak error node biasa', () => {
    expect(isPrismaError(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }))).toBe(false);
    expect(isPrismaError('P2002')).toBe(false);
    expect(isPrismaError(null)).toBe(false);
  });
});

describe('toAppError', () => {
  it('memetakan not found', () => {
    expect(toAppError(prismaError('P2025'))).toBeInstanceOf(NotFoundError);
  });

  it('memetakan konflik relasi dan konkurensi', () => {
    expect(toAppError(prismaError('P2002'))).toBeInstanceOf(ConflictError);
    expect(toAppError(prismaError('P2034'))).toBeInstanceOf(ConflictError);
  });

  it('memetakan ketersediaan database', () => {
    expect(toAppError(prismaError('P1001'))).toBeInstanceOf(ServiceUnavailableError);
    expect(toAppError(prismaError('P2024'))).toBeInstanceOf(ServiceUnavailableError);
  });

  it('mengembalikan null untuk error yang tidak dikenal', () => {
    expect(toAppError(new Error('lain'))).toBeNull();
    expect(toAppError(prismaError('P9999'))).toBeNull();
  });
});

describe('isRetryableTransactionError', () => {
  it('hanya P2034 yang dapat diulang', () => {
    expect(isRetryableTransactionError(prismaError('P2034'))).toBe(true);
    expect(isRetryableTransactionError(prismaError('P2025'))).toBe(false);
    expect(isRetryableTransactionError(new Error('x'))).toBe(false);
  });
});