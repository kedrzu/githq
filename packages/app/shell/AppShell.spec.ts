import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './AppShell.stories.js';

const { Desktop, Phone, PhoneItemPage } = composeStories(stories);

test('on a phone the screen has the window: no sidebar nor status bar, and items open on their page', async () => {
    await Phone.run();

    await expect.element(page.getByRole('button', { name: 'Open places' })).toBeVisible();
    await expect.element(page.getByRole('navigation', { name: 'Sidebar' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('contentinfo', { name: 'Status' })).not.toBeInTheDocument();
    expect(Phone.args['onUpdate:panelFits']).toHaveBeenLastCalledWith(false);
});

test("above the width the shell is the computer's: the sidebar, the status bar, no top bar nor command line", async () => {
    await Desktop.run();

    await expect.element(page.getByRole('navigation', { name: 'Sidebar' })).toBeVisible();
    await expect.element(page.getByRole('contentinfo', { name: 'Status' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Open places' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: /Do or find/u })).not.toBeInTheDocument();
});

test('the places button opens the panel; its own button closes it, and focus goes back to the places button', async () => {
    await Phone.run();
    const places = page.getByRole('button', { name: 'Open places' });

    await userEvent.click(places);
    const panel = page.getByRole('dialog', { name: 'Places' });
    await expect.element(panel.getByRole('navigation', { name: 'Sidebar' })).toBeVisible();

    await userEvent.click(panel.getByRole('button', { name: 'Close places' }));
    await expect.element(panel).not.toBeInTheDocument();
    await expect.element(places).toHaveFocus();
});

test('the screen scrolls on under the command line until its last row is above it', async () => {
    await Phone.run();
    const scroll = page.getByRole('group', { name: 'Issues' }).element();
    const line = page.getByRole('button', { name: /Do or find/u }).element();

    scroll.scrollTop = scroll.scrollHeight;

    const lastRow = page.getByText('Issue 30', { exact: true }).element();
    expect(lastRow.getBoundingClientRect().bottom).toBeLessThanOrEqual(line.getBoundingClientRect().top);
});

test('a screen drawing its own top bar gets none from the shell', async () => {
    await PhoneItemPage.run();

    await expect.element(page.getByRole('button', { name: 'Back to Issues' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Open places' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Leave a comment…' })).toBeVisible();
});
