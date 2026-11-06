import { expect, test } from 'bun:test';

import type { CantBeReadCause } from '@/components/CantBeReadCause.js';

import { getCantBeReadCause } from './getCantBeReadCause.js';

const URL = 'https://github.com/acme/web';
const retry = () => Promise.resolve();

test('GitHub refusing is "hidden" with the way to its page, and no cause where there is no page to go to', () => {
    const freshness = { kind: 'stale', since: null, reason: 'refused' } as const;
    const hidden: CantBeReadCause = { kind: 'hidden', url: URL };

    expect(getCantBeReadCause({ freshness, retry, url: URL })).toEqual(hidden);
    expect(getCantBeReadCause({ freshness, retry })).toBeNull();
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
