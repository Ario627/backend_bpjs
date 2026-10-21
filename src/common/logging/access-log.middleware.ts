import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { LogLevelName, PinoLoggerService } from './pino-logger.service';

const QUIET_PATHS: ReadonlySet<string> = new Set(['/healthz', '/readyz']);
const SLOW_REQUEST_MS = 1000;

function levelFor(status: number): LogLevelName {
  if (status >= 500) {
    return 'error';
  }

  if (status === 404) {
    return 'debug';
  }

  if (status >= 400) {
    return 'warn';
  }

  return 'info';
}

function roundDuration(value: number): number {
  return Math.round(value * 10) / 10;
}

export function createAccessLogMiddleware(logger: PinoLoggerService): RequestHandler {
  return function accessLogMiddleware(
    request: Request,
    response: Response,
    next: NextFunction,
  ): void {
    const startedAt = performance.now();
    const traceId = response.getHeader('X-Request-Id');
    let logged = false;

    const writeLog = (): void => {
      if (logged) {
        return;
      }

      logged = true;

      const status = response.statusCode;
      const durationMs = roundDuration(performance.now() - startedAt);
      const level = QUIET_PATHS.has(request.path) ? 'debug' : levelFor(status);

      logger.write(level, 'http_request', {
        method: request.method,
        path: request.path,
        status,
        duration_ms: durationMs,
        slow: durationMs >= SLOW_REQUEST_MS,
        aborted: !response.writableEnded,
        ...(typeof traceId === 'string' ? { trace_id: traceId } : {}),
      });
    };

    response.on('finish', writeLog);
    response.on('close', writeLog);

    next();
  };
}