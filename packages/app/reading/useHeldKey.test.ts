/// <reference types="bun" />
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { injectionKey } from '@nzyme/vue-ioc/injectionKey.js';
import { expect, test } from 'bun:test';
import { createApp, effectScope } from 'vue';

import { Clock } from '@/services/Clock.js';

import { REPEAT_GAP_MS, useHeldKey } from './useHeldKey.js';

test('a run soon after the previous one the same way is a repeat; the first, one the other way, or one after a pause is a press', () => {
    const { held, advance } = open();

    expect(held.isRepeat(1)).toBe(false);
    advance(500);
    expect(held.isRepeat(1)).toBe(true);
    advance(30);
    expect(held.isRepeat(1)).toBe(true);
    advance(30);
    expect(held.isRepeat(-1)).toBe(false);
    advance(30);
    expect(held.isRepeat(1)).toBe(false);
    advance(REPEAT_GAP_MS);
    expect(held.isRepeat(1)).toBe(false);
});

function open() {
    let now = 1_000_000;
    const container = createContainer();
    container.set(Clock, { now: () => now, schedule: () => () => undefined });
    const app = createApp({});
    app.provide(injectionKey, container);
    const scope = effectScope();
    const held = app.runWithContext(() => scope.run(() => useHeldKey()));
    if (!held) {
        throw new Error('The scope runs');
    }

    return { held, advance };

    function advance(ms: number) {
        now += ms;
    }
}
