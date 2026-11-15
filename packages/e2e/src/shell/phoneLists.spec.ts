import { expect, test } from '../fixtures.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

// A phone in portrait (mobile D5: the phone layout below 640 px of window width).
const PHONE = { width: 390, height: 844 };

test("mobile D23: on a phone My work's filters are a strip under the top bar, each with its count", async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.setViewportSize(PHONE);
    await page.goto('/');

    const filters = page.getByRole('group', { name: 'Filters' });
    await expect(filters.getByRole('button', { name: /^All/u })).toHaveAttribute('aria-pressed', 'true');
    await filters.getByRole('button', { name: /^Needs me/u }).click();
    await expect(filters.getByRole('button', { name: /^Needs me/u })).toHaveAttribute('aria-pressed', 'true');
});

test("mobile D17, D36: on a phone the command line opens the place's parts, and the options sheet regroups the list", async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.setViewportSize(PHONE);
    await page.goto(`/${SAMPLE_REPOSITORY}/issues`);
    const repository = new RepositoryScreenHarness(page);
    await expect(repository.group('v1.0')).toBeVisible();

    // The options sheet: grouping changed in place, the list behind following; Done closes it.
    await page.getByRole('button', { name: 'Display' }).click();
    const sheet = page.getByRole('dialog');
    await sheet
        .getByRole('group', { name: 'Group by' })
        .getByRole('button', { name: /^Author/u })
        .click();
    await expect(repository.group('v1.0')).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Done' }).click();
    await expect(sheet).toHaveCount(0);

    // The command line's chip opens the repository's parts first: Pull requests switches the section.
    await page.getByRole('button', { name: /Issues.*Do or find…/u }).click();
    await page
        .getByRole('option', { name: /^Pull requests/u })
        .first()
        .click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/pulls`);
});
