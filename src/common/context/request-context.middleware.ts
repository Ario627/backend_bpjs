import type { NextFunction, Request, Response } from 'express';
import {
  TRACE_ID_HEADER,
  createRequestContext,
  resolveTraceId,
  runWithRequestContext,
} from './request-context';

export function requestContextMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const traceId = resolveTraceId(request.headers[TRACE_ID_HEADER]);
  const context = createRequestContext(request.method, request.path, traceId);

  response.setHeader('X-Request-Id', traceId);
  runWithRequestContext(context, next);
}