import { onScopeDispose, ref } from 'vue';

import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';

import { prefersReducedMotion } from './prefersReducedMotion.js';

/** The host of a GitHub address, before the swap. */
export const GITHUB_HOST = 'github.com';
/** The host that opens the same address in githq. */
export const GITHQ_HOST = 'githq.dev';
/** The path of the address whose host the loop swaps: an address, not words to translate. */
export const SWAP_PATH = '/acme/web/issues/42';

/**
 * Where the "swap the host" loop is (githq.pen "Landing — motion storyboard"): `github` — a GitHub address, the
 * caret blinking after the host; `selected` — the host highlighted as if double-clicked; `typing` — githq's host
 * typing in; `githq` — entered, and where the loop rests (the prerendered state).
 */
export type HostSwapStep = 'github' | 'selected' | 'typing' | 'githq';

/** The "swap the host" loop for `HostSwapLoop`. */
export interface HostSwapViewModel {
    readonly step: HostSwapStep;
    /** The host the address shows now: part of githq's while it types in. */
    readonly host: string;
    /** Whether the loop has played since mount: from then on, `githq` is a step entered rather than the page as it came. */
    readonly played: boolean;
    /** Plays the loop once, from the GitHub address to githq's; nothing while it plays or under reduced motion. */
    play(): void;
}

// The storyboard's timings, in ms from the start.
const SELECT_AT = 600;
const TYPE_AT = 1200;
const CHARACTER_EVERY = 45;
const ENTER_AT = 2000;

/** Times the "swap the host" loop: it rests on githq's address and plays on `play()`. Timers die with the component. */
export function useHostSwap(): HostSwapViewModel {
    const step = ref<HostSwapStep>('githq');
    const host = ref(GITHQ_HOST);
    const played = ref(false);
    const timers: ReturnType<typeof setTimeout>[] = [];

    onScopeDispose(clearTimers);

    return reactive<HostSwapViewModel>({ step, host, played, play });

    function play() {
        if (step.value !== 'githq' || prefersReducedMotion()) {
            return;
        }

        clearTimers();
        played.value = true;
        show('github', GITHUB_HOST);
        at(SELECT_AT, () => show('selected', GITHUB_HOST));
        at(TYPE_AT, () => show('typing', ''));
        for (let length = 1; length <= GITHQ_HOST.length; length++) {
            at(TYPE_AT + length * CHARACTER_EVERY, () => show('typing', GITHQ_HOST.slice(0, length)));
        }
        at(ENTER_AT, () => show('githq', GITHQ_HOST));
    }

    function show(nextStep: HostSwapStep, nextHost: string) {
        step.value = nextStep;
        host.value = nextHost;
    }

    function at(delay: number, action: () => void) {
        timers.push(setTimeout(action, delay));
    }

    function clearTimers() {
        for (const timer of timers) {
            clearTimeout(timer);
        }
        timers.length = 0;
    }
}
