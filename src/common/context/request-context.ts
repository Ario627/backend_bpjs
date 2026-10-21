import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export const TRACE_ID_HEADER = 'x-request-id';

const TRACE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;

export const USER_ROLES = [
  'VERIFIER',
  'CODER',
  'MANAGER',
  'GOVERNANCE',
  'ADMIN',
  'SUPER_ADMIN',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

const USER_ROLE_SET: ReadonlySet<string> = new Set<string>(USER_ROLES);

export interface RequestActor {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: UserRole;
}

export interface RequestSnapshot {
  readonly traceId: string;
  readonly method: string;
  readonly path: string;
}

export class RequestContext {
  private actor: RequestActor | null = null;

  constructor(readonly snapshot: RequestSnapshot) {}

  get traceId(): string {
    return this.snapshot.traceId;
  }

  get currentActor(): RequestActor | null {
    return this.actor;
  }

  assignActor(actor: RequestActor): void {
    if (this.actor !== null) {
      const unchanged =
        this.actor.userId === actor.userId &&
        this.actor.tenantId === actor.tenantId &&
        this.actor.role === actor.role;

      if (!unchanged) {
        throw new Error('Aktor request tidak boleh diganti di tengah request');
      }

      return;
    }

    this.actor = Object.freeze({ ...actor });
  }
}

const storage = new AsyncLocalStorage<RequestContext>();

export function resolveTraceId(candidate: unknown): string {
  if (typeof candidate === 'string' && TRACE_ID_PATTERN.test(candidate)) {
    return candidate;
  }

  return randomUUID();
}

export function createRequestContext(method: string, path: string, traceId: string): RequestContext {
  return new RequestContext(Object.freeze({ traceId, method, path }));
}

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return storage.run(context, callback);
}

export function getRequestContext(): RequestContext | null {
  return storage.getStore() ?? null;
}

export function getTraceId(): string {
  return storage.getStore()?.traceId ?? 'unknown';
}

export function getRequestActor(): RequestActor | null {
  return storage.getStore()?.currentActor ?? null;
}

export function assignRequestActor(actor: RequestActor): void {
  const context = storage.getStore();

  if (context === undefined) {
    throw new Error('Request context belum tersedia');
  }

  context.assignActor(actor);
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLE_SET.has(value);
}