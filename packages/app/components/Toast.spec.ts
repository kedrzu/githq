import { composeStories } from '@storybook/vue3';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Locator } from 'vitest/browser';
import { nextTick } from 'vue';

import { TOAST_LASTS } from './Toast.vue';
import * as stories from './Toast.stories.jsx';

const { EditRejected, Lifetimes, Stack } = composeStories(stories);

test('Escape dismisses it, and the screen behind never sees that Escape', async () => {
    await EditRejected.run();
    const toast = page.getByRole('listitem');
    await expect.element(toast).toHaveTextContent('Label “regression” wasn’t added');

    await userEvent.keyboard('{Escape}');

    await expect.element(toast).not.toBeInTheDocument();
    await expect.element(page.getByTestId('dismissed')).toHaveTextContent('Dismissed: 1');
    await expect.element(page.getByTestId('escapes')).toHaveTextContent('Escapes seen behind: 0');
});

test('Escape typed into a field is the field’s: the toast stays', async () => {
    await EditRejected.run();

    await userEvent.click(page.getByRole('textbox', { name: 'Note' }));
    await userEvent.keyboard('{Escape}');

    await expect.element(page.getByRole('listitem')).toHaveTextContent('Label “regression” wasn’t added');
    await expect.element(page.getByTestId('dismissed')).toHaveTextContent('Dismissed: 0');
});

test('"Dismiss" dismisses it', async () => {
    await EditRejected.run();

    await userEvent.click(page.getByRole('button', { name: 'Dismiss' }).first());

    await expect.element(page.getByTestId('dismissed')).toHaveTextContent('Dismissed: 1');
});

test('only the newest toast takes Escape and its keys, and shows them; dismissed, it hands them to the one before', async () => {
    await Stack.run();
    const untrack = getToast('Stopped tracking fitloop/api');
    const close = getToast('Closed skyline-labs/portal#1187');

    await expectKeyHints(close, true);
    await expectKeyHints(untrack, false);

    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}');
    await expect.element(page.getByTestId('undone')).toHaveTextContent('Undone: close');

    await userEvent.keyboard('{Escape}');
    await expect.element(close).not.toBeInTheDocument();
    await expect.element(untrack).toBeInTheDocument();
    await expectKeyHints(untrack, true);

    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}');
    await expect.element(page.getByTestId('undone')).toHaveTextContent('Undone: close, untrack');
});

test('an older toast’s buttons still work with the mouse', async () => {
    await Stack.run();

    await userEvent.click(getToast('Stopped tracking fitloop/api').getByRole('button', { name: 'Undo' }));

    await expect.element(page.getByTestId('undone')).toHaveTextContent('Undone: untrack');
});

test('a toast that opens later is the newest and drawn at the bottom, wherever it is in the markup', async () => {
    await Stack.run({ args: { untrackOpen: false } });
    const close = getToast('Closed skyline-labs/portal#1187');
    await expectKeyHints(close, true);

    await userEvent.click(page.getByRole('button', { name: 'Stop tracking' }));

    const untrack = getToast('Stopped tracking fitloop/api');
    await expectKeyHints(untrack, true);
    await expectKeyHints(close, false);
    expect(untrack.element().getBoundingClientRect().top).toBeGreaterThan(close.element().getBoundingClientRect().top);
});

test('brief goes after 6 s and long after 10 s, counting down in a ring; pinned stays, with none', async () => {
    await Lifetimes.run({ args: { shown: false } });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    onTestFinished(() => {
        vi.useRealTimers();
    });
    await userEvent.click(page.getByRole('button', { name: 'Show' }));
    await nextTick();
    const brief = getToast('fitloop/api#477 merged into main');
    const long = getToast('Closed skyline-labs/portal#1187');
    const pinned = getToast('Syncing settings stopped');

    expect(brief.getByTestId('toast-countdown').query()).not.toBeNull();
    expect(long.getByTestId('toast-countdown').query()).not.toBeNull();
    expect(pinned.query()).not.toBeNull();
    expect(pinned.getByTestId('toast-countdown').query()).toBeNull();

    await vi.advanceTimersByTimeAsync(TOAST_LASTS.brief - 1);
    await nextTick();
    expect(brief.query()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await nextTick();
    expect(brief.query()).toBeNull();
    expect(long.query()).not.toBeNull();

    await vi.advanceTimersByTimeAsync(TOAST_LASTS.long - TOAST_LASTS.brief);
    await nextTick();
    expect(long.query()).toBeNull();
    expect(pinned.query()).not.toBeNull();
});

function getToast(title: string) {
    return page.getByRole('listitem').filter({ hasText: title });
}

/** Whether its buttons show their keys and name them to assistive technology. */
async function expectKeyHints(toast: Locator, shown: boolean) {
    const dismiss = toast.getByRole('button', { name: 'Dismiss', exact: true }).first();
    if (shown) {
        await expect.element(dismiss).toHaveAttribute('aria-keyshortcuts', 'Escape');
        await expect.poll(() => toast.element().querySelectorAll('kbd').length).toBe(2);
    } else {
        await expect.element(dismiss).not.toHaveAttribute('aria-keyshortcuts');
        await expect.poll(() => toast.element().querySelectorAll('kbd').length).toBe(0);
    }
}
