import { onTestFinished, vi } from 'vitest';

/**
 * Runs a story (`() => Story.run()`) with `setTimeout`/`clearTimeout` faked until the test ends, so that its toasts'
 * lifetimes run only when the test moves the clock: on a loaded run a real one closes a toast before the test acts on
 * it. The run itself waits on zero-delay timers (axe's queue, for the a11y check), so the clock steps 1 ms a frame
 * until it is done: within a test's timeout that stays far below the 6 s of the briefest toast.
 *
 * @util
 */
export async function holdToastLifetimes(run: () => Promise<void>) {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    onTestFinished(() => {
        vi.useRealTimers();
    });

    const running = run();
    while (!(await Promise.race([running.then(() => true), nextFrame()]))) {
        await vi.advanceTimersByTimeAsync(1);
    }
}

function nextFrame() {
    return new Promise<false>(resolve => {
        requestAnimationFrame(() => {
            resolve(false);
        });
    });
}
