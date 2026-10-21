import { ForbiddenError } from '../../common/errors/app-error';
import {
  DEFAULT_TENANT_TIMEOUT_MS,
  backoffMs,
  isUuid,
  parseTenantSession,
} from './tenant-transaction';

const TENANT_ID = '01920000-0000-7000-8000-000000000001';
const ACTOR_ID = '01920000-0000-7000-8000-0000000000ff';

describe('isUuid', () => {
  it('menerima uuid v7', () => {
    expect(isUuid(TENANT_ID)).toBe(true);
  });

  it('menolak string biasa', () => {
    expect(isUuid('tenant-1')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(null)).toBe(false);
  });

  it('menolak uuid dengan varian tidak valid', () => {
    expect(isUuid('01920000-0000-7000-c000-000000000001')).toBe(false);
  });
});

describe('parseTenantSession', () => {
  it('mengembalikan sesi beku dengan default', () => {
    const session = parseTenantSession(TENANT_ID);

    expect(session).toEqual({
      tenantId: TENANT_ID,
      actorId: null,
      timeoutMs: DEFAULT_TENANT_TIMEOUT_MS,
    });
    expect(Object.isFrozen(session)).toBe(true);
  });

  it('menyertakan aktor bila diberikan', () => {
    expect(parseTenantSession(TENANT_ID, { actorId: ACTOR_ID }).actorId).toBe(ACTOR_ID);
  });

  it('menolak tenant yang tidak valid', () => {
    expect(() => parseTenantSession('bukan-uuid')).toThrow(ForbiddenError);
    expect(() => parseTenantSession(undefined)).toThrow(ForbiddenError);
  });

  it('menolak aktor yang tidak valid', () => {
    expect(() => parseTenantSession(TENANT_ID, { actorId: 'x' })).toThrow(
      'Konteks aktor tidak valid.',
    );
  });

  it('menolak timeout di luar batas', () => {
    expect(() => parseTenantSession(TENANT_ID, { timeoutMs: 10 })).toThrow(RangeError);
    expect(() => parseTenantSession(TENANT_ID, { timeoutMs: 120_000 })).toThrow(RangeError);
  });
});

describe('backoffMs', () => {
  it('meningkat tetapi dibatasi', () => {
    expect(backoffMs(1)).toBeGreaterThanOrEqual(25);
    expect(backoffMs(10)).toBeLessThanOrEqual(400);
  });
});