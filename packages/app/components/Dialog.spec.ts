import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './Dialog.stories.jsx';

const { NewIssue, TitleHidden } = composeStories(stories);

test('opens named and described with focus inside, keeps Tab inside, and Escape gives focus back', async () => {
    await NewIssue.run();

    const trigger = page.getByRole('button', { name: 'New issue' });
    const triggerElement = trigger.element();
    await userEvent.click(trigger);

    const dialog = page.getByRole('dialog', { name: 'New issue' });
    await expect.element(dialog).toHaveAccessibleDescription('In sigma-clinic/portal');
    await expect.element(dialog.getByRole('textbox', { name: 'Title' })).toHaveFocus();

    // Title → Create another → Create issue → Close, then round to the title again.
    await userEvent.keyboard('{Tab}{Tab}{Tab}{Tab}');
    await expect.element(dialog.getByRole('textbox', { name: 'Title' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(triggerElement).toHaveFocus();
});

test('the close button closes it', async () => {
    await TitleHidden.run();

    await userEvent.click(page.getByRole('button', { name: 'Capture' }));
    const dialog = page.getByRole('dialog', { name: 'Quick capture' });
    await expect.element(dialog).toBeVisible();

    await userEvent.click(dialog.getByRole('button', { name: 'Close' }));
    await expect.element(dialog).not.toBeInTheDocument();
});
