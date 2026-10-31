/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { Freshness, GetFreshnessParams } from './Freshness.js';
import { getFreshness } from './Freshness.js';

const POLLED_AT = 1_000_000;
const QUIET: GetFreshnessParams = {
    now: POLLED_AT,
    lastSuccessAt: POLLED_AT,
    intervalMs: 30_000,
    checking: false,
    online: true,
    failing: false,
    pausedUntil: null,
};

test('a running poll stays quiet while the last success is fresh, and shows only once it is not', () => {
    const fresh: Freshness = { kind: 'fresh', checkedAt: POLLED_AT };
    expect(getFreshness({ ...QUIET, now: POLLED_AT + 40_000, checking: true })).toEqual(fresh);

    const checking: Freshness = { kind: 'checking', since: POLLED_AT };
    expect(getFreshness({ ...QUIET, now: POLLED_AT + 50_000, checking: true })).toEqual(checking);

    const late: Freshness = { kind: 'stale', since: POLLED_AT, reason: 'late' };
    expect(getFreshness({ ...QUIET, now: POLLED_AT + 50_000 })).toEqual(late);
});

test('a first download is partial; what keeps it from finishing — the allowance, the connection, GitHub — wins', () => {
    const never = { ...QUIET, lastSuccessAt: null, checking: true };

    expect(getFreshness(never)).toEqual({ kind: 'partial' });
    expect(getFreshness({ ...never, failing: true })).toEqual({ kind: 'stale', since: null, reason: 'failing' });
    expect(getFreshness({ ...never, failing: true, online: false })).toEqual({
        kind: 'stale',
        since: null,
        reason: 'offline',
    });
    expect(getFreshness({ ...never, online: false, pausedUntil: POLLED_AT + 1 })).toEqual({
        kind: 'paused',
        since: null,
        until: POLLED_AT + 1,
    });
});
