import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './SettingsView.stories.js';

const { WhatToTrack, SyncStopped } = composeStories(stories);

test('the title and the three tabs, with what is tracked counted as one number', async () => {
    await WhatToTrack.run();

    await expect.element(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
    const tabs = page.getByRole('group', { name: 'Settings sections' });
    await expect
        .element(tabs.getByRole('button', { name: 'What to track 17' }))
        .toHaveAttribute('aria-pressed', 'true');
    await expect.element(tabs.getByRole('button', { name: 'Sync settings' })).toHaveAttribute('aria-keyshortcuts', '2');
    await expect.element(tabs.getByRole('button', { name: 'Account' })).toHaveAttribute('aria-keyshortcuts', '3');
    expect(tabs.getByRole('button').elements()).toHaveLength(3);
});

test('`1` to `3` and the tabs choose the section', async () => {
    const onUpdateSection = vi.fn();
    await WhatToTrack.run({ args: { ...WhatToTrack.args, 'onUpdate:section': onUpdateSection } });

    for (const [key, section] of [
        ['2', 'sync'],
        ['3', 'account'],
        ['1', 'tracking'],
    ] as const) {
        await userEvent.keyboard(key);
        expect(onUpdateSection).toHaveBeenLastCalledWith(section);
    }

    await userEvent.click(page.getByRole('button', { name: 'Account' }));
    expect(onUpdateSection).toHaveBeenLastCalledWith('account');
});

test('syncing stopped, Sync settings carries a dot that says so', async () => {
    await SyncStopped.run();

    await expect.element(page.getByRole('button', { name: 'Sync settings Syncing stopped' })).toBeVisible();
    await WhatToTrack.run();
    await expect.element(page.getByRole('button', { name: 'Sync settings', exact: true })).toBeVisible();
});
