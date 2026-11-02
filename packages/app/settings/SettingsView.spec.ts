import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './SettingsView.stories.js';

const { Repositories } = composeStories(stories);

test('the title and the four tabs, with what is tracked counted', async () => {
    await Repositories.run();

    await expect.element(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
    const tabs = page.getByRole('group', { name: 'Settings sections' });
    await expect.element(tabs.getByRole('button', { name: 'Repositories 15' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(tabs.getByRole('button', { name: 'Projects 3' })).toHaveAttribute('aria-keyshortcuts', '2');
    await expect.element(tabs.getByRole('button', { name: 'Saving to GitHub' })).toBeInTheDocument();
    await expect.element(tabs.getByRole('button', { name: 'Account' })).toBeInTheDocument();
});

test('`1` to `4` and the tabs choose the section', async () => {
    const onUpdateSection = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, 'onUpdate:section': onUpdateSection } });

    for (const [key, section] of [
        ['2', 'projects'],
        ['3', 'saving'],
        ['4', 'account'],
        ['1', 'repositories'],
    ] as const) {
        await userEvent.keyboard(key);
        expect(onUpdateSection).toHaveBeenLastCalledWith(section);
    }

    await userEvent.click(page.getByRole('button', { name: 'Account' }));
    expect(onUpdateSection).toHaveBeenLastCalledWith('account');
});
