import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './FirstDownloadView.stories.js';

const { WorkArriving, WorkReady } = composeStories(stories);

test('"Open My work" waits for the user\'s own work only; then it opens with Enter, the rest still arriving', async () => {
    const onOpen = vi.fn();
    await WorkArriving.run({ args: { ...WorkArriving.args, onOpen } });
    const open = page.getByRole('button', { name: 'Open My work' });
    await expect.element(open).toBeDisabled();
    await userEvent.keyboard('{Enter}');
    expect(onOpen).not.toHaveBeenCalled();

    await WorkReady.run({ args: { ...WorkReady.args, onOpen } });
    await expect.element(open).toBeEnabled();
    await expect
        .element(page.getByRole('progressbar', { name: 'skyline-labs/portal' }))
        .toHaveAttribute('aria-valuenow', '62');
    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledOnce();
});
