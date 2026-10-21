import { Injectable, type LoggerService as NestLoggerService } from '@nestjs/common';
import pino, { type Logger, type LoggerOptions } from 'pino';
import { AppConfigService } from '../../config/app-config.service';
import { getRequestContext } from '../context/request-context';

export type LogLevelName = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const MAX_MESSAGE_LENGTH = 2000;

const REDACT_PATHS = [
  'password',
  '*.password',
  'newPassword',
  '*.newPassword',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'authorization',
  '*.authorization',
  'cookie',
  '*.cookie',
  'set-cookie',
  '*.set-cookie',
  'email',
  '*.email',
  'contact',
  '*.contact',
  'nik',
  '*.nik',
  'patientRef',
  '*.patientRef',
  'sepRef',
  '*.sepRef',
  'description',
  '*.description',
  'note',
  '*.note',
  'rationale',
  '*.rationale',
  'err.config.headers.authorization',
];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Error)
  );
}

function looksLikeStack(value: string): boolean {
  return value.includes('\n    at ') || value.startsWith('Error:');
}

function normalizeMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message.length > MAX_MESSAGE_LENGTH
      ? `${message.slice(0, MAX_MESSAGE_LENGTH)}...`
      : message;
  }

  if (message instanceof Error) {
    return message.message;
  }

  if (typeof message === 'number' || typeof message === 'boolean' || typeof message === 'bigint') {
    return String(message);
  }

  if (message === null || message === undefined) {
    return '';
  }

  try {
    const serialized = JSON.stringify(message);

    if (serialized === undefined) {
      return '[unserializable]';
    }

    return serialized.length > MAX_MESSAGE_LENGTH
      ? `${serialized.slice(0, MAX_MESSAGE_LENGTH)}...`
      : serialized;
  } catch {
    return '[unserializable]';
  }
}

function splitParams(params: readonly unknown[]): {
  context: string | null;
  fields: Record<string, unknown>;
} {
  let context: string | null = null;
  const fields: Record<string, unknown> = {};

  for (const param of params) {
    if (typeof param === 'string') {
      if (!looksLikeStack(param)) {
        context = param;
      }

      continue;
    }

    if (isPlainRecord(param)) {
      Object.assign(fields, param);
    }
  }

  return { context, fields };
}

function findError(params: readonly unknown[]): Error | undefined {
  for (const param of params) {
    if (param instanceof Error) {
      return param;
    }
  }

  return undefined;
}

function resolveStack(params: readonly unknown[]): string | undefined {
  for (const param of params) {
    if (typeof param === 'string' && looksLikeStack(param)) {
      return param;
    }
  }

  return undefined;
}

@Injectable()
export class PinoLoggerService implements NestLoggerService {
  private readonly logger: Logger;

  constructor(configService: AppConfigService) {
    const config = configService.value;
    const usePrettyTransport = !config.isProduction && !config.isTest;

    const options: LoggerOptions = {
      level: config.telemetry.logLevel,
      base: { service: 'jaga-klaim-api', env: config.nodeEnv },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      serializers: { err: pino.stdSerializers.err },
      redact: { paths: REDACT_PATHS, censor: '[redacted]' },
      mixin: () => {
        const requestContext = getRequestContext();

        if (requestContext === null) {
          return {};
        }

        const actor = requestContext.currentActor;

        return {
          trace_id: requestContext.traceId,
          ...(actor === null ? {} : { tenant_id: actor.tenantId, user_id: actor.userId }),
        };
      },
      ...(usePrettyTransport
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                singleLine: true,
                ignore: 'pid,hostname,service,env',
              },
            },
          }
        : {}),
    };

    this.logger = pino(options);
  }

  log(message: unknown, ...params: unknown[]): void {
    this.emit('info', message, params, {});
  }

  warn(message: unknown, ...params: unknown[]): void {
    this.emit('warn', message, params, {});
  }

  debug(message: unknown, ...params: unknown[]): void {
    this.emit('debug', message, params, {});
  }

  verbose(message: unknown, ...params: unknown[]): void {
    this.emit('trace', message, params, {});
  }

  fatal(message: unknown, ...params: unknown[]): void {
    this.emit('fatal', message, params, {});
  }

  error(message: unknown, ...params: unknown[]): void {
    this.emit('error', message, params, {});
  }

  write(level: LogLevelName, message: string, fields: Record<string, unknown>): void {
    this.emit(level, message, [], fields);
  }

  reportError(message: string, error: unknown, fields: Record<string, unknown> = {}): void {
    if (error instanceof Error) {
      this.emit('error', message, [error], fields);
      return;
    }

    this.emit('error', message, [], { ...fields, error });
  }

  private emit(
    level: LogLevelName,
    message: unknown,
    params: readonly unknown[],
    extraFields: Record<string, unknown>,
  ): void {
    const { context, fields } = splitParams(params);
    const error = message instanceof Error ? message : findError(params);
    const stack = error === undefined ? resolveStack(params) : undefined;
    const text = normalizeMessage(message);

    const payload: Record<string, unknown> = {
      ...extraFields,
      ...fields,
      ...(context === null ? {} : { context }),
      ...(stack === undefined ? {} : { stack }),
      ...(error === undefined ? {} : { err: error }),
    };

    switch (level) {
      case 'fatal':
        this.logger.fatal(payload, text);
        return;
      case 'error':
        this.logger.error(payload, text);
        return;
      case 'warn':
        this.logger.warn(payload, text);
        return;
      case 'info':
        this.logger.info(payload, text);
        return;
      case 'debug':
        this.logger.debug(payload, text);
        return;
      case 'trace':
        this.logger.trace(payload, text);
        return;
    }
  }
}