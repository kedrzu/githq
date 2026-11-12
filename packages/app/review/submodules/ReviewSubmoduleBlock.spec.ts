import { composeStories } from '@storybook/vue3-vite';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ReviewSubmoduleBlock.stories.js';

const { Ahead, Failed, RolledBack } = composeStories(stories);

const BEFORE = 'a1c9e2f0b7d84c3e9a5f1b2c3d4e5f6a7b8c9d0e';
const AFTER = 'd4f7b21c0e9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c';

test("the submodule's pull request opens in githq, not on GitHub", async () => {
    await Ahead.run();

    const link = page.getByRole('link', { name: 'Resolve child containers lazily', exact: true });
    await expect.element(link).toHaveAttribute('href', '/kedrzu/nzyme/pull/412');

    await userEvent.click(link);
    await expect.element(page.getByTestId('at')).toHaveTextContent('At: /kedrzu/nzyme/pull/412');
    await expect.element(page.getByTestId('on-github')).toHaveTextContent('On GitHub: nothing');
});

test('Tab goes through every link of the block: the pull request, each commit, then the comparison', async () => {
    await Ahead.run();

    const expected = [
        'Resolve child containers lazily',
        'feat(ioc): resolve child containers lazily',
        'fix(vue-forms): keep focus while a button is busy',
        'chore: release 4.2.0',
        'Open comparison on GitHub',
    ];
    const reached: string[] = [];
    while (reached.length < expected.length) {
        await userEvent.tab();
        // The text's typography glues short words with no-break spaces.
        reached.push(document.activeElement?.textContent?.replaceAll(/\s+/gu, ' ').trim() ?? '');
    }

    expect(reached).toEqual(expected);
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
