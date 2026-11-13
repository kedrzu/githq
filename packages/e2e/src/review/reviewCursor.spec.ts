import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

import { answerReview } from './answerReview.js';
import type { SampleReviewFile, SampleReviewThread } from './answerReview.js';

// The line cursor (D44): the pointer and the keys move it, the keys act on it, and the diff scrolls only to keep it in
// the middle third of the screen.

const ADDRESS = '/acme/web/pull/15/files';

const FIRST = 'src/a/first.ts';
const SECOND = 'src/b/second.ts';
const LONG = 'src/c/long.ts';

/** How tall the pinned header is, which the screen's thirds are measured under. */
const PINNED = 38;

const numbered = (count: number) =>
    Array.from({ length: count }, (_, index) => `const line${index + 1} = ${index + 1};`);

/** Line 20 changed, a split row with both halves; old lines 41 and 42 deleted, rows with only the older half. */
const FIRST_FILE: SampleReviewFile = {
    path: FIRST,
    before: `${numbered(50)
        .flatMap((line, index) => {
            if (index === 19) {
                return ['const old20 = 20;'];
            }

            return index === 39 ? [line, 'const gone1 = 1;', 'const gone2 = 2;'] : [line];
        })
        .join('\n')}\n`,
    after: `${numbered(50)
        .map((line, index) => (index === 19 ? 'const changed20 = 20;' : line))
        .join('\n')}\n`,
};
const SECOND_FILE: SampleReviewFile = {
    path: SECOND,
    before: 'export const second = 1;\n',
    after: 'export const second = 2;\n',
};
/** Every line changed: every row a stop, and room to scroll. */
const LONG_FILE: SampleReviewFile = {
    path: LONG,
    before: `${numbered(300).join('\n')}\n`,
    after: `${numbered(300)
        .map(line => `${line} // changed`)
        .join('\n')}\n`,
};
const THREAD: SampleReviewThread = { id: 'T1', path: FIRST, line: 22, comments: ['<p>Why this line?</p>'] };

test('hovering either half of a split row puts the cursor on the row and makes its file current; C comments on its newer line, or its older on a row with only that, and V marks its file (D43, D44)', async ({
    page,
    github,
}) => {
    const review = await openCursor(page, github, [FIRST_FILE, SECOND_FILE]);
    const center = await getDiffCenter(review);

    // The newer half of a changed row: C takes its newer line, the box under that half.
    await review.pointAt(review.code('const changed20 = 20;'));
    await expect(review.cursorRow).toContainText('const changed20 = 20;');
    await expect(review.cursorRow).toContainText('const old20 = 20;');
    await expect(review.currentFileRow).toContainText('first.ts');
    await page.keyboard.press('c');
    const newer = review.commentBox('Comment on line 20');
    await expect(newer).toBeVisible();
    expect((await newer.boundingBox())?.x).toBeGreaterThanOrEqual(center);
    await page.keyboard.press('Escape');
    await expect(newer).toBeHidden();

    // The older half of a row with only that: C takes its older line, the box under the older half.
    await review.pointAt(review.code('const gone1 = 1;'));
    await expect(review.cursorRow).toContainText('const gone1 = 1;');
    await page.keyboard.press('c');
    const older = review.commentBox('Comment on line 41');
    await expect(older).toBeVisible();
    const olderBox = await older.boundingBox();
    expect((olderBox?.x ?? Infinity) + (olderBox?.width ?? Infinity)).toBeLessThanOrEqual(center);
    await page.keyboard.press('Escape');
    await expect(older).toBeHidden();

    // The older half of the next file's row: that file is current, and V marks it, not the first.
    await review.pointAt(review.code('export const second = 1;'));
    await expect(review.cursorRow).toContainText('export const second = 2;');
    await expect(review.currentFileRow).toContainText('second.ts');
    await page.keyboard.press('v');
    await expect(review.viewedButton(SECOND)).toHaveAttribute('aria-pressed', 'true');
    await expect(review.viewedButton(FIRST)).toHaveAttribute('aria-pressed', 'false');
});

test('↓ moves the cursor to the next stop and onto the thread under a line, where R replies; ↑ moves it back (D44)', async ({
    page,
    github,
}) => {
    const review = await openCursor(page, github, [FIRST_FILE, SECOND_FILE], [THREAD]);

    await review.pointAt(review.code('const line21 = 21;').last());
    const line21 = await review.cursorKey();
    await page.keyboard.press('ArrowDown');
    await expect(review.cursorRow).toContainText('const line22 = 22;');

    await page.keyboard.press('ArrowDown');
    await expect(review.cursorRow).toContainText('Why this line?');
    await expect(review.focusedThread).toContainText('Why this line?');
    await page.keyboard.press('r');
    const reply = review.commentBox('Reply to sofiab');
    await expect(reply).toBeVisible();
    await expect(review.thread('Why this line?').getByRole('group', { name: 'Reply to sofiab' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(reply).toBeHidden();

    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => review.cursorKey()).toBe(line21);
});

test('the keys move the cursor without scrolling until it reaches two thirds of the screen, then scroll to keep it in the middle third (D44)', async ({
    page,
    github,
}) => {
    const review = await openCursor(page, github, [LONG_FILE]);
    const scrollTop = () => review.diff.evaluate(element => element.scrollTop);
    const start = await scrollTop();
    const diff = await review.diff.boundingBox();
    if (!diff) {
        throw new Error('The diff is not on screen');
    }

    const band = (diff.height - PINNED) / 3;
    const bandTop = diff.y + PINNED + band;
    const bandBottom = diff.y + diff.height - band;

    // Down to two thirds, nothing scrolling: the first press that scrolls is the one reaching them.
    let unscrolled = await getCursorBox(review);
    for (let step = 0; step < 60; step++) {
        const from = await review.cursorKey();
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => review.cursorKey()).not.toBe(from);
        if ((await scrollTop()) !== start) {
            break;
        }

        unscrolled = await getCursorBox(review);
        expect(unscrolled.bottom).toBeLessThanOrEqual(bandBottom + 2);
    }

    expect(await scrollTop()).toBeGreaterThan(start);
    expect(unscrolled.bottom).toBeGreaterThan(bandBottom - 2 * 20);

    // On, the diff scrolling under it, the cursor staying in the middle third.
    for (let step = 0; step < 8; step++) {
        const before = await scrollTop();
        await page.keyboard.press('ArrowDown');
        await expect.poll(scrollTop).toBeGreaterThan(before);
        const cursor = await getCursorBox(review);
        expect(cursor.top).toBeGreaterThanOrEqual(bandTop - 2);
        expect(cursor.bottom).toBeLessThanOrEqual(bandBottom + 2);
    }
});

test('a single ↓ moves the cursor exactly one stop, also right after a hold the window losing focus ended (D44)', async ({
    page,
    github,
}) => {
    // Every line changed: each row is a stop, the next stop the next line.
    const review = await openCursor(page, github, [LONG_FILE]);
    await review.pointAt(review.code('const line5 = 5; // changed'));
    await expect.poll(() => getCursorLine(review)).toBe(5);

    await page.keyboard.press('ArrowDown');
    await expect.poll(() => getCursorLine(review)).toBe(6);
    await page.waitForTimeout(200);
    expect(await getCursorLine(review)).toBe(6);

    // Held for longer than the speed-up waits: the repeats move more than a stop each.
    for (let repeat = 0; repeat < 12; repeat++) {
        await page.keyboard.down('ArrowDown');
        await page.waitForTimeout(60);
    }

    await expect.poll(() => getCursorLine(review)).toBeGreaterThan(6 + 12);

    // ⌘Tab away while held: the key's release goes elsewhere, and the next press is a press, not the hold going on.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const held = await getCursorLine(review);
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => getCursorLine(review)).toBe(held + 1);
    await page.waitForTimeout(200);
    expect(await getCursorLine(review)).toBe(held + 1);
});

test('rows scrolling under a still pointer leave the cursor; a scroll taking its stop off the top brings it to the first stop under the pinned header (D44)', async ({
    page,
    github,
}) => {
    const review = await openCursor(page, github, [LONG_FILE]);
    await review.pointAt(review.code('const line12 = 12; // changed'));
    const held = await review.cursorKey();
    await expect(review.cursorRow).toContainText('const line12 = 12; // changed');

    // A little, the pointer still: other rows come under it, and the cursor stays on its stop, still on screen.
    const scrollTop = () => review.diff.evaluate(element => element.scrollTop);
    await page.mouse.wheel(0, 60);
    await expect.poll(scrollTop).toBeGreaterThan(0);
    await page.evaluate(
        () =>
            new Promise(resolve => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            }),
    );
    expect(await review.cursorKey()).toBe(held);

    // Far enough for its stop to go off the top: the cursor comes to the first stop showing under the pinned header.
    await page.mouse.wheel(0, 800);
    await expect(review.code('const line12 = 12; // changed')).not.toBeInViewport();
    await expect.poll(async () => (await review.cursorKey()) === (await review.firstStopKey())).toBe(true);
    expect(await review.cursorKey()).not.toBe(held);
});

test("hovering the pinned header's overlay leaves the cursor where it is; a click on it puts the cursor on that file's header (D44)", async ({
    page,
    github,
}) => {
    const review = await openCursor(page, github, [LONG_FILE, SECOND_FILE]);
    await review.diff.evaluate(element => element.scrollBy(0, 600));
    await review.pointAt(review.code('const line40 = 40; // changed').last());
    const held = await review.cursorKey();
    await expect(review.cursorRow).toContainText('const line40 = 40; // changed');

    // The header pinned over the diff is a copy: the real one is far above.
    await review.pointAt(review.topHeader(LONG));
    expect(await review.cursorKey()).toBe(held);

    await review.topHeader(LONG).click();
    await expect(review.cursorRow.getByRole('heading', { name: LONG, exact: true })).toBeVisible();
    await expect(review.currentFileRow).toContainText('long.ts');
});

/** A review of these files opened at its top, its first file's code in view. */
async function openCursor(
    page: Page,
    github: Parameters<typeof openMyWork>[1],
    files: readonly SampleReviewFile[],
    threads: readonly SampleReviewThread[] = [],
): Promise<ReviewScreenHarness> {
    await openMyWork(page, github, createSampleMyWork().world);
    answerReview(github, { repository: 'acme/web', number: 15, files, threads });
    const review = new ReviewScreenHarness(page);
    await page.goto(ADDRESS);
    await expect(review.cursorRow).toBeAttached();
    await expect(page.getByText(/Fetching file contents/u)).toHaveCount(0);
    return review;
}

/** Where the halves of a split row meet, on the page. */
async function getDiffCenter(review: ReviewScreenHarness): Promise<number> {
    const box = await review.diff.boundingBox();
    if (!box) {
        throw new Error('The diff is not on screen');
    }

    return box.x + box.width / 2;
}

/** A row's top and bottom on the page. */
interface RowEdges {
    readonly top: number;
    readonly bottom: number;
}

/** The cursor's row, top and bottom on the page. */
async function getCursorBox(review: ReviewScreenHarness): Promise<RowEdges> {
    const box = await review.cursorRow.boundingBox();
    if (!box) {
        throw new Error('The cursor is not on screen');
    }

    return { top: box.y, bottom: box.y + box.height };
}

/** The line of the long file the cursor is on, by its code. */
async function getCursorLine(review: ReviewScreenHarness): Promise<number> {
    const match = /const line(\d+) = /u.exec((await review.cursorRow.textContent()) ?? '');
    if (!match?.[1]) {
        throw new Error('The cursor is not on a line');
    }

    return Number(match[1]);
}
