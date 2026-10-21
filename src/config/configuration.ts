import { parseEnv, type Env } from './env.schema';

export type NodeEnvironment = Env['NODE_ENV'];
export type LogLevel = Env['LOG_LEVEL'];

export interface HttpConfig {
  readonly trustProxy: number;
  readonly corsOrigins: readonly string[];
  readonly hstsMaxAgeSeconds: number;
}

export interface AuthConfig {
  readonly accessSecret: string;
  readonly refreshSecret: string;
  readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;
  readonly issuer: string;
  readonly audience: string;
  readonly loginMaxAttempts: number;
  readonly loginLockSeconds: number;
  readonly refreshCookieName: string;
  readonly cookieSecure: boolean;
}

export interface CryptoConfig {
  readonly encryptionKey: Buffer;
}

export interface DatabaseConfig {
  readonly url: string;
  readonly poolMax: number;
  readonly statementTimeoutMs: number;
}

export interface RedisConfig {
  readonly url: string;
  readonly keyPrefix: string;
}

export interface MlConfig {
  readonly baseUrl: string;
  readonly token: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

export interface ScoringConfig {
  readonly concurrency: number;
  readonly maxAttempts: number;
  readonly jobTimeoutMs: number;
}

export interface RulepackConfig {
  readonly cacheTtlSeconds: number;
}

export interface IdempotencyConfig {
  readonly ttlHours: number;
}

export interface StorageConfig {
  readonly endpoint: string;
  readonly bucket: string;
  readonly accessKey: string;
  readonly secretKey: string;
}

export interface TelemetryConfig {
  readonly logLevel: LogLevel;
  readonly otelEndpoint: string | null;
}

export interface AppConfig {
  readonly nodeEnv: NodeEnvironment;
  readonly isProduction: boolean;
  readonly isTest: boolean;
  readonly host: string;
  readonly port: number;
  readonly apiPrefix: string;
  readonly bodyLimitBytes: number;
  readonly http: HttpConfig;
  readonly auth: AuthConfig;
  readonly crypto: CryptoConfig;
  readonly database: DatabaseConfig;
  readonly redis: RedisConfig;
  readonly ml: MlConfig;
  readonly scoring: ScoringConfig;
  readonly rulepack: RulepackConfig;
  readonly idempotency: IdempotencyConfig;
  readonly storage: StorageConfig | null;
  readonly telemetry: TelemetryConfig;
}

const API_PREFIX = 'api/v1';

function createStorageConfig(env: Env): StorageConfig | null {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY } = env;

  if (
    S3_ENDPOINT === undefined ||
    S3_BUCKET === undefined ||
    S3_ACCESS_KEY === undefined ||
    S3_SECRET_KEY === undefined
  ) {
    return null;
  }

  return Object.freeze({
    endpoint: S3_ENDPOINT,
    bucket: S3_BUCKET,
    accessKey: S3_ACCESS_KEY,
    secretKey: S3_SECRET_KEY,
  });
}

export function loadAppConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const env = parseEnv(source);
  const isProduction = env.NODE_ENV === 'production';
  const cookieSecure = env.COOKIE_SECURE ?? isProduction;
  const mlBaseUrl = env.ML_SERVICE_URL.replace(/\/+$/, '');

  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    isProduction,
    isTest: env.NODE_ENV === 'test',
    host: env.HOST,
    port: env.PORT,
    apiPrefix: API_PREFIX,
    bodyLimitBytes: env.BODY_LIMIT_BYTES,
    http: Object.freeze({
      trustProxy: env.TRUST_PROXY,
      corsOrigins: Object.freeze([...env.CORS_ORIGINS]),
      hstsMaxAgeSeconds: env.HSTS_MAX_AGE_SECONDS,
    }),
    auth: Object.freeze({
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
      refreshTtlSeconds: env.JWT_REFRESH_TTL_SECONDS,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      loginMaxAttempts: env.LOGIN_MAX_ATTEMPTS,
      loginLockSeconds: env.LOGIN_LOCK_SECONDS,
      refreshCookieName: env.REFRESH_COOKIE_NAME,
      cookieSecure,
    }),
    crypto: Object.freeze({
      encryptionKey: Buffer.from(env.ENCRYPTION_KEY, 'hex'),
    }),
    database: Object.freeze({
      url: env.DATABASE_URL,
      poolMax: env.DATABASE_POOL_MAX,
      statementTimeoutMs: env.DATABASE_STATEMENT_TIMEOUT_MS,
    }),
    redis: Object.freeze({
      url: env.REDIS_URL,
      keyPrefix: `${env.REDIS_KEY_PREFIX}:`,
    }),
    ml: Object.freeze({
      baseUrl: mlBaseUrl,
      token: env.ML_SERVICE_TOKEN,
      timeoutMs: env.ML_TIMEOUT_MS,
      maxRetries: env.ML_MAX_RETRIES,
    }),
    scoring: Object.freeze({
      concurrency: env.SCORING_CONCURRENCY,
      maxAttempts: env.SCORING_MAX_ATTEMPTS,
      jobTimeoutMs: env.SCORING_JOB_TIMEOUT_MS,
    }),
    rulepack: Object.freeze({
      cacheTtlSeconds: env.RULEPACK_CACHE_TTL_SECONDS,
    }),
    idempotency: Object.freeze({
      ttlHours: env.IDEMPOTENCY_TTL_HOURS,
    }),
    storage: createStorageConfig(env),
    telemetry: Object.freeze({
      logLevel: env.LOG_LEVEL,
      otelEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT ?? null,
    }),
  });
}