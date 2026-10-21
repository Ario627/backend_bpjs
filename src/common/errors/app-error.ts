import { PROBLEM_CODES, type ProblemCode, type ProblemStatus } from './problem-code';

export interface FieldIssue {
  readonly field: string;
  readonly message: string;
}

export interface AppErrorOptions {
  readonly cause?: unknown;
}

export class AppError extends Error {
  readonly code: ProblemCode;
  readonly detail: string;
  readonly issues: readonly FieldIssue[];

  constructor(
    code: ProblemCode,
    detail: string,
    issues: readonly FieldIssue[] = [],
    options?: AppErrorOptions,
  ) {
    super(detail, options);
    this.name = new.target.name;
    this.code = code;
    this.detail = detail;
    this.issues = Object.freeze([...issues]);
  }

  get status(): ProblemStatus {
    return PROBLEM_CODES[this.code].status;
  }

  get title(): string {
    return PROBLEM_CODES[this.code].title;
  }

  get slug(): string {
    return PROBLEM_CODES[this.code].slug;
  }
}

export class ValidationFailedError extends AppError {
  constructor(
    issues: readonly FieldIssue[],
    detail = 'Satu atau lebih field tidak valid.',
    options?: AppErrorOptions,
  ) {
    super('VALIDATION_ERROR', detail, issues, options);
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    code:
      | 'AUTH_INVALID_CREDENTIALS'
      | 'AUTH_MFA_REQUIRED'
      | 'AUTH_MFA_INVALID'
      | 'AUTH_TOKEN_EXPIRED'
      | 'AUTH_TOKEN_INVALID' = 'AUTH_TOKEN_INVALID',
    detail = 'Autentikasi diperlukan.',
    options?: AppErrorOptions,
  ) {
    super(code, detail, [], options);
  }
}

export class ForbiddenError extends AppError {
  constructor(
    code: 'AUTH_FORBIDDEN' | 'TENANT_FORBIDDEN' | 'CSRF_REJECTED' = 'AUTH_FORBIDDEN',
    detail = 'Anda tidak berwenang untuk aksi ini.',
    options?: AppErrorOptions,
  ) {
    super(code, detail, [], options);
  }
}

export class NotFoundError extends AppError {
  constructor(detail = 'Resource tidak ditemukan.', options?: AppErrorOptions) {
    super('NOT_FOUND', detail, [], options);
  }
}

export class ConflictError extends AppError {
  constructor(
    code:
      | 'CONFLICT'
      | 'CLAIM_INVALID_STATE'
      | 'CLAIM_VERSION_CONFLICT'
      | 'IDEMPOTENCY_CONFLICT' = 'CONFLICT',
    detail = 'Terjadi konflik pada resource.',
    options?: AppErrorOptions,
  ) {
    super(code, detail, [], options);
  }
}

export class RateLimitedError extends AppError {
  constructor(detail = 'Terlalu banyak permintaan. Coba lagi nanti.', options?: AppErrorOptions) {
    super('RATE_LIMITED', detail, [], options);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    code: 'SERVICE_UNAVAILABLE' | 'MODEL_UNAVAILABLE' | 'DEPENDENCY_UNAVAILABLE' =
      'SERVICE_UNAVAILABLE',
    detail = 'Layanan sedang tidak tersedia.',
    options?: AppErrorOptions,
  ) {
    super(code, detail, [], options);
  }
}