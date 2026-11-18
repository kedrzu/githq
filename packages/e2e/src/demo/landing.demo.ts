import path from 'node:path';

import type { Page, TestInfo } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { ProjectScreenHarness } from '../harnesses/ProjectScreen.harness.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { answerReview } from '../review/answerReview.js';

import { openDemo, playDemo } from './playDemo.js';
import { recordFrames } from './recordFrames.js';
import { DEMO_ISSUE, DEMO_PROJECT } from './sampleDemoWork.js';
import { createSampleLandingWork, LANDING_REVIEW, LANDING_REVIEW_FILES } from './sampleLandingWork.js';

// The landing page's pictures, from the app as it is, against the mocked GitHub: the hero's recording ({@link playDemo})
// and the features' screenshots, at twice the size the page shows them. `recordDemo.ts landing` runs them and encodes
// what they write into `packages/app/public/landing/`.

/** {@link DEMO_ISSUE}'s page. */
const DEMO_ITEM_PATH = 'fitloop/webapp/issues/1187';

/** Where the screenshots go, as `<name>.png`, for `recordDemo.ts` to encode. */
const SHOTS_DIR = 'landing-shots';

/** The part of a screen a feature shows: its top left, 640×560 at the page's scale (`LandingFeature`'s `image`). */
const FEATURE_SIZE = { width: 640, height: 560 };

test.use({ deviceScaleFactor: 2, launchOptions: { args: ['--force-device-scale-factor=2'] } });

test.describe('hero', () => {
    // The hero shows the window at 1200 × 750, as large as it gets on a wide page.
    test.use({ viewport: { width: 1200, height: 750 } });

    test('recording', async ({ page, github }, testInfo) => {
        test.setTimeout(120_000);
        const world = createSampleLandingWork();
        await openDemo(page, github, world);
        const stopRecording = await recordFrames(page, testInfo);
        await playDemo(page, world);
        await stopRecording();
    });
});

test.describe('features', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('one place', async ({ page, github }, testInfo) => {
        await openDemo(page, github, createSampleLandingWork());
        await shoot(page, testInfo, 'one-place', { x: 0, y: 0 });
    });

    test('agents', async ({ page, github }, testInfo) => {
        await openDemo(page, github, createSampleLandingWork());
        const myWork = new MyWorkScreenHarness(page);
        await myWork.groupingButton.click();
        await page.getByRole('menuitemradio', { name: 'Author' }).click();
        await expect(myWork.groupingButton).toHaveText('Group: Author');
        await page.mouse.move(-10, -10);
        await shoot(page, testInfo, 'agents', await originOf(page.getByRole('main')));
    });

    test('review', async ({ page, github }, testInfo) => {
        await openDemo(page, github, createSampleLandingWork());
        answerReview(github, { ...LANDING_REVIEW, files: LANDING_REVIEW_FILES });
        await page.goto(`/${LANDING_REVIEW.repository}/pull/${LANDING_REVIEW.number}/files`);
        const review = new ReviewScreenHarness(page);
        await expect(review.title).toHaveText(LANDING_REVIEW.title);
        await review.chooseLayout('Unified');
        await page.mouse.move(-10, -10);
        await page.waitForTimeout(1000);
        // Past the rail, the stack and the files beside the diff.
        await shoot(page, testInfo, 'review', { x: (await originOf(page.getByRole('main'))).x, y: 0 });
    });

    test('instant', async ({ page, github }, testInfo) => {
        await openDemo(page, github, createSampleLandingWork());
        // The card moved a moment ago, as the toast laid over the picture says.
        await openWithMenu(page, 'timezone');
        const item = new ItemViewHarness(page);
        await expect(item.title).toHaveText(DEMO_ISSUE);
        await page.keyboard.press('s');
        await page.keyboard.type('in pr');
        await page.keyboard.press('Enter');
        await expect(item.projectField('Status')).toHaveAccessibleName('Status: In Progress');
        await page.keyboard.press('Escape');
        await openWithMenu(page, DEMO_PROJECT);
        const board = new ProjectScreenHarness(page);
        await expect(board.rows('In Progress').filter({ hasText: DEMO_ISSUE })).toHaveCount(1);
        await page.mouse.move(-10, -10);
        await page.waitForTimeout(500);
        await shoot(page, testInfo, 'instant', await originOf(page.getByRole('main')));
    });

    test('keyboard', async ({ page, github }, testInfo) => {
        await openDemo(page, github, createSampleLandingWork());
        await shoot(page, testInfo, 'keyboard', await originOf(page.getByRole('main')));
        const menu = new CommandMenuHarness(page);
        await menu.open();
        await page.keyboard.type('sync');
        await page.waitForTimeout(500);
        await menu.root.screenshot({ path: shotPath(testInfo, 'command-menu'), animations: 'disabled' });
    });

    test('faithful', async ({ page, github }, testInfo) => {
        await openDemo(page, github, createSampleLandingWork());
        await page.goto(`/${DEMO_ITEM_PATH}`);
        await expect(new ItemViewHarness(page).title).toHaveText(DEMO_ISSUE);
        await page.mouse.move(-10, -10);
        await page.waitForTimeout(500);
        await shoot(page, testInfo, 'faithful', await originOf(page.getByRole('main')));
    });
});

/** A point on the page. */
interface Point {
    readonly x: number;
    readonly y: number;
}

/** Where `locator` starts on the page. */
async function originOf(locator: ReturnType<Page['locator']>): Promise<Point> {
    const box = await locator.boundingBox();
    if (!box) {
        throw new Error('Nothing to take a picture of');
    }

    return { x: box.x, y: box.y };
}

/** Opens what the command menu finds for `query` first. */
async function openWithMenu(page: Page, query: string) {
    const menu = new CommandMenuHarness(page);
    await menu.open();
    await page.keyboard.type(query);
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
}

/** Saves the part of the screen at `origin`, a feature's size unless `size` says otherwise, as `<name>.png`. */
async function shoot(page: Page, testInfo: TestInfo, name: string, origin: Point, size = FEATURE_SIZE) {
    await page.screenshot({ path: shotPath(testInfo, name), clip: { ...origin, ...size }, animations: 'disabled' });
}

function shotPath(testInfo: TestInfo, name: string) {
    return path.join(testInfo.project.outputDir, SHOTS_DIR, `${name}.png`);
}
