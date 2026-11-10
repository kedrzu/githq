import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './GitHubHtml.stories.js';

const { Body, BodyInItem } = composeStories(stories);

test('a link githq shows points at the app’s path; the rest stay GitHub’s, opening in a new tab', async () => {
    await Body.run();

    const item = page.getByRole('link', { name: 'a comment on #12' });
    await expect.element(item).toHaveAttribute('href', '/acme/web/issues/12#issuecomment-5');
    await expect.element(item).not.toHaveAttribute('target');
    await expect
        .element(page.getByRole('link', { name: 'the open issues' }))
        .toHaveAttribute('href', '/acme/web/issues?q=is%3Aopen');

    for (const [name, href] of [
        ['@octocat', 'https://github.com/octocat'],
        ['a1b2c3d', 'https://github.com/acme/web/commit/a1b2c3d'],
    ]) {
        const link = page.getByRole('link', { name });
        await expect.element(link).toHaveAttribute('href', href);
        await expect.element(link).toHaveAttribute('target', '_blank');
        await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
        await expect.element(link).not.toHaveAttribute('data-githq-link');
    }

    const footnote = page.getByRole('link', { name: '1', exact: true });
    await expect.element(footnote).toHaveAttribute('href', '#user-content-fn-1');
    await expect.element(footnote).not.toHaveAttribute('target');
});

test('a click on a link githq shows opens it in the app; in an opened item, an item opens there', async () => {
    await Body.run();
    await userEvent.click(page.getByRole('link', { name: 'the open issues' }));
    await expect.element(page.getByTestId('at')).toHaveTextContent('At: /acme/web/issues?q=is%3Aopen');

    await BodyInItem.run();
    await userEvent.click(page.getByRole('link', { name: 'a comment on #12' }));
    await expect.element(page.getByTestId('opened')).toHaveTextContent('Opened: acme/web#12');
});
