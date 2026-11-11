import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ItemThreadReview.stories.js';

const { ApprovedHeadOnly, ChangesRequested, Dismissed, ResolvedInOneFile } = composeStories(stories);

test('a resolved thread folds to its row: Enter opens it, Hide folds it again', async () => {
    await ChangesRequested.run();

    const row = page.getByRole('button', {
        name: /^Resolved src\/store\/schema\.ts/u,
    });
    expect(page.getByText('Moved it in 0c94d7e.').query()).toBeNull();
    row.element().focus();
    await userEvent.keyboard('{Enter}');

    await expect.element(page.getByText('Moved it in 0c94d7e.')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Hide', exact: true }));
    expect(page.getByText('Moved it in 0c94d7e.').query()).toBeNull();
    await expect.element(row).toBeVisible();
});

test('a dismissed review says what it was and folds to its head until Show review', async () => {
    await Dismissed.run();

    await expect.element(page.getByText('requested changes · dismissed')).toBeVisible();
    expect(page.getByText('The upgrade path loses data in one case').query()).toBeNull();

    await userEvent.click(page.getByRole('button', { name: 'Show review' }));
    await expect
        .element(
            page.getByText('The upgrade path loses data in one case', {
                exact: false,
            }),
        )
        .toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Hide review' }));
    expect(page.getByText('The upgrade path loses data in one case').query()).toBeNull();
});

test('an approval with nothing written and no threads is its head alone, no empty body under it', async () => {
    await ApprovedHeadOnly.run();

    const head = page.getByText('approved', { exact: true });
    await expect.element(head).toBeVisible();
    expect(head.element().closest('p')?.nextElementSibling).toBeNull();
});

test('resolved threads of one file say their first lines after it, so they can be told apart; one alone says its file', async () => {
    await ResolvedInOneFile.run();

    const rows = page.getByRole('button', { name: /^Resolved/u });
    await expect.element(rows.first()).toHaveAccessibleName(/^Resolved src\/store\/schema\.ts · Nit: the version/u);
    await expect.element(rows.last()).toHaveAccessibleName(/^Resolved src\/store\/schema\.ts · STORES reads/u);

    await ChangesRequested.run();
    await expect
        .element(page.getByRole('button', { name: /^Resolved/u }))
        .toHaveAccessibleName(/^Resolved src\/store\/schema\.ts dkim mlaine 2 comments/u);
});
