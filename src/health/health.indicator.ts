export const HEALTH_INDICATORS = Symbol('HEALTH_INDICATORS');

export interface HealthIndicator {
  readonly name: string;
  readonly critical: boolean;
  ping(signal: AbortSignal): Promise<void>;
}

export type ComponentStatus = 'up' | 'down';

export interface ComponentReport {
  readonly name: string;
  readonly critical: boolean;
  readonly status: ComponentStatus;
  readonly latency_ms: number;
}

export type ReadinessStatus = 'ok' | 'degraded' | 'down';

export interface ReadinessReport {
  readonly status: ReadinessStatus;
  readonly checks: readonly ComponentReport[];
}