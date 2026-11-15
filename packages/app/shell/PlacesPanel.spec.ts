import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './PlacesPanel.stories.js';

const { InMyWork, InRepository } = composeStories(stories);

const panel = () => page.getByRole('dialog', { name: 'Places' });
const route = () => document.querySelector('[data-route]')?.getAttribute('data-route');

test('choosing a place goes there and closes the panel', async () => {
    await InMyWork.run();

    await userEvent.click(panel().getByRole('link', { name: /^skyline-labs\/portal/u }));

    await expect.element(panel()).not.toBeInTheDocument();
    expect(route()).toBe('/skyline-labs/portal');
});

test('choosing where the user already is closes it too', async () => {
    await InMyWork.run();

    await userEvent.click(panel().getByRole('link', { name: /^My work/u }));

    await expect.element(panel()).not.toBeInTheDocument();
    expect(route()).toBe('/');
});

test('it opens on where the user is, focused; Escape closes it where the user was, with no address of its own', async () => {
    await InRepository.run();

    await expect.element(panel().getByRole('link', { name: /^skyline-labs\/portal/u })).toHaveFocus();
    expect(route()).toBe('/skyline-labs/portal');

    await userEvent.keyboard('{Escape}');

    await expect.element(panel()).not.toBeInTheDocument();
    expect(route()).toBe('/skyline-labs/portal');
});

test('the account at its foot opens the account menu', async () => {
    await InMyWork.run();

    await userEvent.click(panel().getByRole('button', { name: /kedrzu/u }));

    await expect.element(page.getByRole('menuitem', { name: /Settings/u })).toBeVisible();
    await expect.element(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
});
