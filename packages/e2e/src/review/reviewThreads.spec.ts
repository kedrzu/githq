import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

import { answerReview } from './answerReview.js';
import type { AnsweredReview, SampleReviewFile, SampleReviewThread } from './answerReview.js';

const REVIEW_ADDRESS = '/acme/web/pull/15/files';

const ENGINE = 'src/engine.ts';
const LOCK = 'bun.lock';
const VIEWED = 'src/viewed.ts';
const RENAMED = 'src/renamed.ts';
const GONE = 'src/removed.ts';

const LATE_IMAGE = 'https://user-images.githubusercontent.com/late.svg';

const LINES = Array.from({ length: 200 }, (_, index) => `const unchanged${index + 1} = ${index + 1};`);
const BEFORE = `${LINES.join('\n')}\n`;
const AFTER = `${LINES.map((line, index) => (index === 99 ? 'const changed100 = 100;' : line)).join('\n')}\n`;

const FILES: readonly SampleReviewFile[] = [
    { path: LOCK, before: 'old lock\n', after: 'new lock\n' },
    { path: ENGINE, before: BEFORE, after: AFTER },
    { path: RENAMED, previousPath: 'src/old.ts', changeType: 'RENAMED', before: 'one\ntwo\n', after: 'one\nTWO\n' },
    { path: VIEWED, before: 'one\ntwo\n', after: 'one\nTWO\n', viewed: 'VIEWED' },
    // Room to scroll a thread's row out of the list.
    {
        path: 'src/zzz.ts',
        before: `${LINES.join('\n')}\n`,
        after: `${LINES.map(line => `${line} // changed`).join('\n')}\n`,
    },
];

const THREADS: readonly SampleReviewThread[] = [
    { id: 'hidden', path: ENGINE, line: 30, comments: ['<p>On a hidden line</p>'] },
    {
        id: 'open',
        path: ENGINE,
        line: 100,
        comments: ['<p>On its line, see <a href="https://example.com/docs">docs</a></p>'],
    },
    {
        id: 'found',
        path: ENGINE,
        isOutdated: true,
        diffHunk: '@@ -98,2 +98,2 @@\n const unchanged98 = 98;\n-const unchanged102 = 102;\n const unchanged102 = 102;',
        comments: ['<p>Outdated and found</p>'],
        pending: true,
    },
    {
        id: 'lost',
        path: ENGINE,
        isOutdated: true,
        diffHunk: '@@ -7,1 +7,2 @@\n one\n+a line nobody has now',
        comments: ['<p>Outdated and lost</p>'],
    },
    {
        id: 'resolved',
        path: ENGINE,
        line: 98,
        isResolved: true,
        comments: ['<p>Settled long ago</p>', '<p>Indeed</p>'],
    },
    {
        id: 'collapsed',
        path: LOCK,
        line: 1,
        diffHunk: '@@ -1,1 +1,1 @@\n-old lock\n+new lock',
        comments: ['<p>In a collapsed file</p>'],
    },
    {
        id: 'moved',
        path: 'src/old.ts',
        line: 2,
        diffHunk: '@@ -1,2 +1,2 @@\n one\n+TWO',
        comments: ['<p>On a file renamed</p>'],
    },
    {
        id: 'viewed',
        path: VIEWED,
        line: 2,
        diffHunk: '@@ -1,2 +1,2 @@\n one\n+TWO',
        comments: ['<p>On a viewed file</p>'],
    },
    {
        id: 'gone',
        path: GONE,
        isOutdated: true,
        diffHunk: '@@ -0,0 +1,2 @@\n+const retry = 1;\n+const again = 2;',
        comments: ['<p>On a file gone</p>'],
    },
];

test('every thread shows where it belongs, hidden lines and collapsed files without expanding anything', async ({
    page,
    github,
}) => {
    const { review, answered } = await openThreads(page, github);

    // In a collapsed file with the old code, the file still unfetched.
    await goToThread(review, 'In a collapsed file');
    await expect(review.diff).toContainText('Line 1, as it was when commented');
    expect(answered.asked.filter(asked => asked.includes(LOCK))).toEqual([]);

    // Its line lost: above the first change, with its code and commit.
    await goToThread(review, 'Outdated and lost');
    await expect(review.diff).toContainText('The code it was written on, at a91d03b');
    await expect(review.thread('Outdated and lost')).toContainText('shown at the top of the file');
    await expect(review.diff).toContainText("that line can't be found once");

    // On a hidden line, with its mark and code, nothing between expanded.
    await goToThread(review, 'On a hidden line');
    await expect(review.diff).toContainText('67 lines further up');
    await expect(review.code('const unchanged30 = 30;').first()).toBeVisible();
    await expect(review.code('const unchanged15 = 15;')).toHaveCount(0);

    // On its line, with GitHub's HTML, its link going outside; the header counts what the file has.
    await goToThread(review, 'On its line');
    await expect(review.thread('On its line').getByRole('link', { name: 'docs' })).toHaveAttribute('target', '_blank');
    await expect(review.topHeader(ENGINE).locator('..')).toContainText(
        '2 open · 1 outdated · 1 outdated, line gone · 1 resolved',
    );

    // Resolved is one line until opened.
    await expect(review.thread('Settled long ago')).toContainText('2 comments');
    await expect(review.thread('Settled long ago')).not.toContainText('Indeed');
    await review.thread('Settled long ago').getByRole('button').first().click();
    await expect(review.thread('Settled long ago')).toContainText('Indeed');

    // Outdated and found says how it was placed.
    await goToThread(review, 'Outdated and found');
    await expect(review.thread('Outdated and found')).toContainText('so the place is approximate');
    await expect(review.thread('Outdated and found')).toContainText('Pending · in your draft');
    await expect(review.thread('On its line')).not.toContainText('Pending · in your draft');

    // A renamed file's thread follows it.
    await goToThread(review, 'On a file renamed');
    await expect(review.fileRow('renamed.ts')).toBeVisible();
    await expect(review.fileRow('old.ts')).toHaveCount(0);

    // A file gone from the diff is an entry of its own.
    await expect(review.fileRow('removed.ts')).toContainText('not in the diff');
    await review.openThreadsMark('removed.ts', 1).click();
    await expect(review.focusedThread).toContainText('On a file gone');
    await expect(review.diff).toContainText("No longer in this pull request's diff");
    await expect(review.diff).toContainText('Line 2, as it was when commented at a91d03b');
});

