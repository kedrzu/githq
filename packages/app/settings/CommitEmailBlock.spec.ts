import { composeStories } from '@storybook/vue3';
import { beforeEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './CommitEmailBlock.stories.js';

const { OwnerAddress, RepositoryAddress, OwnerNotOffered, RepositoryNotOffered, NotKnown } = composeStories(stories);

const block = () => page.getByRole('region', { name: 'Commit email' });
const ownerSelect = () => page.getByRole('button', { name: /^For\sall\sof\sacme-corp/u });
const repositorySelect = () => page.getByRole('button', { name: /^For\sthis\srepository/u });
const option = (name: RegExp) => page.getByRole('menuitemradio', { name });

beforeEach(async () => {
    await page.viewport(1280, 900);
});

test('T24: both selects named by their rows and showing the choice; the repository says what it commits as', async () => {
    await OwnerAddress.run();

    await expect.element(ownerSelect()).toHaveAccessibleName(/^For\sall\sof\sacme-corp\smichal@acme-corp\.com$/u);
    await expect.element(repositorySelect()).toHaveAccessibleName(/^For\sthis\srepository\sSame\sas\sacme-corp$/u);
    await expect.element(block()).toHaveTextContent(/unless\sa\srepository\ssets\sits\sown/u);
    await expect.element(block()).toHaveTextContent(/commits\sas\smichal@acme-corp\.com(?!,)/u);
    await expect.element(block()).not.toHaveTextContent(/not offered here/u);
});

test("a pick asks for the owner's default or the repository's, by the keys too; the choice already made asks nothing", async () => {
    const onOwner = vi.fn();
    const onRepository = vi.fn();
    await RepositoryAddress.run({ args: { ...RepositoryAddress.args, onOwner, onRepository } });

    await userEvent.click(ownerSelect());
    await userEvent.click(option(/^GitHub default\s*michal@kedrzu\.dev$/u));
    expect(onOwner).toHaveBeenLastCalledWith(null);

    await userEvent.click(repositorySelect());
    await userEvent.click(option(/^Same\sas\sacme-corp$/u));
    expect(onRepository).toHaveBeenLastCalledWith(undefined);

    // The keys: focus the select, Enter opens on the first choice, ↓ moves, Enter picks.
    repositorySelect().element().focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(option(/^Same\sas\sacme-corp$/u)).toBeVisible();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onRepository).toHaveBeenLastCalledWith(null);

    // The address already chosen: nothing.
    await userEvent.click(repositorySelect());
    await userEvent.click(option(/^1234\+mlaine@users\.noreply\.github\.com$/u));
    expect(onRepository).toHaveBeenCalledTimes(2);
    expect(onOwner).toHaveBeenCalledOnce();
});

test('T25: an owner address not offered here stays chosen, marked, and is left as it is; the repository falls to GitHub default', async () => {
    const onOwner = vi.fn();
    const onRepository = vi.fn();
    await OwnerNotOffered.run({ args: { ...OwnerNotOffered.args, onOwner, onRepository } });

    await expect.element(ownerSelect()).toHaveAccessibleName(/^For\sall\sof\sacme-corp\smichal@acme-corp\.com$/u);
    await expect.element(page.getByText('not offered here', { exact: true })).toBeVisible();
    await expect.element(block()).not.toHaveTextContent(/unless\sa\srepository\ssets\sits\sown/u);
    await expect.element(block()).toHaveTextContent(/commits\sas\smichal@kedrzu\.dev,\sGitHub's\sdefault/u);

    // Opened and closed: still chosen, nothing asked.
    await userEvent.click(ownerSelect());
    await expect
        .element(option(/^michal@acme-corp\.com\s*not\soffered\shere$/u))
        .toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{Escape}');
    expect(onOwner).not.toHaveBeenCalled();
    expect(onRepository).not.toHaveBeenCalled();
});

test("a repository address not offered here is marked too, and its owner's applies", async () => {
    await RepositoryNotOffered.run();

    await expect.element(repositorySelect()).toHaveAccessibleName(/^For\sthis\srepository\sold@acme-corp\.com$/u);
    await expect.element(page.getByText('not offered here', { exact: true })).toBeVisible();
    await expect.element(block()).toHaveTextContent(/commits\sas\smichal@acme-corp\.com/u);
});

test("before GitHub's addresses are known: the stored choices, disabled, and no address it commits as", async () => {
    await NotKnown.run();

    await expect.element(ownerSelect()).toHaveAccessibleName(/^For\sall\sof\sacme-corp\smichal@acme-corp\.com$/u);
    await expect.element(ownerSelect()).toBeDisabled();
    await expect.element(repositorySelect()).toBeDisabled();
    await expect.element(block()).not.toHaveTextContent(/commits\sas/u);
    await expect.element(block()).not.toHaveTextContent(/not offered here/u);
});
