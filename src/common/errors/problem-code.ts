export interface ProblemDefinition {
  readonly status: number;
  readonly title: string;
  readonly slug: string;
}

export const PROBLEM_CODES = {
  VALIDATION_ERROR: { status: 422, title: 'Data tidak valid', slug: 'validation-error' },
  AUTH_INVALID_CREDENTIALS: {
    status: 401,
    title: 'Kredensial tidak valid',
    slug: 'auth-invalid-credentials',
  },
  AUTH_MFA_REQUIRED: { status: 401, title: 'MFA diperlukan', slug: 'auth-mfa-required' },
  AUTH_MFA_INVALID: { status: 401, title: 'Kode MFA tidak valid', slug: 'auth-mfa-invalid' },
  AUTH_TOKEN_EXPIRED: { status: 401, title: 'Sesi kedaluwarsa', slug: 'auth-token-expired' },
  AUTH_TOKEN_INVALID: { status: 401, title: 'Token tidak valid', slug: 'auth-token-invalid' },
  AUTH_FORBIDDEN: { status: 403, title: 'Akses ditolak', slug: 'auth-forbidden' },
  TENANT_FORBIDDEN: { status: 403, title: 'Akses tenant ditolak', slug: 'tenant-forbidden' },
  CSRF_REJECTED: { status: 403, title: 'Permintaan lintas situs ditolak', slug: 'csrf-rejected' },
  NOT_FOUND: { status: 404, title: 'Resource tidak ditemukan', slug: 'not-found' },
  METHOD_NOT_ALLOWED: {
    status: 405,
    title: 'Metode tidak didukung',
    slug: 'method-not-allowed',
  },
  CONFLICT: { status: 409, title: 'Konflik resource', slug: 'conflict' },
  CLAIM_INVALID_STATE: {
    status: 409,
    title: 'Status klaim tidak valid',
    slug: 'claim-invalid-state',
  },
  CLAIM_VERSION_CONFLICT: {
    status: 409,
    title: 'Klaim sudah berubah',
    slug: 'claim-version-conflict',
  },
  IDEMPOTENCY_CONFLICT: {
    status: 409,
    title: 'Idempotency key bentrok',
    slug: 'idempotency-conflict',
  },
  PAYLOAD_TOO_LARGE: {
    status: 413,
    title: 'Payload terlalu besar',
    slug: 'payload-too-large',
  },
  UNSUPPORTED_MEDIA_TYPE: {
    status: 415,
    title: 'Tipe konten tidak didukung',
    slug: 'unsupported-media-type',
  },
  RATE_LIMITED: { status: 429, title: 'Terlalu banyak permintaan', slug: 'rate-limited' },
  REQUEST_TIMEOUT: { status: 408, title: 'Permintaan melebihi waktu', slug: 'request-timeout' },
  INTERNAL_ERROR: { status: 500, title: 'Kesalahan internal', slug: 'internal-error' },
  SERVICE_UNAVAILABLE: {
    status: 503,
    title: 'Layanan tidak tersedia',
    slug: 'service-unavailable',
  },
  MODEL_UNAVAILABLE: {
    status: 503,
    title: 'Layanan skor tidak tersedia',
    slug: 'model-unavailable',
  },
  DEPENDENCY_UNAVAILABLE: {
    status: 503,
    title: 'Layanan pendukung tidak tersedia',
    slug: 'dependency-unavailable',
  },
} as const satisfies Record<string, ProblemDefinition>;

export type ProblemCode = keyof typeof PROBLEM_CODES;
export type ProblemStatus = (typeof PROBLEM_CODES)[ProblemCode]['status'];

const problemCodeSet: ReadonlySet<string> = new Set(Object.keys(PROBLEM_CODES));

export function isProblemCode(value: unknown): value is ProblemCode {
  return typeof value === 'string' && problemCodeSet.has(value);
}

export function definitionForProblem(code: ProblemCode): ProblemDefinition {
  return PROBLEM_CODES[code];
}

export function statusForProblem(code: ProblemCode): ProblemStatus {
  return PROBLEM_CODES[code].status;
}