test('N lands exactly on a thread and stays there as a comment above it grows late', async ({ page, github }) => {
    const release = await holdLateImages(page);
    const threads: SampleReviewThread[] = [
        {
            id: 'above',
            path: ENGINE,
            line: 98,
            comments: [`<p>Grows late</p><p><img src="${LATE_IMAGE}"></p>`],
        },
        { id: 'target', path: ENGINE, line: 102, comments: ['<p>The target</p>'] },
    ];
    const { review } = await openThreads(page, github, threads);

    await page.keyboard.press('n');
    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('The target');
    await expect(page.getByText('Thread 2 of 2, 2 open')).toBeVisible();
    const offset = await review.threadOffset('The target');
    const height = await review.diff.evaluate(diff => diff.clientHeight);
    // The row at a quarter down the screen, the thread's box inside its padding.
    expect(offset).toBeCloseTo(Math.round(height / 4) + 8, 0);

    const before = await review.thread('Grows late').boundingBox();
    release();
    await expect
        .poll(async () => {
            const box = await review.thread('Grows late').boundingBox();
            return box?.height;
        })
        .toBeGreaterThan((before?.height ?? 0) + 100);

    expect(await review.threadOffset('The target')).toBe(offset);
});

test('a growth above the screen moves nothing seen', async ({ page, github }) => {
    const release = await holdLateImages(page);
    const threads: SampleReviewThread[] = [
        { id: 'above', path: ENGINE, line: 98, comments: [`<p>Grows late</p><p><img src="${LATE_IMAGE}"></p>`] },
    ];
    const { review } = await openThreads(page, github, threads);
    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('Grows late');

    // The thread's row wholly above the screen (the box has 8 px of it under it), still drawn.
    const threadBottom = async () => {
        const [thread, diff] = await Promise.all([
            review.thread('Grows late').boundingBox(),
            review.diff.boundingBox(),
        ]);
        return (thread?.y ?? 0) + (thread?.height ?? 0) - (diff?.y ?? 0);
    };
    await review.diff.evaluate((diff, by) => diff.scrollBy(0, by), (await threadBottom()) + 12);
    await expect.poll(threadBottom).toBeLessThanOrEqual(-8);
    const seen = await review.topLine('const');

    release();
    await expect
        .poll(() => review.thread('Grows late').evaluate(box => box.getBoundingClientRect().height))
        .toBeGreaterThan(200);

    const after = await review.topLine('const');
    expect(after.text).toBe(seen.text);
    expect(after.y).toBeCloseTo(seen.y, 0);
});

test('N and ⇧N walk every open thread in diff order, then the resolved ones, opening each, without wrapping; a key on a row scrolled away goes on from what is being read', async ({
    page,
    github,
}) => {
    const { review } = await openThreads(page, github);
    // A file not here yet has its threads under its header, in another order.
    await expect(page.getByText(/Fetching file contents/u)).toHaveCount(0);

    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('In a collapsed file');
    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('Outdated and lost');
    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('On a hidden line');
    await page.keyboard.press('Shift+n');
    await expect(review.focusedThread).toContainText('Outdated and lost');

    await page.keyboard.press('n');
    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('On its line');
    await expect(page.getByText('Thread 4 of 9, 8 open')).toBeVisible();

    // The resolved one lying right before it comes after all the open ones, and opens.
    await goToThread(review, 'On a file gone');
    await expect(page.getByText('Thread 8 of 9, 8 open')).toBeVisible();
    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('Settled long ago');
    await expect(review.focusedThread).toContainText('Indeed');
    await expect(page.getByText('Thread 9 of 9, 8 open')).toBeVisible();

    // The walk ends there.
    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('Settled long ago');
    await page.keyboard.press('Shift+n');
    await expect(review.focusedThread).toContainText('On a file gone');

    await goToThread(review, 'Settled long ago');
    await review.thread('Settled long ago').getByRole('button').first().focus();
    await review.diff.evaluate(diff => diff.scrollTo(0, diff.scrollHeight));
    await expect(review.thread('Settled long ago')).toHaveCount(0);
    await expect(review.diff).toBeFocused();
    await page.keyboard.press('Shift+n');
    await expect(review.focusedThread).toBeVisible();
    await expect(review.focusedThread).not.toContainText('Settled long ago');
});

