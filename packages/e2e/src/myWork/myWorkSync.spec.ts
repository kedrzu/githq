import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { signIn } from '../session.js';

import { expectMyWorkCounts } from './expectMyWorkCounts.js';
import { openMyWork } from './openMyWork.js';
import { createSampleMyWork } from './sampleMyWork.js';

test('a change on GitHub shows up after the next poll', async ({ page, github }) => {
    // Time runs as usual, and the 30 seconds to the next poll can be skipped.
    await page.clock.install();
    const sample = createSampleMyWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);

    sample.world.retitle(sample.otherAssignedIssue, 'Document every keyboard shortcut');
    sample.world.leave(sample.mention, 'mentioned');
    await page.clock.fastForward('00:30');

    // Changed just now: first of its group.
    await expect(myWork.rows('Assigned to me')).toHaveText([
        /Document every keyboard shortcut/,
        /Sign-in loops after the token expires/,
        /Redirect once after sign-in/,
    ]);
    await expectMyWorkCounts({
        myWork,
        shell,
        counts: { 'Review requested': 1, 'My pull requests': 3, 'Assigned to me': 2, Mentioned: 0 },
    });
    await expect(shell.statusBar).toContainText('Up to date');
});

test('on the first download the groups that answered are usable while the others are still arriving', async ({
    page,
    github,
}) => {
    const sample = createSampleMyWork();
    // The searches go one after another: "Assigned to me" holds back "Mentioned" too.
    const releaseAssigned = sample.world.holdSearch('assigned');
    sample.world.install(github);
    const shell = await signIn(page, github);
    const myWork = new MyWorkScreenHarness(page);

    // Until "Assigned to me" arrives, the pull request closing one of its issues is listed with the others.
    await expect(myWork.rows('My pull requests')).toHaveText([
        /Redirect once after sign-in/,
        /Cache search results/,
        /Move the sidebar state to the store/,
        /Retry polls on network errors/,
    ]);
    await expect(myWork.group('Assigned to me')).toContainText('Still arriving');
    await expect(myWork.group('Mentioned')).toContainText('Still arriving');
    await page.keyboard.press('j');
    await expect(myWork.selectedRow).toContainText('Add rate limit headers to the API');

    releaseAssigned();
    // The pull request moves under the issue it closes.
    await expect(myWork.rows('Assigned to me')).toHaveText([
        /Sign-in loops after the token expires/,
        /Redirect once after sign-in/,
        /Document the keyboard shortcuts/,
    ]);
    await expect(myWork.rows('Mentioned')).toHaveText([/Dark mode for the status bar/]);
    await expect(shell.statusBar).toContainText('Up to date');
});

test('an item deleted on GitHub while its search still lists it is left out, and the list still loads', async ({
    page,
    github,
}) => {
    const sample = createSampleMyWork();
    sample.world.delete(sample.mention);
    const { myWork, shell } = await openMyWork(page, github, sample.world);

    await expectMyWorkCounts({
        myWork,
        shell,
        counts: { 'Review requested': 1, 'My pull requests': 3, 'Assigned to me': 2, Mentioned: 0 },
    });
    await expect(shell.statusBar).toContainText('Up to date');
});

test('a reload shows the kept list before GitHub answers anything', async ({ page, github }) => {
    const { myWork, shell } = await openMyWork(page, github, createSampleMyWork().world);
    await expect.poll(() => readKeptMyWorkSuccess(page)).not.toBeNull();

    github.holdAnswers();
    await page.reload();
    // The app asked GitHub again — who the user is, the first search — and is still waiting.
    await expect.poll(() => github.heldRequests).toBeGreaterThan(0);

    await expect(myWork.rows('Assigned to me')).toHaveText([
        /Sign-in loops after the token expires/,
        /Redirect once after sign-in/,
        /Document the keyboard shortcuts/,
    ]);
    await expectMyWorkCounts({
        myWork,
        shell,
        counts: { 'Review requested': 1, 'My pull requests': 3, 'Assigned to me': 2, Mentioned: 1 },
    });
    expect(github.heldRequests).toBeGreaterThan(0);

    github.releaseAnswers();
    await expect.poll(() => github.heldRequests).toBe(0);
    await expect(shell.statusBar).toContainText('Up to date');
});

/** When the kept copy (IndexedDB) last saw "my work" downloaded, `null` before it was written. */
async function readKeptMyWorkSuccess(page: Page): Promise<number | null> {
    return await page.evaluate(async databaseName => {
        // Only once the app has created it: opened before, it would be created empty.
        const db = await settle(indexedDB.open(databaseName));
        try {
            const record: unknown = await settle(db.transaction('meta').objectStore('meta').get('sync'));
            if (typeof record !== 'object' || record === null || !('value' in record)) {
                return null;
            }

            const { value } = record;
            if (typeof value !== 'object' || value === null || !('myWork' in value)) {
                return null;
            }

            const { myWork } = value;
            if (typeof myWork !== 'object' || myWork === null || !('lastSuccessAt' in myWork)) {
                return null;
            }

            return typeof myWork.lastSuccessAt === 'number' ? myWork.lastSuccessAt : null;
        } finally {
            db.close();
        }

        function settle<T>(request: IDBRequest<T>) {
            return new Promise<T>((resolve, reject) => {
                request.addEventListener('success', () => resolve(request.result));
                request.addEventListener('error', () => reject(new Error(request.error?.message)));
            });
        }
    }, `githq-${SAMPLE_VIEWER.viewer.login}`);
}
