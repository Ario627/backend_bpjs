import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getTraceId } from '../context/request-context';
import type { PinoLoggerService } from '../logging/pino-logger.service';
import { AppError, type FieldIssue } from './app-error';
import { buildProblemDetails, PROBLEM_CONTENT_TYPE, type ProblemDetails } from './problem-details';
import type { ProblemCode } from './problem-code';

const MAX_DETAIL_LENGTH = 300;
const MAX_ISSUES = 50;

const STATUS_TO_CODE: Readonly<Record<number, ProblemCode>> = {
  400: 'VALIDATION_ERROR',
  401: 'AUTH_TOKEN_INVALID',
  403: 'AUTH_FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  408: 'REQUEST_TIMEOUT',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

const DETAIL_OVERRIDES: Readonly<Partial<Record<ProblemCode, string>>> = {
  NOT_FOUND: 'Resource tidak ditemukan.',
  METHOD_NOT_ALLOWED: 'Metode HTTP tidak didukung untuk resource ini.',
  PAYLOAD_TOO_LARGE: 'Ukuran permintaan melebihi batas.',
  UNSUPPORTED_MEDIA_TYPE: 'Tipe konten tidak didukung.',
  RATE_LIMITED: 'Terlalu banyak permintaan. Coba lagi nanti.',
  CSRF_REJECTED: 'Permintaan lintas situs ditolak.',
  INTERNAL_ERROR: 'Terjadi kesalahan internal.',
  SERVICE_UNAVAILABLE: 'Layanan sedang tidak tersedia.',
};

function codeForStatus(status: number): ProblemCode {
  if (status >= 500) {
    return 'INTERNAL_ERROR';
  }

  return STATUS_TO_CODE[status] ?? 'VALIDATION_ERROR';
}

function codeForHttpException(exception: HttpException): ProblemCode {
  if (exception.getStatus() === 403 && /cross-origin|csrf/i.test(exception.message)) {
    return 'CSRF_REJECTED';
  }

  return codeForStatus(exception.getStatus());
}

function safeDetail(message: unknown, fallback: string): string {
  if (typeof message !== 'string') {
    return fallback;
  }

  const trimmed = message.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_DETAIL_LENGTH) {
    return fallback;
  }

  return trimmed;
}

function detailFromHttpException(exception: HttpException, code: ProblemCode): string {
  if (exception.getStatus() >= 500) {
    return DETAIL_OVERRIDES[code] ?? 'Terjadi kesalahan internal.';
  }

  return DETAIL_OVERRIDES[code] ?? safeDetail(exception.message, 'Permintaan tidak dapat diproses.');
}

function issuesFromHttpException(exception: HttpException): readonly FieldIssue[] {
  const payload = exception.getResponse();

  if (typeof payload !== 'object' || payload === null || !('message' in payload)) {
    return [];
  }

  const message = payload.message;

  if (!Array.isArray(message)) {
    return [];
  }

  const issues: FieldIssue[] = [];

  for (const item of message) {
    if (typeof item === 'string') {
      issues.push({ field: '_', message: item });
    }

    if (issues.length === MAX_ISSUES) {
      break;
    }
  }

  return issues;
}

function statusFromUnknown(exception: unknown): number | null {
  if (typeof exception !== 'object' || exception === null) {
    return null;
  }

  let candidate: unknown;

  if ('status' in exception) {
    candidate = exception.status;
  } else if ('statusCode' in exception) {
    candidate = exception.statusCode;
  } else {
    return null;
  }

  if (typeof candidate !== 'number' || !Number.isInteger(candidate)) {
    return null;
  }

  return candidate >= 400 && candidate < 500 ? candidate : null;
}

function toProblem(exception: unknown, traceId: string, instance: string): ProblemDetails {
  if (exception instanceof AppError) {
    return buildProblemDetails({
      code: exception.code,
      detail: exception.detail,
      traceId,
      instance,
      ...(exception.issues.length === 0 ? {} : { issues: exception.issues }),
    });
  }

  if (exception instanceof HttpException) {
    const code = codeForHttpException(exception);
    const issues = issuesFromHttpException(exception);

    return buildProblemDetails({
      code,
      status: exception.getStatus(),
      detail: detailFromHttpException(exception, code),
      traceId,
      instance,
      ...(issues.length === 0 ? {} : { issues }),
    });
  }

  const clientStatus = statusFromUnknown(exception);

  if (clientStatus !== null) {
    const code = codeForStatus(clientStatus);

    return buildProblemDetails({
      code,
      status: clientStatus,
      detail: DETAIL_OVERRIDES[code] ?? 'Permintaan tidak dapat diproses.',
      traceId,
      instance,
    });
  }

  return buildProblemDetails({
    code: 'INTERNAL_ERROR',
    detail: 'Terjadi kesalahan internal.',
    traceId,
    instance,
  });
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLoggerService) {}

  private log(exception: unknown, problem: ProblemDetails, request: Request): void {
    const fields = {
      status: problem.status,
      code: problem.code,
      method: request.method,
      path: request.path,
    };

    if (problem.status >= 500) {
      this.logger.reportError('Permintaan gagal', exception, fields);
      return;
    }

    if (problem.code === 'NOT_FOUND') {
      this.logger.debug('Resource tidak ditemukan', fields);
      return;
    }

    this.logger.warn('Permintaan ditolak', fields);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.reportError('Exception pada konteks non-HTTP', exception);
      return;
    }

    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const problem = toProblem(exception, getTraceId(), request.path);

    this.log(exception, problem, request);

    if (response.headersSent) {
      response.end();
      return;
    }

    response.setHeader('Content-Type', PROBLEM_CONTENT_TYPE);
    response.setHeader('Cache-Control', 'no-store');
    response.status(problem.status).json(problem);
  }
}