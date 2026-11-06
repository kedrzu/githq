import { afterEach, beforeEach, expect, jest, mock, test } from 'bun:test';
import { effectScope, nextTick, shallowRef } from 'vue';
import type { EffectScope } from 'vue';

import { useCandidateLookup } from './useCandidateLookup.js';
import type { TrackingReference } from './utils/parseTrackingReference.js';

// The picker the lookup lives in.
let scope: EffectScope;

beforeEach(() => {
    scope = effectScope();
    jest.useFakeTimers();
});

afterEach(() => {
    scope.stop();
    jest.useRealTimers();
});

test('only what stays named for 300 ms is looked up: typing on cancels the wait', async () => {
    const named = shallowRef<TrackingReference | null>(repository('on'));
    const find = mock((_: TrackingReference) => Promise.resolve(null));
    scope.run(() => useCandidateLookup({ reference: () => named.value, find, accept: candidate => candidate }));

    jest.advanceTimersByTime(299);
    named.value = repository('one');
    await nextTick();
    jest.advanceTimersByTime(299);
    expect(find).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(find.mock.calls).toEqual([[repository('one')]]);
});

function repository(name: string): TrackingReference {
    return { kind: 'repository', owner: 'first', name };
}
