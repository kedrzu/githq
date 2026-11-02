import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './RepositorySettingsView.stories.js';

const { Synced, Public, VisibilityNotKnown, Downloading, Refused, Hidden } = composeStories(stories);

test('the head names the repository, its visibility and that it is tracked, with Esc to go back', async () => {
    await Synced.run();

    await expect.element(page.getByRole('heading', { name: 'fitloop/webapp', level: 2 })).toBeVisible();
    await expect.element(page.getByText(/^private\s·\stracked$/u)).toBeVisible();
    await expect
        .element(page.getByRole('button', { name: 'Repositories' }))
        .toHaveAttribute('aria-keyshortcuts', 'Escape');
    await expect.element(page.getByText(/^Esc\s?Back$/u)).toBeVisible();

    await Public.run();
    await expect.element(page.getByText(/^public\s·\stracked$/u)).toBeVisible();

    // Nothing tells yet: neither.
    await VisibilityNotKnown.run();
    await expect.element(page.getByText(/^tracked$/u)).toBeVisible();
    await expect.element(page.getByText(/private|public/u)).not.toBeInTheDocument();
});

test('the arrow with "Repositories", and Esc, go back — Esc not while a field or a layer has it', async () => {
    const onBack = vi.fn();
    await Synced.run({ args: { ...Synced.args, onBack } });

    await userEvent.click(page.getByRole('button', { name: 'Repositories' }));
    expect(onBack).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    expect(onBack).toHaveBeenCalledTimes(2);

    // A field has the key.
    const field = document.createElement('input');
    document.body.append(field);
    field.focus();
    await userEvent.keyboard('{Escape}');
    expect(onBack).toHaveBeenCalledTimes(2);
    field.remove();

    // A layer is open (the command menu, a picker): Escape is its own.
    const layer = document.createElement('div');
    layer.dataset.layer = '';
    document.body.append(layer);
    await userEvent.keyboard('{Escape}');
    expect(onBack).toHaveBeenCalledTimes(2);
    layer.remove();
});

test('Tracking says it is tracked, how it stands and its open items in this browser; Untrack untracks', async () => {
    const onUntrack = vi.fn();
    await Synced.run({ args: { ...Synced.args, onUntrack } });

    await expect.element(page.getByRole('heading', { name: 'Tracking', level: 2 })).toBeVisible();
    await expect
        .element(
            page.getByText(
                /^Whether\sgithq\skeeps\sa\scopy\sof\sthis\srepository's\sissues,\spull\srequests\sand\sworkflows\.$/u,
            ),
        )
        .toBeVisible();
    await expect.element(page.getByText('Tracked', { exact: true })).toBeVisible();
    await expect.element(page.getByText(/synced\s14s\sago\s·\s142\sopen\sitems\sin\sthis\sbrowser/u)).toBeVisible();
    await expect
        .element(
            page.getByText(
                /^The\ssame\sas\sUntrack\son\sits\srow\sin\sRepositories,\sthen\sback\sto\sRepositories\.$/u,
            ),
        )
        .toBeVisible();

    await userEvent.click(page.getByRole('button', { name: 'Untrack' }));
    expect(onUntrack).toHaveBeenCalledOnce();
});

test('how it stands, as a row in Repositories says it', async () => {
    await Downloading.run();
    await expect.element(page.getByText(/downloading\s40\sof\s312\s·\s40\sopen\sitems/u)).toBeVisible();

    await VisibilityNotKnown.run();
    await expect.element(page.getByText(/waiting\s·\sno\sopen\sitems/u)).toBeVisible();

    await Refused.run();
    await expect.element(page.getByText(/GitHub\srefuses\sits\schanges/u)).toBeVisible();

    await Hidden.run();
    await expect.element(page.getByText(/Not\sshown\sto\sgithq/u)).toBeVisible();
});
