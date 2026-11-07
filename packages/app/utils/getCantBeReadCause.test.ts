import { expect, test } from 'bun:test';

import type { CantBeReadCause } from '@/components/CantBeReadCause.js';

import { getCantBeReadCause } from './getCantBeReadCause.js';

const URL = 'https://github.com/acme/web';
const retry = () => Promise.resolve();

test('GitHub not showing it is "hidden" and refusing its changes "refused", both with the way to its page; no cause where there is no page to go to', () => {
    const hidden = { kind: 'stale', since: null, reason: 'hidden', of: 'repository' } as const;
    const refused = { kind: 'stale', since: 1, reason: 'refused' } as const;
    const hiddenCause: CantBeReadCause = { kind: 'hidden', url: URL };
    const refusedCause: CantBeReadCause = { kind: 'refused', url: URL };

    expect(getCantBeReadCause({ freshness: hidden, retry, url: URL })).toEqual(hiddenCause);
    expect(getCantBeReadCause({ freshness: refused, retry, url: URL })).toEqual(refusedCause);
    expect(getCantBeReadCause({ freshness: hidden, retry })).toBeNull();
    expect(getCantBeReadCause({ freshness: refused, retry })).toBeNull();
});

test('a poll merely late, and what is on its way, stand in the way of nothing', () => {
    expect(getCantBeReadCause({ freshness: { kind: 'stale', since: 1, reason: 'late' }, retry, url: URL })).toBeNull();
    expect(getCantBeReadCause({ freshness: { kind: 'partial' }, retry, url: URL })).toBeNull();
});

test('failing asks through the given retry; paused says until when', () => {
    expect(getCantBeReadCause({ freshness: { kind: 'stale', since: null, reason: 'failing' }, retry })).toEqual({
        kind: 'failing',
        retry,
    });
    expect(getCantBeReadCause({ freshness: { kind: 'paused', since: null, until: 42 }, retry })).toEqual({
        kind: 'paused',
        until: 42,
    });
});