test('a pull request with only resolved threads still has them to walk, each landing open', async ({
    page,
    github,
}) => {
    const threads: SampleReviewThread[] = [
        { id: 'first', path: ENGINE, line: 98, isResolved: true, comments: ['<p>First settled</p>', '<p>Quite</p>'] },
        { id: 'second', path: ENGINE, line: 102, isResolved: true, comments: ['<p>Second settled</p>'] },
    ];
    const { review } = await openThreads(page, github, threads);

    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('First settled');
    await expect(review.focusedThread).toContainText('Quite');
    await expect(page.getByText('Thread 1 of 2, 0 open')).toBeVisible();
});

test("a gone file can't be selected: ⇧click on its row selects nothing", async ({ page, github }) => {
    const { review } = await openThreads(page, github);

    await review.fileRow('removed.ts').click();
    await review.fileRow('removed.ts').click({ modifiers: ['Shift'] });
    await expect(review.fileRow('removed.ts')).not.toHaveAttribute('aria-pressed', 'true');
});

test('the viewed filter keeps a viewed file with an open thread, as its header with the thread; so does a viewed file with the filter off', async ({
    page,
    github,
}) => {
    const { review } = await openThreads(page, github);

    await expect(review.fileRow('viewed.ts')).toBeVisible();
    await goToThread(review, 'On a viewed file');

    await review.hideViewedButton.click();
    await expect(review.fileRow('viewed.ts')).toBeVisible();
    await expect(review.thread('On a viewed file')).toBeVisible();
    await expect(review.openThreadsMark('viewed.ts', 1)).toBeVisible();
});

test('"Comments in collapsed files" hides them and is remembered; Expand to here brings the context out, the thread staying put', async ({
    page,
    github,
}) => {
    const { review } = await openThreads(page, github);
    await expect(review.thread('In a collapsed file')).toBeVisible();

    await review.viewOptionsButton.click();
    await page.getByRole('switch', { name: 'Comments in collapsed files' }).click();
    await page.keyboard.press('Escape');
    await expect(review.thread('In a collapsed file')).toHaveCount(0);
    await expect(review.openThreadsMark('bun.lock', 1)).toBeVisible();

    await page.reload();
    await expect(review.fileRow('engine.ts')).toBeVisible();
    await expect(review.thread('In a collapsed file')).toHaveCount(0);

    await goToThread(review, 'On a hidden line');
    const offset = await review.threadOffset('On a hidden line');
    await review.diff.getByRole('button', { name: 'Expand to here' }).first().click();
    await expect(review.diff.getByText(/further/u)).toHaveCount(0);
    await expect.poll(() => review.threadOffset('On a hidden line')).toBeCloseTo(offset, 0);
});

test('Show all over a thread on a hidden line holds the thread where it is, as it lands on its line', async ({
    page,
    github,
}) => {
    const { review } = await openThreads(page, github);
    await goToThread(review, 'On a hidden line');
    // Read from above the gap, which is what would stay put with nothing held.
    await review.diff.evaluate(diff => diff.scrollBy(0, -200));
    const offset = await review.threadOffset('On a hidden line');

    await review.gapButton('Show all').first().click();

    await expect(review.diff.getByText('67 lines further up')).toHaveCount(0);
    await expect.poll(() => review.threadOffset('On a hidden line')).toBeCloseTo(offset, 0);
});

/** Presses N until the thread is the focused one. */
async function goToThread(review: ReviewScreenHarness, text: string) {
    await expect
        .poll(
            async () => {
                await review.page.keyboard.press('n');
                return (await review.focusedThread.textContent())?.includes(text) === true;
            },
            { intervals: [50] },
        )
        .toBe(true);
}

async function openThreads(
    page: Page,
    github: Parameters<typeof openMyWork>[1],
    threads: readonly SampleReviewThread[] = THREADS,
): Promise<{ review: ReviewScreenHarness; answered: AnsweredReview }> {
    await openMyWork(page, github, createSampleMyWork().world);
    const answered = answerReview(github, { repository: 'acme/web', number: 15, files: FILES, threads });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.fileRow('engine.ts')).toBeVisible();
    await expect(review.fileHeader(ENGINE)).toBeAttached();
    return { review, answered };
}

/** The late image answers once the returned function is called, 300 px tall. */
async function holdLateImages(page: Page) {
    let answer: () => void = () => {};
    const released = new Promise<void>(resolve => {
        answer = resolve;
    });
    await page.route(LATE_IMAGE, async route => {
        await released;
        await route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300"/></svg>',
        });
    });
    return () => answer();
}
