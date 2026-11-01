import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './SavingStopped.stories.js';

const { Deleted, Foreign, Newer, Public, Refused, Unreadable } = composeStories(stories);

test.each([
    [Foreign, 'Open the repository', 'https://github.com/mlaine/githq-settings'],
    [Public, 'Open its settings', 'https://github.com/mlaine/githq-settings/settings'],
    [Unreadable, 'Open the file', 'https://github.com/mlaine/githq-settings/blob/HEAD/settings.json'],
])('where the fix is on GitHub, the second button goes to it', async (story, name, href) => {
    await story.run();

    await expect.element(page.getByRole('heading', { name: 'Syncing stopped' })).toBeVisible();
    await expect.element(page.getByRole('link', { name })).toHaveAttribute('href', href);
});

test('a deleted repository and a refusal have nothing to open; a refusal quotes GitHub', async () => {
    await Deleted.run();
    await expect
        .element(page.getByText('The repository mlaine/githq-settings no longer exists on GitHub.', { exact: false }))
        .toBeVisible();
    await expect.element(page.getByRole('link')).not.toBeInTheDocument();

    await Refused.run();
    await expect.element(page.getByText('It said: “Repository creation failed.”', { exact: false })).toBeVisible();
    await expect.element(page.getByRole('link')).not.toBeInTheDocument();
});

test('a newer githq offers Reload', async () => {
    const onReload = vi.fn();
    await Newer.run({ args: { ...Newer.args, onReload } });

    await userEvent.click(page.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalledOnce();
});

test('R and the button try again, once at a time', async () => {
    let settle = () => {};
    const retry = vi.fn(
        () =>
            new Promise<void>(resolve => {
                settle = resolve;
            }),
    );
    await Deleted.run({ args: { ...Deleted.args, retry } });

    const button = page.getByRole('button', { name: 'Try again' });
    await expect.element(button).toHaveAttribute('aria-keyshortcuts', 'R');
    await userEvent.keyboard('r');
    await expect.element(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.keyboard('r');
    expect(retry).toHaveBeenCalledOnce();

    settle();
    await expect.element(button).not.toHaveAttribute('aria-busy');
    await userEvent.click(button);
    expect(retry).toHaveBeenCalledTimes(2);
});
