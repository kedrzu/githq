import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import * as stories from './SettingsSectionsList.stories.js';

const { Sections, Off } = composeStories(stories);

test("MB146: each section's row says its state and goes to the section's own address, the first included", async () => {
    await Sections.run();

    const row = (name: RegExp) => page.getByRole('link', { name });
    await expect.element(row(/^Repositories\s?15$/u)).toHaveAttribute('href', '/settings?tab=repositories');
    await expect.element(row(/^Projects\s?3$/u)).toHaveAttribute('href', '/settings?tab=projects');
    await expect.element(row(/^Display\s?Animations\son$/u)).toHaveAttribute('href', '/settings?tab=display');
    await expect.element(row(/^Code\sreview\s?Send\sat\sonce$/u)).toHaveAttribute('href', '/settings?tab=review');
    await expect.element(row(/^Privacy\s?Statistics\son$/u)).toHaveAttribute('href', '/settings?tab=privacy');
    await expect.element(row(/^Sync\ssettings\s?On$/u)).toHaveAttribute('href', '/settings?tab=sync');
    await expect.element(row(/^Account\s?mlaine$/u)).toHaveAttribute('href', '/settings?tab=account');
});

test('the rows follow the settings: off, and comments into a draft review', async () => {
    await Off.run();

    await expect.element(page.getByRole('link', { name: /^Display\s?Animations\soff$/u })).toBeVisible();
    await expect.element(page.getByRole('link', { name: /^Code\sreview\s?Draft\sreview$/u })).toBeVisible();
    await expect.element(page.getByRole('link', { name: /^Sync\ssettings\s?Off$/u })).toBeVisible();
});
