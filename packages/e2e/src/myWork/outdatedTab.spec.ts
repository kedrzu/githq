import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';

import { openMyWork } from './openMyWork.js';
import { createSampleMyWork } from './sampleMyWork.js';

test('a newer githq opening the local copy reloads the tab', async ({ page, github }) => {
    const sample = createSampleMyWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    await expect(myWork.rows('Assigned to me')).not.toHaveCount(0);

    const reloaded = page.waitForEvent('load');
    const newerTab = await page.context().newPage();
    await newerTab.goto('/favicon.svg');
    await openNewerCopy(newerTab);
    await reloaded;
});

/** Opens the database one version up, as the first tab of a githq with a newer layout does, and leaves it. */
async function openNewerCopy(page: Page) {
    await page.evaluate(async login => {
        const name = `githq-${login}`;
        const version = (await indexedDB.databases()).find(database => database.name === name)?.version ?? 0;
        await new Promise<void>((resolve, reject) => {
            const request = indexedDB.open(name, version + 1);
            request.addEventListener('success', () => {
                request.result.close();
                resolve();
            });
            request.addEventListener('error', () => reject(request.error ?? new Error('Could not open the database')));
        });
    }, SAMPLE_VIEWER.viewer.login);
}
