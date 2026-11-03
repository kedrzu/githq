import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import * as stories from './MergeToasts.stories.js';

const { OrganizationRestricted, Reverted } = composeStories(stories);

test("G5: a merge refused by an organisation that hasn't approved githq says so plainly and leads to requesting access", async () => {
    await OrganizationRestricted.run();

    const toast = page.getByRole('listitem').filter({ hasText: "fitloop/api#477 wasn't merged" });
    await expect
        .element(toast)
        .toHaveTextContent(
            "fitloop hasn't approved githq, so githq can read its public repositories but can't change anything there.",
        );
    await expect.element(toast).not.toHaveTextContent('undone');
    await expect
        .element(toast.getByRole('link', { name: 'Request access on GitHub' }))
        .toHaveAttribute('href', `${window.location.origin}/api/auth/approval`);
    await expect.element(toast.getByRole('link', { name: 'Open on GitHub' })).not.toBeInTheDocument();
});

test('a revert GitHub opened says which pull request reverts which, and leads to it', async () => {
    await Reverted.run();

    const toast = page.getByRole('listitem').filter({ hasText: 'fitloop/api#477 reverted by #480' });
    await expect
        .element(toast.getByRole('link', { name: 'Open on GitHub' }))
        .toHaveAttribute('href', 'https://github.com/fitloop/api/pull/480');
    await expect.element(toast.getByRole('button', { name: 'Open', exact: true })).toBeVisible();
});
