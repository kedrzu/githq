import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './UpdateSegment.stories.js';

const { Ready } = composeStories(stories);

test('U1: the notice waits for the user — Restart restarts, Later dismisses, and nothing happens on its own', async () => {
    await Ready.run();

    await expect.element(page.getByText('githq 1.4.0 is ready')).toBeVisible();
    expect(Ready.args.onRestart).not.toHaveBeenCalled();
    expect(Ready.args.onLater).not.toHaveBeenCalled();

    await userEvent.click(page.getByRole('button', { name: 'Later' }));
    expect(Ready.args.onLater).toHaveBeenCalledOnce();
    expect(Ready.args.onRestart).not.toHaveBeenCalled();

    await userEvent.click(page.getByRole('button', { name: 'Restart' }));
    expect(Ready.args.onRestart).toHaveBeenCalledOnce();
});
