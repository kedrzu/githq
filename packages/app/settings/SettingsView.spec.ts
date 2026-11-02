import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './SettingsView.stories.js';

const { Repositories, SyncStopped } = composeStories(stories);

test('the title and the four tabs, with tracked repositories and tracked projects counted apart', async () => {
    await Repositories.run();

    await expect.element(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
    const tabs = page.getByRole('group', { name: 'Settings sections' });
    await expect.element(tabs.getByRole('button', { name: 'Repositories 15' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tabs.getByRole('button', { name: 'Projects 2' })).toHaveAttribute('aria-keyshortcuts', '2');
    await expect.element(tabs.getByRole('button', { name: 'Sync settings' })).toHaveAttribute('aria-keyshortcuts', '3');
    await expect.element(tabs.getByRole('button', { name: 'Account' })).toHaveAttribute('aria-keyshortcuts', '4');
    expect(tabs.getByRole('button').elements()).toHaveLength(4);
});

test('`1` to `4` and the tabs choose the section', async () => {
    const onUpdateSection = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, 'onUpdate:section': onUpdateSection } });

    for (const [key, section] of [
        ['2', 'projects'],
        ['3', 'sync'],
        ['4', 'account'],
        ['1', 'repositories'],
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
    await Repositories.run();
    await expect.element(page.getByRole('button', { name: 'Sync settings', exact: true })).toBeVisible();
});
