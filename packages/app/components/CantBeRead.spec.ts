import { composeStories } from '@storybook/vue3';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { formatTime } from '@/utils/formatTime.js';

import * as stories from './CantBeRead.stories.js';

const { Failing, FailingGroup, Hidden, Offline, Paused, Refused, RefusedGroup } = composeStories(stories);

test('offline and paused say when it resolves and offer nothing to press (D12)', async () => {
    await Offline.run();
    await expect.element(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
    await expect.element(page.getByRole('button')).not.toBeInTheDocument();

    await Paused.run();
    const time = formatTime(new Date(2026, 10, 6, 14, 20).getTime());
    await expect.element(page.getByRole('heading', { name: `Refresh paused until ${time}` })).toBeVisible();
    await expect
        .element(
            page.getByText(`before fitloop/webapp's issues could be read. It comes in by itself at ${time}.`, {
                exact: false,
            }),
        )
        .toBeVisible();
    await expect.element(page.getByRole('button')).not.toBeInTheDocument();
});

test('R and the button try again, once at a time (D18)', async () => {
    let settle = () => {};
    const retry = vi.fn(
        () =>
            new Promise<void>(resolve => {
                settle = resolve;
            }),
    );
    await Failing.run({ args: { ...Failing.args, cause: { kind: 'failing', retry } } });

    const button = page.getByRole('button', { name: 'Try again' });
    await expect.element(button).toHaveAttribute('aria-keyshortcuts', 'R');
    await userEvent.keyboard('r');
    await expect.element(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.keyboard('r');
    expect(retry).toHaveBeenCalledOnce();

    settle();
    await expect.element(button).not.toHaveAttribute('aria-busy');
    await userEvent.click(button);
    expect(retry).toHaveBeenCalledTimes(2);
});

test('in a group the button has no key: a list may have several', async () => {
    const retry = vi.fn(() => Promise.resolve());
    await FailingGroup.run({ args: { ...FailingGroup.args, cause: { kind: 'failing', retry } } });

    const button = page.getByRole('button', { name: 'Try again' });
    await expect.element(button).not.toHaveAttribute('aria-keyshortcuts');
    await userEvent.keyboard('r');
    expect(retry).not.toHaveBeenCalled();
    await userEvent.click(button);
    expect(retry).toHaveBeenCalledOnce();
});

test('hidden or gone links to GitHub, and O opens it (D18)', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    onTestFinished(() => open.mockRestore());
    await Hidden.run();

    await expect.element(page.getByRole('heading', { name: "GitHub doesn't show fitloop/webapp" })).toBeVisible();
    const link = page.getByRole('link', { name: 'Open on GitHub' });
    await expect.element(link).toHaveAttribute('href', 'https://github.com/fitloop/webapp');
    await expect.element(link).toHaveAttribute('aria-keyshortcuts', 'O');
    await userEvent.keyboard('o');
    expect(open).toHaveBeenCalledWith('https://github.com/fitloop/webapp', '_blank', 'noopener,noreferrer');
});

test("GitHub refusing a tracked copy's changes says so, not that it hides it, and links to GitHub (D18)", async () => {
    await Refused.run();

    await expect
        .element(page.getByRole('heading', { name: "GitHub refuses to list fitloop/webapp's closed issues" }))
        .toBeVisible();
    await expect.element(page.getByText('It asks again hourly.', { exact: false })).toBeVisible();
    await expect.element(page.getByText("GitHub doesn't show", { exact: false })).not.toBeInTheDocument();
    await expect.element(page.getByRole('link', { name: 'Open on GitHub' })).toHaveAttribute('aria-keyshortcuts', 'O');

    await RefusedGroup.run();
    await expect.element(page.getByText('GitHub refuses to list this.', { exact: true })).toBeVisible();
});
