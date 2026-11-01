import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './Sidebar.stories.js';

const { Expanded, OnRepositoryIssues, TrackedMenu } = composeStories(stories);

test("a tracked repository's row is current on any of its lists, not only on its own address", async () => {
    await OnRepositoryIssues.run();

    await expect.element(page.getByRole('link', { name: /^kedrzu\/githq/ })).toHaveAttribute('aria-current', 'page');
    await expect.element(page.getByRole('link', { name: /^kedrzu\/skills/ })).not.toHaveAttribute('aria-current');
});

test('a private repository has a lock instead of the repository icon', async () => {
    await Expanded.run();

    const portal = page.getByRole('link', { name: /^sigma-clinic\/portal/ }).element();
    const githq = page.getByRole('link', { name: /^kedrzu\/githq/ }).element();
    expect(portal.querySelector('.lucide-lock')).not.toBeNull();
    expect(githq.querySelector('.lucide-lock')).toBeNull();
    expect(githq.querySelector('.lucide-book-marked')).not.toBeNull();
});

test('right-clicking a tracked repository opens its menu, under its name', async () => {
    await TrackedMenu.run();

    await userEvent.click(page.getByRole('link', { name: /^kedrzu\/skills/ }), { button: 'right' });
    await expect.element(page.getByRole('menu')).toHaveTextContent('kedrzu/skills');
    await expect.element(page.getByRole('menuitem', { name: 'Open on GitHub' })).toBeVisible();
});

test('right-clicking a tracked project opens its menu', async () => {
    await TrackedMenu.run();

    await userEvent.click(page.getByRole('link', { name: /^githq Roadmap/ }), { button: 'right' });
    await expect.element(page.getByRole('menu')).toHaveTextContent('PVT_2');
    await expect.element(page.getByRole('menuitem', { name: 'Open on GitHub' })).toBeVisible();
});
