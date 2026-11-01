import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './Sidebar.stories.js';

const { Collapsed, Expanded, OnRepositoryIssues, TrackedMenu, WindowControlsCollapsed, WindowControlsOverflowing } =
    composeStories(stories);

test("a tracked repository's row is current on any of its lists, not only on its own address", async () => {
    await OnRepositoryIssues.run();

    await expect.element(page.getByRole('link', { name: /^kedrzu\/githq/ })).toHaveAttribute('aria-current', 'page');
    await expect.element(page.getByRole('link', { name: /^kedrzu\/skills/ })).not.toHaveAttribute('aria-current');
});

test('a private repository has a lock instead of the repository icon', async () => {
    await Expanded.run();

    const portal = page.getByRole('link', { name: /^skyline-labs\/portal/ }).element();
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

test.each([
    ['expanded', Expanded],
    ['on the rail', Collapsed],
])('%s without window controls over it, nothing of the sidebar moves the window', async (_, story) => {
    await story.run();

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' }).element();
    expect(sidebar.querySelector('[data-tauri-drag-region]')).toBeNull();
    expect(getComputedStyle(sidebar).paddingTop).toBe('12px');
});

test('the strip for the window controls holds its height and its place, and items go under it, as the sidebar scrolls', async () => {
    await WindowControlsOverflowing.run();

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' }).element();
    const strip = sidebar.querySelector('[data-tauri-drag-region]');
    if (!strip) {
        throw new Error('No strip for the window controls');
    }

    expect(sidebar.scrollHeight).toBeGreaterThan(sidebar.clientHeight);
    expect(strip.getBoundingClientRect().height).toBe(36);
    // As wide as the sidebar, to its edges: all of the top moves the window.
    expect(strip.getBoundingClientRect().width).toBe(sidebar.clientWidth);

    const { top } = sidebar.getBoundingClientRect();
    expect(strip.getBoundingClientRect().top).toBe(top);

    sidebar.scrollTop = 400;
    expect(strip.getBoundingClientRect().top).toBe(top);
    expect(strip.getBoundingClientRect().height).toBe(36);
    // What is under the window controls is the strip, not an item scrolled there.
    const { left } = sidebar.getBoundingClientRect();
    expect(document.elementFromPoint(left + 20, top + 18)).toBe(strip);
});

test('on the rail the strip reaches across it, for all of the top to move the window', async () => {
    await WindowControlsCollapsed.run();

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' }).element();
    const strip = sidebar.querySelector('[data-tauri-drag-region]');
    expect(strip?.getBoundingClientRect().width).toBe(sidebar.clientWidth);
    expect(strip?.getBoundingClientRect().height).toBe(36);
});
