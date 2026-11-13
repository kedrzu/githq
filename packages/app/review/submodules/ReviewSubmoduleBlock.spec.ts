import { composeStories } from '@storybook/vue3-vite';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ReviewSubmoduleBlock.stories.js';

const { Ahead, Failed, Large, LargeNarrow, NoPullRequest, Removed, RolledBack } = composeStories(stories);

const BEFORE = 'a1c9e2f0b7d84c3e9a5f1b2c3d4e5f6a7b8c9d0e';
const AFTER = 'd4f7b21c0e9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c';
const PULL_REQUESTS = 'Pull requests with the new commit';

test("the submodule's pull request opens in githq, not on GitHub", async () => {
    await Ahead.run();

    const link = page.getByRole('link', { name: 'Resolve child containers lazily', exact: true });
    await expect.element(link).toHaveAttribute('href', '/kedrzu/nzyme/pull/412');

    await userEvent.click(link);
    await expect.element(page.getByTestId('at')).toHaveTextContent('At: /kedrzu/nzyme/pull/412');
    await expect.element(page.getByTestId('on-github')).toHaveTextContent('On GitHub: nothing');
});

test('the pull requests come first in the block, and a block no pull request carries says so', async () => {
    await Ahead.run();
    const region = page.getByRole('region', { name: PULL_REQUESTS }).element();
    const comparison = page.getByRole('link', { name: 'Open comparison on GitHub' }).element();
    const commits = page.getByRole('list', { name: 'Commits' }).element();
    expect(region.compareDocumentPosition(comparison) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(region.compareDocumentPosition(commits) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await NoPullRequest.run();
    await expect
        .element(page.getByRole('region', { name: PULL_REQUESTS }))
        .toHaveTextContent(`No pull request carries ${AFTER.slice(0, 7)}`);

    await Removed.run();
    await expect.element(page.getByText('removed (was at')).toBeVisible();
    await expect.element(page.getByRole('region', { name: PULL_REQUESTS })).not.toBeInTheDocument();
});

test('Tab goes through the pull request, the comparison, each commit shown, then Show more of each list', async () => {
    await LargeNarrow.run();

    const expected = [
        'Resolve child containers lazily',
        'Open comparison on GitHub',
        ...Array.from(
            { length: 20 },
            (_, index) => `feat(ioc): step ${index + 1} of resolving child containers lazily`,
        ),
        'Show 18 more commits',
        'Show 28 more files',
    ];
    const reached: string[] = [];
    while (reached.length < expected.length) {
        await userEvent.tab();
        // The text's typography glues short words with no-break spaces.
        reached.push(document.activeElement?.textContent?.replaceAll(/\s+/gu, ' ').trim() ?? '');
    }

    expect(reached).toEqual(expected);
});

test('a long list shows 20 rows until Show more, and stays expanded when the block is drawn again', async () => {
    await Large.run();
    const commits = () => page.getByRole('list', { name: 'Commits' }).getByRole('listitem');
    const files = () => page.getByRole('list', { name: 'Files' }).getByRole('listitem');
    await expect.element(commits().first()).toBeVisible();
    expect(commits().all()).toHaveLength(20);
    expect(files().all()).toHaveLength(20);

    await userEvent.click(page.getByRole('button', { name: 'Show 18 more commits' }));
    await expect.poll(() => commits().all()).toHaveLength(38);
    expect(files().all()).toHaveLength(20);

    await userEvent.click(page.getByRole('button', { name: 'Show 28 more files' }));
    await expect.poll(() => files().all()).toHaveLength(48);

    await Large.run();
    await expect.element(commits().first()).toBeVisible();
    expect(commits().all()).toHaveLength(38);
    expect(files().all()).toHaveLength(48);
    await expect.element(page.getByRole('button', { name: /^Show \d+ more/u })).not.toBeInTheDocument();
});

test('the commits and the files sit side by side, tops aligned, on a wide block, and stack on a narrow one', async () => {
    await Large.run();
    let [commits, files] = await getPanels();
    expect(files.top).toBe(commits.top);
    expect(files.left).toBeGreaterThan(commits.right);

    await LargeNarrow.run();
    [commits, files] = await getPanels();
    expect(files.top).toBeGreaterThan(commits.bottom);
    expect(files.left).toBe(commits.left);
});

test('the comparison goes from the old pointer to the new one, and for a rollback the other way round', async () => {
    const comparison = () => page.getByRole('link', { name: 'Open comparison on GitHub' });

    await Ahead.run();
    await expect
        .element(comparison())
        .toHaveAttribute('href', `https://github.com/kedrzu/nzyme/compare/${BEFORE}...${AFTER}`);

    await RolledBack.run();
    await expect
        .element(comparison())
        .toHaveAttribute('href', `https://github.com/kedrzu/nzyme/compare/${AFTER}...${BEFORE}`);
});

test("a failure gives GitHub's words, and Try again reads it again", async () => {
    await Failed.run();
    await expect.element(page.getByText('Server Error')).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: 'Try again' }));
    await expect.element(page.getByText('Server Error')).not.toBeInTheDocument();
    await expect.element(page.getByText("Reading the submodule's history…")).toBeInTheDocument();
});

/** The bounds of the commits' panel and the files' panel. */
async function getPanels() {
    const commits = page.getByRole('list', { name: 'Commits' });
    await expect.element(commits).toBeVisible();
    const getBounds = (list: Element) => list.parentElement!.getBoundingClientRect();

    return [getBounds(commits.element()), getBounds(page.getByRole('list', { name: 'Files' }).element())] as const;
}
