import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { requestContextMiddleware } from './../src/common/context/request-context.middleware';
import { ProblemDetailsFilter } from './../src/common/errors/problem-details.filter';
import { validationExceptionFactory } from './../src/common/errors/validation';
import { noStoreMiddleware } from './../src/common/http/cache-control.middleware';
import { PinoLoggerService } from './../src/common/logging/pino-logger.service';
import { PrismaService } from './../src/infrastructure/database/prisma.service';

describe('runtime (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ ping: async () => undefined })
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>({ bodyParser: false });
    app.setGlobalPrefix('api/v1', {
      exclude: [
        { path: 'healthz', method: RequestMethod.GET },
        { path: 'readyz', method: RequestMethod.GET },
      ],
    });
    app.use(requestContextMiddleware);
    app.use(noStoreMiddleware);
    app.useLogger(app.get(PinoLoggerService));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: validationExceptionFactory,
      }),
    );
    app.useGlobalFilters(new ProblemDetailsFilter(app.get(PinoLoggerService)));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('liveness mengembalikan 200 dan trace id', async () => {
    const response = await request(app.getHttpServer()).get('/healthz').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it('readiness melaporkan indikator database', async () => {
    const response = await request(app.getHttpServer()).get('/readyz').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.checks).toEqual([
      expect.objectContaining({ name: 'postgres', status: 'up', critical: true }),
    ]);
  });

  it('rute tidak dikenal memakai problem details', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/tidak-ada').expect(404);

    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body.code).toBe('NOT_FOUND');
    expect(response.body.trace_id).toBeDefined();
  });
});
