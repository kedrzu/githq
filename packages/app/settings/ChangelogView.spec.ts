import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ChangelogView.stories.js';

const {
    Stable,
    Development,
    DevelopmentBeforeFirstStable,
    NothingYoudNotice,
    NoVersions,
    Loading,
    Offline,
    Failed,
    FailedOnDevelopment,
} = composeStories(stories);

const RELEASES_URL = 'https://github.com/kedrzu/githq/releases';
const COMMITS_URL = 'https://github.com/kedrzu/githq/commits/632d28b';

const fold = (name: RegExp) => page.getByRole('button', { name, exact: false });
const LATEST = /^githq 0\.2\.0/;
const SECOND = /^githq 0\.1\.2/;

test('U41: the first fold is open, the rest collapsed, and each opens by itself', async () => {
    await Stable.run();

    await expect.element(fold(LATEST)).toHaveAttribute('aria-expanded', 'true');
    await expect.element(fold(SECOND)).toHaveAttribute('aria-expanded', 'false');
    await expect.element(page.getByText('You can now merge pull requests')).toBeVisible();

    await userEvent.click(fold(SECOND));
    await expect.element(fold(SECOND)).toHaveAttribute('aria-expanded', 'true');
    await expect.element(fold(LATEST)).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(fold(LATEST));
    await expect.element(fold(LATEST)).toHaveAttribute('aria-expanded', 'false');
    await expect.element(fold(SECOND)).toHaveAttribute('aria-expanded', 'true');
});

test('U41: Running is on the installed version and New on what the user did not have, with its date', async () => {
    await Stable.run();

    await expect.element(fold(LATEST)).toHaveTextContent(/November 3, 2026\s*New\s*Running/);
    await expect.element(fold(SECOND)).toHaveTextContent(/New/);
    await expect.element(fold(SECOND)).not.toHaveTextContent(/Running/);
    await expect.element(fold(/^githq 0\.1\.0/)).not.toHaveTextContent(/New|Running/);
});

test('↑↓ move between the folds and Space opens and closes the one they are on, once', async () => {
    await Stable.run();

    await userEvent.keyboard('{ArrowDown}');
    await expect.element(fold(LATEST)).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(fold(SECOND)).toHaveFocus();

    await userEvent.keyboard(' ');
    await expect.element(fold(SECOND)).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard(' ');
    await expect.element(fold(SECOND)).toHaveAttribute('aria-expanded', 'false');

    await userEvent.keyboard('{ArrowUp}');
    await expect.element(fold(LATEST)).toHaveFocus();
    await expect.element(fold(LATEST)).toHaveAttribute('aria-expanded', 'true');
});

test('O and the button open the releases of a Stable version', async () => {
    await Stable.run();

    await userEvent.click(page.getByRole('button', { name: /^All releases on GitHub/ }));
    expect(Stable.args.onOpenOnGitHub).toHaveBeenLastCalledWith(RELEASES_URL);

    await userEvent.keyboard('o');
    expect(Stable.args.onOpenOnGitHub).toHaveBeenCalledTimes(2);
});

test('U43: a Development build has its one fold first, counted and grouped, whose numbers link to the pull requests', async () => {
    await Development.run();

    await expect.element(fold(/^Development/)).toHaveAttribute('aria-expanded', 'true');
    await expect.element(fold(/^Development/)).toHaveTextContent(/since 0\.2\.0\s*Running/);
    await expect.element(fold(/^githq 0\.2\.0/)).toHaveAttribute('aria-expanded', 'false');
    await expect.element(fold(/^githq 0\.2\.0/)).not.toHaveTextContent(/New|Running/);
    await expect.element(page.getByText("4 changes you'd notice, out of 7 commits.")).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Features' })).toBeVisible();
    await expect
        .element(page.getByRole('link', { name: '#135' }))
        .toHaveAttribute('href', 'https://github.com/kedrzu/githq/pull/135');

    await userEvent.click(page.getByRole('button', { name: /^All commits on GitHub/ }));
    expect(Development.args.onOpenOnGitHub).toHaveBeenCalledExactlyOnceWith(COMMITS_URL);
});

test('before the first Stable the fold names no end, and says the list is cut short', async () => {
    await DevelopmentBeforeFirstStable.run();

    await expect.element(fold(/^Development/)).not.toHaveTextContent('since');
    await expect.element(page.getByText("4 changes you'd notice, in the newest 300 commits.")).toBeVisible();
});

test('U44: nothing users notice says so, and the link still goes to the commits', async () => {
    await NothingYoudNotice.run();

    await expect.element(page.getByText("Nothing you'd notice")).toBeVisible();
    await expect.element(page.getByText('7 commits went in, and none of them changes what you see.')).toBeVisible();
    await expect.element(page.getByRole('button', { name: /^All commits on GitHub/ })).toBeVisible();
});

test('U45: no versions yet says what comes first', async () => {
    await NoVersions.run();

    await expect.element(page.getByText('No Stable version yet')).toBeVisible();
    await expect.element(page.getByText('The first one will be 0.1.0.', { exact: false })).toBeVisible();
});

test('U46: quiet lines hold the place, with no fold and the link working', async () => {
    await Loading.run();

    await expect.element(page.getByRole('button', { name: /^githq/ })).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: /^All releases on GitHub/ }));
    expect(Loading.args.onOpenOnGitHub).toHaveBeenCalledExactlyOnceWith(RELEASES_URL);
});

test('U47: offline waits, and offers no link, by the button or by its key', async () => {
    await Offline.run();

    await expect.element(page.getByText('Waiting for the connection')).toBeVisible();
    await expect.element(page.getByRole('button', { name: /on GitHub/ })).not.toBeInTheDocument();
    await userEvent.keyboard('o');
    expect(Offline.args.onOpenOnGitHub).not.toHaveBeenCalled();
});

test('U48: a failure says so and links to the releases, on a Development build too', async () => {
    await Failed.run();
    await expect.element(page.getByText("Couldn't load the changelog")).toBeVisible();
    await expect.element(page.getByRole('button', { name: /^All releases on GitHub/ })).toBeVisible();
});

test('U48 on a Development build links to the releases, what failed to load', async () => {
    await FailedOnDevelopment.run();

    await userEvent.click(page.getByRole('button', { name: /^All releases on GitHub/ }));
    expect(FailedOnDevelopment.args.onOpenOnGitHub).toHaveBeenCalledExactlyOnceWith(RELEASES_URL);
});
