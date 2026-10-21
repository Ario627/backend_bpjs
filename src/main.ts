import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { requestContextMiddleware } from './common/context/request-context.middleware';
import { ProblemDetailsFilter } from './common/errors/problem-details.filter';
import { validationExceptionFactory } from './common/errors/validation';
import { noStoreMiddleware } from './common/http/cache-control.middleware';
import { configureHttpSecurity } from './common/http/security';
import { createAccessLogMiddleware } from './common/logging/access-log.middleware';
import { PinoLoggerService } from './common/logging/pino-logger.service';
import { AppConfigService } from './config/app-config.service';

const GLOBAL_PREFIX_EXCLUSIONS = [
  { path: 'healthz', method: RequestMethod.GET },
  { path: 'readyz', method: RequestMethod.GET },
] as const;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
    abortOnError: true,
    forceCloseConnections: true,
  });

  const logger = app.get(PinoLoggerService);
  app.useLogger(logger);

  const config = app.get(AppConfigService).value;

  app.setGlobalPrefix(config.apiPrefix, { exclude: [...GLOBAL_PREFIX_EXCLUSIONS] });
  app.use(requestContextMiddleware);
  app.use(noStoreMiddleware);
  app.use(createAccessLogMiddleware(logger));

  configureHttpSecurity(app, config);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
      stopAtFirstError: false,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.useGlobalFilters(new ProblemDetailsFilter(logger));
  app.enableShutdownHooks();

  await app.listen(config.port, config.host);

  logger.log(
    `API berjalan di http://${config.host}:${config.port}/${config.apiPrefix}`,
    'Bootstrap',
  );
}

void bootstrap();
