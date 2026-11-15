import type { Locator } from '@playwright/test';

import { createSampleEditableWork } from '../edits/sampleEditableWork.js';
import { expect, test } from '../fixtures.js';
import { openMyWork } from '../myWork/openMyWork.js';

// A phone in portrait (mobile D5: the phone layout below 640 px of window width).
const PHONE = { width: 390, height: 844 };

test('mobile D27: on a phone a row swiped to the left offers Assign, whose menu at the bottom assigns', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    await page.setViewportSize(PHONE);

    // The list is laid out anew at the phone's width: swiped once it settled, again if a re-render took the swipe.
    await expect(page.getByRole('button', { name: 'Open places' })).toBeVisible();
    const row = myWork.row('Flaky login test');
    await expect(async () => {
        await swipeLeft(row);
        await expect(row.getByRole('button', { name: 'Assign' })).toBeVisible({ timeout: 1000 });
    }).toPass();
    await row.getByRole('button', { name: 'Assign' }).click();
    const assignees = page.getByRole('dialog', { name: /Assignees/u });
    await assignees.getByRole('option', { name: /monalisa/u }).click();
    await assignees.getByRole('button', { name: 'Close' }).click();

    await expect.poll(() => sample.world.stateOf(sample.secondIssue).assignees).toContain('monalisa');
});

test('mobile D28: on a phone several rows selected from the list options take a label at once through ⌘', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    await page.setViewportSize(PHONE);

    await page.getByRole('button', { name: 'Display' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Select items' }).click();
    await myWork.row('Flaky login test').click();
    await myWork.row('Document the keyboard shortcuts').click();
    await expect(page.getByText('2 selected').first()).toBeVisible();

    await page
        .getByRole('button', { name: /2 selected/u })
        .last()
        .click();
    await page
        .getByRole('option', { name: /labels/iu })
        .first()
        .click();
    await page.getByRole('option', { name: /^bug/u }).click();
    await page.keyboard.press('Escape');

    await expect.poll(() => sample.world.stateOf(sample.secondIssue).labels).toEqual(['bug']);
    expect(sample.world.stateOf(sample.thirdIssue).labels).toEqual(['bug']);
    expect(sample.world.stateOf(sample.issue).labels).toEqual([]);
});

/** A finger's swipe from the row's right part to its left, as touch pointer events. */
async function swipeLeft(row: Locator) {
    const box = await row.boundingBox();
    if (!box) {
        throw new Error('The row is not on screen.');
    }

    const y = box.y + box.height / 2;
    const start = box.x + box.width - 40;
    const init = { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, clientY: y };
    await row.dispatchEvent('pointerdown', { ...init, clientX: start, button: 0, buttons: 1 });
    for (const step of [20, 60, 120, 200]) {
        await row.dispatchEvent('pointermove', { ...init, clientX: start - step, buttons: 1 });
    }

    await row.dispatchEvent('pointerup', { ...init, clientX: start - 200, button: 0, buttons: 0 });
}
