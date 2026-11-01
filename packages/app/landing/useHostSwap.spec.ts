import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { effectScope } from 'vue';
import type { EffectScope } from 'vue';

import { useHostSwap } from './useHostSwap.js';
import type { HostSwapViewModel } from './useHostSwap.js';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

// The component the loop lives in.
let scope: EffectScope;

beforeEach(() => {
    scope = effectScope();
    vi.useFakeTimers();
});

afterEach(() => {
    scope.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
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

    vi.advanceTimersByTime(600);
    expect([swap.step, swap.host]).toEqual(['selected', 'github.com']);

    vi.advanceTimersByTime(600);
    expect([swap.step, swap.host]).toEqual(['typing', '']);

    // 45 ms a character.
    vi.advanceTimersByTime(45 * 7);
    expect([swap.step, swap.host]).toEqual(['typing', 'githq.d']);

    vi.advanceTimersByTime(800 - 45 * 7);
    expect([swap.step, swap.host]).toEqual(['githq', 'githq.dev']);
});

test('a play while the loop plays does not start it over', () => {
    const swap = startSwap();

    swap.play();
    vi.advanceTimersByTime(1000);
    swap.play();
    expect(swap.step).toBe('selected');

    vi.advanceTimersByTime(1000);
    expect(swap.step).toBe('githq');
});

test('under reduced motion nothing moves: the address stays githq’s', () => {
    const matchMedia = window.matchMedia.bind(window);
    // A query the browser always matches stands in for the visitor's setting.
    vi.spyOn(window, 'matchMedia').mockImplementation(query =>
        matchMedia(query === REDUCED_MOTION ? '(min-width: 0px)' : query),
    );
    const swap = startSwap();

    swap.play();
    vi.advanceTimersByTime(3000);

    expect(swap.played).toBe(false);
    expect([swap.step, swap.host]).toEqual(['githq', 'githq.dev']);
});

test('stops with the component: no step after it is gone', () => {
    const swap = startSwap();

    swap.play();
    scope.stop();
    vi.advanceTimersByTime(3000);

    expect(swap.step).toBe('github');
});

function startSwap(): HostSwapViewModel {
    const swap = scope.run(useHostSwap);
    if (!swap) {
        throw new Error('The scope is stopped');
    }
    return swap;
}
