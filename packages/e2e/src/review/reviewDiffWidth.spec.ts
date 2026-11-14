import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { getSettingsWrites } from '../settings/answerSettingsRepository.js';
import type { SettingsRepository } from '../settings/answerSettingsRepository.js';
import { turnOnSaving } from '../settings/turnOnSaving.js';

import { answerReview } from './answerReview.js';

// The diff stands in a box centred between the review's side columns, its edges resizing it symmetrically; the width
// is a maximum kept as `reviewDiffWidth` in the synced settings, by default the whole width (`ReviewView.vue`).

const ADDRESS = '/acme/web/pull/3/files';
/** {@link getBox} of a box as wide as the diff: no gap on either side. */
const FILLING = { left: 0, right: 0 };

test.use({ viewport: { width: 1920, height: 900 } });

test("dragging the diff's edge saves its width, centred in the diff; the side columns and a narrower window draw it narrower and never change it", async ({
    page,
    github,
}) => {
    const { review, repository } = await openReview(page, github);
    const shell = new AppShellHarness(page);
    await page.keyboard.press('ControlOrMeta+b');
    await expect(review.fileList).toBeHidden();
    await expect.poll(() => getBox(review)).toEqual(FILLING);
    const room = await getRoom(review);

    // Both edges move: 50 px in on the right takes 100 px off the box, 50 px on each side.
    await shell.drag(review.diffEdge('right'), -50);

    const saved = room - 100;
    await expect.poll(() => getBox(review)).toEqual({ left: 50, width: saved, right: 50 });
    await expect.poll(() => readSettings(repository)).toMatchObject({ reviewDiffWidth: saved });
    const file = repository.file;
    const writes = getSettingsWrites(github).length;

    await test.step('the file list shown narrows it, and hidden again it is as wide as saved', async () => {
        await page.keyboard.press('ControlOrMeta+b');
        await expect(review.fileList).toBeVisible();
        await expect.poll(() => getBox(review)).toEqual(FILLING);
        expect(await getRoom(review)).toBeLessThan(saved);

        await page.keyboard.press('ControlOrMeta+b');
        await expect(review.fileList).toBeHidden();
        await expect.poll(() => getBox(review)).toEqual({ left: 50, width: saved, right: 50 });
    });

    await test.step('the conversation shown narrows it, and hidden again it is as wide as saved', async () => {
        await page.keyboard.press('Alt+ControlOrMeta+b');
        await expect(review.conversation).toBeVisible();
        await expect.poll(() => getBox(review)).toEqual(FILLING);
        expect(await getRoom(review)).toBeLessThan(saved);

        await page.keyboard.press('Alt+ControlOrMeta+b');
        await expect(review.conversation).toBeHidden();
        await expect.poll(() => getBox(review)).toEqual({ left: 50, width: saved, right: 50 });
    });

    await test.step('a narrower window narrows it, and widened again it is as wide as saved', async () => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await expect.poll(() => getBox(review)).toEqual(FILLING);
        expect(await getRoom(review)).toBeLessThan(saved);

        await page.setViewportSize({ width: 1920, height: 900 });
        await expect.poll(() => getBox(review)).toEqual({ left: 50, width: saved, right: 50 });
    });

    expect(repository.file).toBe(file);
    expect(getSettingsWrites(github)).toHaveLength(writes);
});

test('the diff dragged out to the whole width saves "full", and then fills a wider window too', async ({
    page,
    github,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { review, repository } = await openReview(page, github);
    const shell = new AppShellHarness(page);
    await expect.poll(() => getBox(review)).toEqual(FILLING);
    const room = await getRoom(review);

    await shell.drag(review.diffEdge('left'), 100);
    await expect.poll(() => readSettings(repository)).toMatchObject({ reviewDiffWidth: room - 200 });
    await shell.drag(review.diffEdge('left'), -1000);

    await expect.poll(() => getBox(review)).toEqual(FILLING);
    await expect.poll(() => readSettings(repository)).toMatchObject({ reviewDiffWidth: 'full' });

    await page.setViewportSize({ width: 1920, height: 900 });
    await expect.poll(() => getRoom(review)).toBeGreaterThan(room);
    await expect.poll(() => getBox(review)).toEqual(FILLING);
});

/** Turns saving on and opens the review of acme/web#3, a pull request of one changed file. */
async function openReview(page: Page, github: GitHubMock) {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    const id = world.pullRequest({
        repository: 'acme/web',
        number: 3,
        title: 'Retry polls',
        foundBy: ['authored'],
        minutesAgo: 5,
    });
    await openMyWork(page, github, world);
    answerReview(github, {
        repository: 'acme/web',
        number: 3,
        id,
        files: [{ path: 'src/poll.ts', before: 'const retries = 1;\n', after: 'const retries = 3;\n' }],
    });
    const repository = await turnOnSaving(page, github, { exists: false, file: null });
    const review = new ReviewScreenHarness(page);
    await page.goto(ADDRESS);
    await expect(review.code('const retries = 3;')).toBeVisible();
    await expect(review.diffBox).toBeVisible();
    return { review, repository };
}

/** The width there is for the diff's box: the diff's scroll inside its scrollbar. */
async function getRoom(review: ReviewScreenHarness) {
    return await review.diff.evaluate(diff => diff.clientWidth);
}

/**
 * The gaps between the diff's box and the diff's edges inside its scrollbar, and the box's width unless it fills the
 * diff, in whole pixels.
 */
async function getBox(review: ReviewScreenHarness) {
    const diff = await review.diff.evaluate(element => {
        const { left } = element.getBoundingClientRect();
        return { left, right: left + element.clientWidth };
    });
    const box = await review.diffBox.boundingBox();
    if (!box) {
        return null;
    }

    const left = Math.round(box.x - diff.left);
    const right = Math.round(diff.right - box.x - box.width);
    return left === 0 && right === 0 ? { left, right } : { left, width: Math.round(box.width), right };
}

function readSettings(repository: SettingsRepository): unknown {
    return repository.file && JSON.parse(repository.file.text);
}
