import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ProjectSettingsView.stories.js';

const { Synced, Slower } = composeStories(stories);

test("a project's settings: its head, and Tracking in its own words", async () => {
    const onBack = vi.fn();
    const onUntrack = vi.fn();
    await Synced.run({ args: { ...Synced.args, onBack, onUntrack } });

    await expect.element(page.getByRole('heading', { name: 'Platform Q4', level: 2 })).toBeVisible();
    await expect.element(page.getByText(/^fitloop\s·\stracked$/u)).toBeVisible();
    await expect
        .element(page.getByText(/^Whether\sgithq\skeeps\sa\scopy\sof\sthis\sproject's\sitems,\sfields\sand\sviews\.$/u))
        .toBeVisible();
    await expect.element(page.getByText(/synced\s14s\sago\s·\s128\sopen\sitems\sin\sthis\sbrowser/u)).toBeVisible();
    await expect
        .element(page.getByText(/^The\ssame\sas\sUntrack\son\sits\srow\sin\sProjects,\sthen\sback\sto\sProjects\.$/u))
        .toBeVisible();

    await userEvent.click(page.getByRole('button', { name: 'Projects' }));
    await userEvent.keyboard('{Escape}');
    expect(onBack).toHaveBeenCalledTimes(2);

    await userEvent.click(page.getByRole('button', { name: 'Untrack' }));
    expect(onUntrack).toHaveBeenCalledOnce();

    await Slower.run();
    await expect.element(page.getByText(/checked\severy\s5\smin/u)).toBeVisible();
});
