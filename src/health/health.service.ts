import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  HEALTH_INDICATORS,
  type ComponentReport,
  type HealthIndicator,
  type ReadinessReport,
  type ReadinessStatus,
} from './health.indicator';

const INDICATOR_TIMEOUT_MS = 1500;

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Health check timeout')), timeoutMs);

    timer.unref();

    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function runIndicator(indicator: HealthIndicator): Promise<ComponentReport> {
  const startedAt = performance.now();

  try {
    await withTimeout(indicator.ping(AbortSignal.timeout(INDICATOR_TIMEOUT_MS)), INDICATOR_TIMEOUT_MS);

    return {
      name: indicator.name,
      critical: indicator.critical,
      status: 'up',
      latency_ms: roundMs(performance.now() - startedAt),
    };
  } catch {
    return {
      name: indicator.name,
      critical: indicator.critical,
      status: 'down',
      latency_ms: roundMs(performance.now() - startedAt),
    };
  }
}

function summarize(checks: readonly ComponentReport[]): ReadinessStatus {
  if (checks.some((check) => check.critical && check.status === 'down')) {
    return 'down';
  }

  if (checks.some((check) => check.status === 'down')) {
    return 'degraded';
  }

  return 'ok';
}

@Injectable()
export class HealthService {
  constructor(
    @Optional()
    @Inject(HEALTH_INDICATORS)
    private readonly indicators: readonly HealthIndicator[] = [],
  ) {}

  async checkReadiness(): Promise<ReadinessReport> {
    const checks = await Promise.all(this.indicators.map((indicator) => runIndicator(indicator)));

    return Object.freeze({
      status: summarize(checks),
      checks: Object.freeze(checks),
    });
  }

  getUptimeSeconds(): number {
    return Math.floor(process.uptime());
  }
}