import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AppConfig } from '../../config/configuration';

const JSON_BODY_TYPES = ['application/json', 'application/*+json'] as const;
const ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] as const;
const ALLOWED_HEADERS = ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'] as const;
const EXPOSED_HEADERS = [
  'X-Request-Id',
  'Retry-After',
  'RateLimit-Limit',
  'RateLimit-Remaining',
  'RateLimit-Reset',
] as const;

export function applyTrustProxy(app: NestExpressApplication, config: AppConfig): void {
  app.set('trust proxy', config.http.trustProxy);
}

export function applyExpressHardening(app: NestExpressApplication): void {
  app.disable('x-powered-by');
  app.set('etag', false);
  app.set('json escape', true);
  app.set('query parser', 'simple');
}

export function applyServerTimeouts(app: NestExpressApplication): void {
  const server = app.getHttpServer();

  server.requestTimeout = 30_000;
  server.headersTimeout = 66_000;
  server.keepAliveTimeout = 65_000;
  server.maxHeadersCount = 100;
}

export function applyBodyLimits(app: NestExpressApplication, config: AppConfig): void {
  app.useBodyParser('json', {
    limit: config.bodyLimitBytes,
    strict: true,
    inflate: false,
    type: [...JSON_BODY_TYPES],
  });

  app.useBodyParser('urlencoded', {
    limit: config.bodyLimitBytes,
    extended: false,
    inflate: false,
    parameterLimit: 100,
  });
}

export function applyCors(app: NestExpressApplication, config: AppConfig): void {
  app.enableCors({
    origin: [...config.http.corsOrigins],
    credentials: true,
    methods: [...ALLOWED_METHODS],
    allowedHeaders: [...ALLOWED_HEADERS],
    exposedHeaders: [...EXPOSED_HEADERS],
    maxAge: 600,
    optionsSuccessStatus: 204,
  });
}

export function applySecurityHeaders(app: NestExpressApplication, config: AppConfig): void {
  app.useSecurityHeaders({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': "'none'",
        'base-uri': "'none'",
        'form-action': "'none'",
        'frame-ancestors': "'none'",
        'object-src': "'none'",
        'script-src': "'none'",
        'style-src': "'none'",
        'img-src': "'none'",
        'font-src': "'none'",
        'connect-src': "'none'",
        'manifest-src': "'none'",
        'media-src': "'none'",
        'worker-src': "'none'",
      },
    },
    crossOriginEmbedderPolicy: { policy: 'require-corp' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: {
      maxAge: config.http.hstsMaxAgeSeconds,
      includeSubDomains: true,
      preload: false,
    },
    xContentTypeOptions: true,
    xDnsPrefetchControl: { allow: false },
    xDownloadOptions: true,
    xFrameOptions: { action: 'deny' },
    xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
    xPoweredBy: true,
    xXssProtection: true,
    originAgentCluster: true,
  });
}

export function applyCsrfProtection(app: NestExpressApplication, config: AppConfig): void {
  app.enableCsrfProtection({ trustedOrigins: [...config.http.corsOrigins] });
}

export function configureHttpSecurity(app: NestExpressApplication, config: AppConfig): void {
  applyTrustProxy(app, config);
  applyExpressHardening(app);
  applyServerTimeouts(app);
  applySecurityHeaders(app, config);
  applyCsrfProtection(app, config);
  applyCors(app, config);
  applyBodyLimits(app, config);
}