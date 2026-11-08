import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './DesktopHandOffView.stories.js';

const { HandedOff } = composeStories(stories);

test('the first action has the focus, and both actions are reached and run from the keyboard', async () => {
    const onOpenHere = vi.fn();
    const onTurnOff = vi.fn();
    await HandedOff.run({ args: { ...HandedOff.args, onOpenHere, onTurnOff } });

    await expect.element(page.getByRole('heading', { name: 'Opened in the githq desktop app' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Open here instead' })).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(onOpenHere).toHaveBeenCalledOnce();

    await userEvent.tab();
    await expect.element(page.getByRole('button', { name: "Don't open links in the app" })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onTurnOff).toHaveBeenCalledOnce();
});
