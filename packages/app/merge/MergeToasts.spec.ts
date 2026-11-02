import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import * as stories from './MergeToasts.stories.js';

const { Confirmed, ConfirmedStack, OrganizationRestricted } = composeStories(stories);

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

test('PM34: a merge confirmed names the pull request', async () => {
    await Confirmed.run();

    await expect.element(page.getByText('fitloop/api#477 merged into main')).toBeVisible();
});

test("SS4: a stack's merge confirmed says how many landed, not only the top one", async () => {
    await ConfirmedStack.run();

    await expect.element(page.getByText('fitloop/api · 3 pull requests merged into main')).toBeVisible();
    await expect.element(page.getByText('fitloop/api#477')).not.toBeInTheDocument();
});
