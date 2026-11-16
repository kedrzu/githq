import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './PlacesPanel.stories.js';

const { InMyWork, InRepository } = composeStories(stories);

const panel = () => page.getByRole('dialog', { name: 'Places' });
const route = () => document.querySelector('[data-route]')?.getAttribute('data-route');

test('tapping a repository shows its sections in place, the panel staying open; tapping one goes there and closes it', async () => {
    await InMyWork.run();

    await userEvent.click(panel().getByRole('button', { name: /^kedrzu\/githq/u }));

    await expect.element(panel().getByRole('link', { name: /^Pull requests/u })).toBeVisible();
    expect(route()).toBe('/');

    await userEvent.click(panel().getByRole('link', { name: /^Pull requests/u }));

    await expect.element(panel()).not.toBeInTheDocument();
    expect(route()).toBe('/kedrzu/githq/pulls');
});

test("choosing one of my work's groups goes there and closes the panel", async () => {
    await InMyWork.run();

    await userEvent.click(panel().getByRole('link', { name: /^Mentioned/u }));

    await expect.element(panel()).not.toBeInTheDocument();
    expect(route()).toBe('/issues/mentioned');
});

test('choosing where the user already is closes it too', async () => {
    await InMyWork.run();

    await userEvent.click(panel().getByRole('link', { name: /^My work/u }));

    await expect.element(panel()).not.toBeInTheDocument();
    expect(route()).toBe('/');
});

test('it opens on where the user is, focused; Escape closes it where the user was, with no address of its own', async () => {
    await InRepository.run();

    await expect.element(panel().getByRole('link', { name: /^Pull requests/u })).toHaveFocus();
    expect(route()).toBe('/skyline-labs/portal/pulls');

    await userEvent.keyboard('{Escape}');

    await expect.element(panel()).not.toBeInTheDocument();
    expect(route()).toBe('/skyline-labs/portal/pulls');
});

test('the account at its foot opens the account menu', async () => {
    await InMyWork.run();

    await userEvent.click(panel().getByRole('button', { name: /^Account:/u }));

    await expect.element(page.getByRole('menuitem', { name: /Settings/u })).toBeVisible();
    await expect.element(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
});
