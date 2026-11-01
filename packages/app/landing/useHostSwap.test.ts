import { afterEach, beforeEach, expect, jest, test } from 'bun:test';
import { effectScope } from 'vue';
import type { EffectScope } from 'vue';

import { useHostSwap } from './useHostSwap.js';
import type { HostSwapViewModel } from './useHostSwap.js';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

// The component the loop lives in.
let scope: EffectScope;
// The visitor's motion setting, as the browser would answer it: `bun test` has no `window`.
let reducedMotion: boolean;

beforeEach(() => {
    scope = effectScope();
    reducedMotion = false;
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { matchMedia: (query: string) => ({ matches: query === REDUCED_MOTION && reducedMotion }) },
    });
    jest.useFakeTimers();
});

afterEach(() => {
    scope.stop();
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
});

test('rests on githq’s address, as the prerendered page shows it', () => {
    const swap = startSwap();

    expect(swap.step).toBe('githq');
    expect(swap.host).toBe('githq.dev');
    expect(swap.played).toBe(false);
});

test('plays the storyboard: select GitHub’s host at 0.6 s, type githq’s in from 1.2 s, Enter at 2.0 s', () => {
    const swap = startSwap();

    swap.play();
    expect(swap.played).toBe(true);
    expect([swap.step, swap.host]).toEqual(['github', 'github.com']);

    jest.advanceTimersByTime(600);
    expect([swap.step, swap.host]).toEqual(['selected', 'github.com']);

    jest.advanceTimersByTime(600);
    expect([swap.step, swap.host]).toEqual(['typing', '']);

    // 45 ms a character.
    jest.advanceTimersByTime(45 * 7);
    expect([swap.step, swap.host]).toEqual(['typing', 'githq.d']);

    jest.advanceTimersByTime(800 - 45 * 7);
    expect([swap.step, swap.host]).toEqual(['githq', 'githq.dev']);
});

test('a play while the loop plays does not start it over', () => {
    const swap = startSwap();

    swap.play();
    jest.advanceTimersByTime(1000);
    swap.play();
    expect(swap.step).toBe('selected');

    jest.advanceTimersByTime(1000);
    expect(swap.step).toBe('githq');
});

test('under reduced motion nothing moves: the address stays githq’s', () => {
    reducedMotion = true;
    const swap = startSwap();

    swap.play();
    jest.advanceTimersByTime(3000);

    expect(swap.played).toBe(false);
    expect([swap.step, swap.host]).toEqual(['githq', 'githq.dev']);
});

test('stops with the component: no step after it is gone', () => {
    const swap = startSwap();

    swap.play();
    scope.stop();
    jest.advanceTimersByTime(3000);

    expect(swap.step).toBe('github');
});

function startSwap(): HostSwapViewModel {
    const swap = scope.run(useHostSwap);
    if (!swap) {
        throw new Error('The scope is stopped');
    }
    return swap;
}
