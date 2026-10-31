import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './StatusBar.stories.js';

// The translations keep short words with the next one (a no-break space): `\s` matches either.
const SEGMENT = /^Paused until\s14:32 · 100 left$/;

const { Exhausted, Paused, PausedCollapsed } = composeStories(stories);

test('refresh paused (K3): the segment opens why — editing still works, other changes wait — and Escape closes it', async () => {
    await Paused.run();

    const segment = page.getByRole('button', { name: SEGMENT });
    await userEvent.click(segment);

    // Named by the segment that opened it, as a popover is.
    const explanation = page.getByRole('dialog', { name: SEGMENT });
    await expect.element(explanation).toBeVisible();
    await expect.element(explanation.getByRole('heading', { name: /^Background refresh is\spaused$/ })).toBeVisible();
    await expect.element(explanation.getByText(/your edits still go\sthrough/)).toBeVisible();
    await expect.element(explanation.getByText(/^100 of\s5,000 this hour$/)).toBeVisible();
    await expect.element(explanation.getByText(/^14:32 · in\s\d+ min$/)).toBeVisible();
    await expect.element(explanation.getByText(/^13:58 · /)).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect.element(explanation).not.toBeInTheDocument();
    await expect.element(segment).toHaveFocus();
});

test('under the rail the paused segment is its icon, named by the whole sentence, and opens the same', async () => {
    await PausedCollapsed.run();

    await userEvent.click(page.getByRole('button', { name: SEGMENT }));
    await expect.element(page.getByRole('dialog', { name: SEGMENT })).toBeVisible();
});

test('the allowance used up to the last point, by other apps too, says edits may be refused until the reset', async () => {
    await Exhausted.run();

    await userEvent.click(page.getByRole('button', { name: /^Paused until\s14:32 · 0 left$/ }));
    await expect.element(page.getByText(/GitHub may refuse edits until\s14:32/)).toBeVisible();
});
