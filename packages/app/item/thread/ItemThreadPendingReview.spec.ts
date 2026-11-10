import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ItemThreadPendingReview.stories.js';

const { Pending } = composeStories(stories);

test('Submit review… opens code review’s dialog, which submits the draft through its writing', async () => {
    await Pending.run();

    await userEvent.click(page.getByRole('button', { name: /^Submit review…/u }));
    const dialog = page.getByRole('dialog');
    await expect.element(dialog).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: 'Submit review' }));

    expect(Pending.args.writing?.submit).toHaveBeenCalledWith({ event: 'COMMENT', body: '' });
});

test('⇧S opens the submit dialog; Discard review… asks before it discards', async () => {
    await Pending.run();

    await userEvent.keyboard('{Shift>}S{/Shift}');
    await expect.element(page.getByRole('dialog')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(page.getByRole('dialog').query()).toBeNull();

    await userEvent.click(page.getByRole('button', { name: 'Discard review…' }));
    expect(Pending.args.writing?.discard).not.toHaveBeenCalled();
    await userEvent.click(page.getByRole('dialog').getByRole('button', { name: /^Discard 1 comment/u }));
    expect(Pending.args.writing?.discard).toHaveBeenCalledOnce();
});
