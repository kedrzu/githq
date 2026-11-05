import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { getSettingsPath, readSettingsSection } from './settingsRoutes.js';
import * as stories from './SettingsView.stories.js';

const { Repositories, Display, SyncStopped } = composeStories(stories);

test('the column: its title and six sections, each on its key, with tracked repositories and projects counted apart', async () => {
    await Repositories.run();

    await expect.element(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
    const sections = page.getByRole('group', { name: 'Settings sections' });
    await expect
        .element(sections.getByRole('button', { name: 'Repositories 15' }))
        .toHaveAttribute('aria-pressed', 'true');
    await expect
        .element(sections.getByRole('button', { name: 'Projects 2' }))
        .toHaveAttribute('aria-keyshortcuts', '2');
    await expect.element(sections.getByRole('button', { name: 'Display' })).toHaveAttribute('aria-keyshortcuts', '3');
    await expect
        .element(sections.getByRole('button', { name: 'Code review' }))
        .toHaveAttribute('aria-keyshortcuts', '4');
    await expect
        .element(sections.getByRole('button', { name: 'Sync settings' }))
        .toHaveAttribute('aria-keyshortcuts', '5');
    await expect.element(sections.getByRole('button', { name: 'Account' })).toHaveAttribute('aria-keyshortcuts', '6');
    expect(sections.getByRole('button').elements()).toHaveLength(6);
});

test("the page's header holds the section's name, and only that", async () => {
    await Display.run();

    const header = page.getByRole('banner');
    await expect.element(header.getByRole('heading', { name: 'Display', level: 2 })).toBeVisible();
    await expect.element(header).toHaveTextContent(/^Display$/u);
});

test('on the web Updates is not a section: its `?tab=` falls back as an unknown one does, and `7` does nothing', async () => {
    expect(readSettingsSection('updates')).toBe('repositories');
    expect(getSettingsPath(readSettingsSection('updates'))).toBe('/settings');

    const onUpdateSection = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, 'onUpdate:section': onUpdateSection } });

    await userEvent.keyboard('7');
    expect(onUpdateSection).not.toHaveBeenCalled();
});

test('syncing stopped, Sync settings carries a dot that says so', async () => {
    await SyncStopped.run();

    await expect.element(page.getByRole('button', { name: 'Sync settings Syncing stopped' })).toBeVisible();
    await Repositories.run();
    await expect.element(page.getByRole('button', { name: 'Sync settings', exact: true })).toBeVisible();
});
