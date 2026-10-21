import { z } from 'zod';

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean' || value === undefined) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === '') {
    return undefined;
  }

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return value;
}, z.boolean().optional());

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.url().optional(),
);

const corsOrigins = z
  .string()
  .default('http://localhost:5173')
  .transform((value) =>
    Array.from(
      new Set(
        value
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      ),
    ),
  )
  .pipe(
    z
      .array(z.url())
      .min(1)
      .transform((origins) => Array.from(new Set(origins.map((origin) => new URL(origin).origin)))),
  );

const databaseUrl = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'postgres:' || protocol === 'postgresql:';
}, { message: 'DATABASE_URL harus memakai protokol postgresql' });

const redisUrl = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'redis:' || protocol === 'rediss:';
}, { message: 'REDIS_URL harus memakai protokol redis atau rediss' });

const mlServiceUrl = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'http:' || protocol === 'https:';
}, { message: 'ML_SERVICE_URL harus memakai protokol http atau https' });

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).max(253).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    DATABASE_URL: databaseUrl,
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),

    REDIS_URL: redisUrl,
    REDIS_KEY_PREFIX: z.string().min(1).max(32).default('jaga'),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().min(3600).max(2592000).default(604800),
    JWT_ISSUER: z.string().min(1).max(64).default('jaga-klaim'),
    JWT_AUDIENCE: z.string().min(1).max(64).default('jaga-klaim-api'),

    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
    LOGIN_LOCK_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
    REFRESH_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]{3,32}$/).default('jaga_refresh'),

    ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, { message: 'ENCRYPTION_KEY harus 64 karakter heksadesimal' }),

    CORS_ORIGINS: corsOrigins,
    COOKIE_SECURE: booleanFromEnv,
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
    HSTS_MAX_AGE_SECONDS: z.coerce.number().int().min(0).max(63072000).default(15552000),
    BODY_LIMIT_BYTES: z.coerce.number().int().min(1024).max(10485760).default(1048576),

    ML_SERVICE_URL: mlServiceUrl,
    ML_SERVICE_TOKEN: z.string().min(16),
    ML_TIMEOUT_MS: z.coerce.number().int().min(100).max(10000).default(2000),
    ML_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(1),

    SCORING_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(4),
    SCORING_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
    SCORING_JOB_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(60000),
    RULEPACK_CACHE_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
    IDEMPOTENCY_TTL_HOURS: z.coerce.number().int().min(1).max(72).default(24),

    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
    S3_ENDPOINT: optionalUrl,
    S3_BUCKET: optionalString,
    S3_ACCESS_KEY: optionalString,
    S3_SECRET_KEY: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET harus berbeda dari JWT_ACCESS_SECRET',
      });
    }

    const storageKeys = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'] as const;
    const configuredStorage = storageKeys.filter((key) => env[key] !== undefined).length;

    if (configuredStorage > 0 && configuredStorage < storageKeys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['S3_ENDPOINT'],
        message: 'S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, dan S3_SECRET_KEY harus diisi bersama',
      });
    }

    if (env.NODE_ENV !== 'production') {
      return;
    }

    if (env.COOKIE_SECURE === false) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE wajib true di produksi',
      });
    }

    if (/^0+$/.test(env.ENCRYPTION_KEY)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ENCRYPTION_KEY'],
        message: 'ENCRYPTION_KEY contoh tidak boleh dipakai di produksi',
      });
    }

    const insecureMarkers = ['change-me', 'changeme', 'example', 'development'];
    const secretKeys = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'ML_SERVICE_TOKEN'] as const;

    for (const key of secretKeys) {
      if (insecureMarkers.some((marker) => env[key].toLowerCase().includes(marker))) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} masih memakai nilai contoh`,
        });
      }
    }

    if (env.CORS_ORIGINS.some((origin) => new URL(origin).protocol !== 'https:')) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'CORS_ORIGINS harus memakai HTTPS di produksi',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);

  if (result.success) {
    return result.data;
  }

  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'ENV'}: ${issue.message}`)
    .join('\n');

  throw new Error(`Konfigurasi environment tidak valid:\n${details}`);
}