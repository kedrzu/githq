import { expect, test } from 'bun:test';

import { createExpiringReads } from './createExpiringReads.js';
import type { ExpiringValue } from './createExpiringReads.js';

interface Kept extends ExpiringValue {
    readonly text: string;
}

test('a fresh copy is used, an old one read again — once for every reader at a time', async () => {
    const harness = setup();
    harness.kept.set('a', { text: 'kept', fetchedAt: 0 });

    harness.time = 50;
    expect(await harness.reads.ensure('a')).toEqual({ text: 'kept', fetchedAt: 0 });
    expect(harness.calls).toEqual([]);

    harness.time = 150;
    const [first, second] = await Promise.all([harness.reads.ensure('a'), harness.reads.ensure('a')]);
    expect(first).toEqual({ text: 'read a', fetchedAt: 150 });
    expect(second).toBe(first);
    expect(harness.calls).toEqual(['a']);
});

test('a read that finds nothing falls back to the old copy, or nothing without one', async () => {
    const harness = setup();
    harness.answer = null;
    harness.kept.set('a', { text: 'kept', fetchedAt: 0 });
    harness.time = 150;

    expect(await harness.reads.ensure('a')).toEqual({ text: 'kept', fetchedAt: 0 });
    expect(await harness.reads.ensure('b')).toBeNull();
});

test('an age asked for overrides the usual one', async () => {
    const harness = setup();
    harness.kept.set('a', { text: 'kept', fetchedAt: 0 });
    harness.time = 10;

    expect(await harness.reads.ensure('a', 0)).toEqual({ text: 'read a', fetchedAt: 10 });
});

/** The clock, the copies kept and the reads made, as a test drives them. */
interface Harness {
    time: number;
    /** What a read finds; `null`: nothing. */
    answer: string | null;
    readonly kept: Map<string, Kept>;
    readonly calls: string[];
}

function setup() {
    const harness: Harness = { time: 0, answer: 'read', kept: new Map(), calls: [] };
    const reads = createExpiringReads<string, Kept>({
        now: () => harness.time,
        maxAgeMs: 100,
        getKept: key => harness.kept.get(key),
        read: key => {
            harness.calls.push(key);
            if (harness.answer === null) {
                return Promise.resolve(null);
            }

            const value = { text: `${harness.answer} ${key}`, fetchedAt: harness.time };
            harness.kept.set(key, value);
            return Promise.resolve(value);
        },
    });
    return Object.assign(harness, { reads });
}
