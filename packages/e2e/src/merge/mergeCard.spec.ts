import type { Locator } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';

import { createSampleMergeableWork, FIRST_TITLE } from './sampleMergeableWork.js';

/** A text button (`Button`) as measured: its variant and its height. */
interface MeasuredButton {
    readonly variant: string;
    readonly height: number;
}

test("a pull request's merge card and composer act at 32 px, the card secondary throughout but for Merge", async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(FIRST_TITLE).click();
    await expect(item.mergeButton).toBeVisible();
    await expect(item.composerButton('Comment')).toBeVisible();

    await expect(item.mergeButton).toHaveAttribute('data-button-variant', 'primary');
    const card = await measureButtons(item.mergeCard);
    const others = card.filter(button => button.variant !== 'primary');
    // Delete or update the branch, Open on GitHub, Review files: more than one, so a mixed variant has a place to show.
    expect(others.length).toBeGreaterThan(1);
    expect(card.map(button => button.height)).toEqual(card.map(() => 32));
    expect(card.filter(button => button.variant === 'primary')).toHaveLength(1);
    expect(others.map(button => button.variant)).toEqual(others.map(() => 'secondary'));

    await expect(item.composer.getByRole('button', { name: 'Close pull request', exact: true })).toBeVisible();
    const composer: readonly MeasuredButton[] = [
        { variant: 'secondary', height: 32 },
        { variant: 'primary', height: 32 },
    ];
    expect(await measureButtons(item.composer)).toEqual(composer);
});

/** The text buttons (`Button` sets `data-button-variant`) inside `within`, in the page's order. */
function measureButtons(within: Locator): Promise<MeasuredButton[]> {
    return within.locator('[data-button-variant]').evaluateAll(elements =>
        elements.map(element => ({
            variant: element.getAttribute('data-button-variant') ?? '',
            height: element instanceof HTMLElement ? element.offsetHeight : 0,
        })),
    );
}
