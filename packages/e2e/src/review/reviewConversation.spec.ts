import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

import { answerReview } from './answerReview.js';
import type { SampleReviewFile, SampleReviewThread } from './answerReview.js';

const REVIEW_ADDRESS = '/acme/web/pull/15/files';

const LONG = 'src/long.ts';
const OTHER = 'src/other.ts';

// Lines long enough to wrap at one width and not at another: the heights above what is read change with the columns.
const LINES = Array.from({ length: 150 }, (_, index) => `const line${index} = '${'x'.repeat(40 + index * 2)}';`);
const BEFORE = `${LINES.join('\n')}\n`;
const AFTER = `${LINES.map(line => `${line} // changed`).join('\n')}\n`;

const FILES: readonly SampleReviewFile[] = [
    { path: LONG, before: BEFORE, after: AFTER },
    { path: OTHER, before: 'one\ntwo\n', after: 'one\nTWO\n' },
];

const THREADS: readonly SampleReviewThread[] = [
    { id: 'first', path: LONG, line: 40, comments: ['<p>The first thread</p>'], reviewId: 'PRR_changes' },
    { id: 'other', path: OTHER, line: 2, comments: ['<p>The other thread</p>'], reviewId: 'PRR_changes' },
    { id: 'settled', path: LONG, line: 80, isResolved: true, comments: ['<p>Settled</p>'], reviewId: 'PRR_ok' },
];

test('⌥⌘B moves nothing being read, both ways, with both columns on at 1440 px and the lines wrapped anew', async ({
    page,
    github,
}) => {
    const review = await openConversation(page, github);
    await review.diff.evaluate(diff => diff.scrollBy(0, 2000));
    const seen = await settledRowAtTop(review);

    await page.keyboard.press('ControlOrMeta+Alt+b');
    await expect(review.conversation).toBeVisible();
    await expect(review.conversationToggle).toHaveAttribute('aria-pressed', 'true');
    // The lines above wrapped anew, a whole 100 px or more being absorbed above the screen.
    await expect.poll(() => review.diff.evaluate(diff => diff.scrollTop)).toBeGreaterThan(seen.scrollTop + 100);
    expect(await settledRowAtTop(review)).toMatchObject({ text: seen.text, top: seen.top });

    await expect(review.fileList).toBeVisible();
    const diff = await review.diff.boundingBox();
    expect(diff?.width).toBeGreaterThan(700);

    await page.keyboard.press('ControlOrMeta+Alt+b');
    await expect(review.conversation).toBeHidden();
    await expect.poll(() => review.diff.evaluate(element => element.scrollTop)).toBeLessThan(seen.scrollTop + 100);
    expect(await settledRowAtTop(review)).toMatchObject({ text: seen.text, top: seen.top });
});

test('the conversation is remembered over a reload, comes in one time order and says it through the view options too', async ({
    page,
    github,
}) => {
    const review = await openConversation(page, github);
    await expect(review.conversation).toBeHidden();

    await review.viewOptionsButton.click();
    await page.getByRole('switch', { name: 'Conversation' }).click();
    await page.keyboard.press('Escape');
    await expect(review.conversation).toBeVisible();

    await page.reload();
    await expect(review.fileRow('long.ts')).toBeVisible();
    await expect(review.conversation).toBeVisible();

    const entries = review.conversation.getByRole('listitem');
    await expect(entries).toHaveCount(4);
    await expect(entries.nth(0)).toContainText('requested changes');
    await expect(entries.nth(1)).toContainText('An early remark');
    await expect(entries.nth(2)).toContainText('approved');
    await expect(entries.nth(3)).toContainText('The latest remark');
    // The reply, a review with nothing to say, is not among them.
    await expect(review.conversation).not.toContainText('reviewed');

    await review.conversationToggle.click();
    await expect(review.conversation).toBeHidden();
    await page.reload();
    await expect(review.fileRow('long.ts')).toBeVisible();
    await expect(review.conversation).toBeHidden();
});

test('reviews older than the newest 100 come on asking, in their place, and the count is of what is read', async ({
    page,
    github,
}) => {
    const { world, closingPullRequest } = createSampleMyWork();
    world.review(closingPullRequest, {
        id: 'PRR_first',
        author: 'sofiab',
        state: 'CHANGES_REQUESTED',
        bodyHtml: '<p>The very first review.</p>',
        minutesAgo: 500,
    });
    for (let reply = 1; reply <= 100; reply++) {
        world.review(closingPullRequest, {
            id: `PRR_${reply}`,
            author: 'sofiab',
            state: 'APPROVED',
            bodyHtml: `<p>Review ${reply}</p>`,
            minutesAgo: 400 - reply,
        });
    }

    await openMyWork(page, github, world);
    answerReview(github, { repository: 'acme/web', number: 15, files: FILES });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.fileRow('long.ts')).toBeVisible();
    await review.conversationToggle.click();
    await expect(review.conversation).toContainText('Review 100');
    await expect(review.conversation).not.toContainText('The very first review.');
    await expect(review.conversation.getByText('100', { exact: true })).toBeVisible();

    await review.conversation.getByRole('button', { name: 'Show older reviews' }).click();

    await expect(review.conversation.getByRole('listitem').first()).toContainText('The very first review.');
    await expect(review.conversation.getByRole('button', { name: 'Show older reviews' })).toHaveCount(0);
    await expect(review.conversation.getByText('101', { exact: true })).toBeVisible();
});

test("a summary's threads land exactly on the first of them, as N does; a resolved one is opened; a filter gives way", async ({
    page,
    github,
}) => {
    const review = await openConversation(page, github);
    await page.keyboard.press('ControlOrMeta+Alt+b');
    await expect(review.conversation).toBeVisible();

    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('The first thread');
    const byKey = await review.threadOffset('The first thread');
    await review.diff.evaluate(diff => diff.scrollTo(0, diff.scrollHeight));

    await review.conversation.getByRole('button', { name: '2 threads in files' }).click();
    await expect(review.focusedThread).toContainText('The first thread');
    await expect.poll(() => review.threadOffset('The first thread')).toBe(byKey);
    await expect(review.diff).toBeFocused();

    await review.conversation.getByRole('button', { name: '1 thread in files, resolved' }).click();
    await expect(review.focusedThread).toContainText('Settled');
    await expect(page.getByText('Thread 3 of 3')).toBeVisible();

    await review.filterField.fill('other');
    await expect(review.fileRow('long.ts')).toBeHidden();
    await review.conversation.getByRole('button', { name: '1 thread in files, resolved' }).click();
    await expect(review.focusedThread).toContainText('Settled');
    await expect(review.fileRow('long.ts')).toBeVisible();
});

test('it scrolls on its own, opening at the newest; the diff moves it not, nor it the diff', async ({
    page,
    github,
}) => {
    const review = await openConversation(page, github, 40);
    await review.conversationToggle.click();
    const scroller = review.conversation.locator('[tabindex="0"]');
    await expect(scroller.getByText('Remark 40')).toBeInViewport();

    const position = () => scroller.evaluate(element => element.scrollTop);
    const at = await position();
    expect(at).toBeGreaterThan(0);
    await review.diff.evaluate(diff => diff.scrollBy(0, 1500));
    expect(await position()).toBe(at);

    const seen = await settledRowAtTop(review);
    await scroller.evaluate(element => element.scrollTo(0, 0));
    expect(await settledRowAtTop(review)).toEqual(seen);
});

test('its Close and the empty diff’s button are the same switch', async ({ page, github }) => {
    await openMyWork(page, github, createSampleMyWork().world);
    answerReview(github, { repository: 'acme/web', number: 15, files: [] });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);

    await review.diff.page().getByRole('button', { name: 'Conversation' }).last().click();
    await expect(review.conversation).toBeVisible();
    await review.conversation.getByRole('button', { name: 'Close the conversation' }).click();
    await expect(review.conversation).toBeHidden();
});

test('the user’s own comment is edited in place and deleted from the conversation, as on the pull request', async ({
    page,
    github,
}) => {
    const { world, closingPullRequest } = createSampleMyWork();
    world.comment(closingPullRequest, { author: world.viewer, body: 'Mine to change', minutesAgo: 10 });
    await openMyWork(page, github, world);
    answerReview(github, { repository: 'acme/web', number: 15, files: FILES });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.fileRow('long.ts')).toBeVisible();
    await review.conversationToggle.click();

    const mine = review.conversation.getByRole('listitem').filter({ hasText: 'Mine to change' });
    await mine.getByRole('button', { name: 'Comment actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const editor = review.conversation.getByRole('textbox', { name: 'Edit comment' });
    await expect(editor).toHaveValue('Mine to change');
    await editor.fill('Mine, changed');
    await editor.press('ControlOrMeta+Enter');

    const changed = review.conversation.getByRole('listitem').filter({ hasText: 'Mine, changed' });
    await expect(changed).toContainText('· edited');
    await expect.poll(() => world.stateOf(closingPullRequest).comments).toContain('Mine, changed');

    await changed.getByRole('button', { name: 'Comment actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete…' }).click();
    await page.getByRole('button', { name: 'Delete comment' }).click();
    await expect(changed).toHaveCount(0);
    await expect.poll(() => world.stateOf(closingPullRequest).comments).not.toContain('Mine, changed');
});

test('the conversation’s edge resizes it, from 340 px up, and its width is kept over a reload', async ({
    page,
    github,
}) => {
    const review = await openConversation(page, github);
    await review.conversationToggle.click();
    // The column's width less its 1 px line, which the split draws.
    const width = async () => Math.round((await review.conversation.boundingBox())?.width ?? 0) + 1;
    expect(await width()).toBe(340);

    // The edge is on the conversation's left: the arrow keys widen it leftwards, and never take it under its least.
    await review.conversationEdge.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(width).toBe(340);
    for (let step = 0; step < 4; step++) {
        await page.keyboard.press('ArrowLeft');
    }

    await expect.poll(width).toBeGreaterThan(340);
    const wider = await width();
    await page.reload();
    await expect(review.fileRow('long.ts')).toBeVisible();
    await expect.poll(width).toBe(wider);
});

async function openConversation(page: Page, github: Parameters<typeof openMyWork>[1], remarks = 0) {
    const { world, closingPullRequest } = createSampleMyWork();
    world.review(closingPullRequest, {
        id: 'PRR_changes',
        author: 'sofiab',
        state: 'CHANGES_REQUESTED',
        bodyHtml: '<p>Two things in the queue.</p>',
        minutesAgo: 120,
    });
    world.comment(closingPullRequest, { author: 'dkim', body: 'An early remark', minutesAgo: 100 });
    world.review(closingPullRequest, {
        id: 'PRR_ok',
        author: 'dkim',
        state: 'APPROVED',
        bodyHtml: '<p>Fine by me.</p>',
        minutesAgo: 60,
    });
    world.review(closingPullRequest, { id: 'PRR_reply', author: 'sofiab', state: 'COMMENTED', minutesAgo: 50 });
    world.comment(closingPullRequest, { author: 'sofiab', body: 'The latest remark', minutesAgo: 40 });
    for (let remark = 1; remark <= remarks; remark++) {
        world.comment(closingPullRequest, { author: 'sofiab', body: `Remark ${remark}`, minutesAgo: 30 - remark / 10 });
    }

    await openMyWork(page, github, world);
    answerReview(github, { repository: 'acme/web', number: 15, files: FILES, threads: THREADS });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.fileRow('long.ts')).toBeVisible();
    await expect(review.fileHeader(LONG)).toBeAttached();
    await expect(review.code('const line0').first()).toBeAttached();
    return review;
}

/**
 * The row of code the top of the diff cuts or touches, which is what the list holds in place (D7), and how far it is from
 * there, once the rows a scroll drew have been measured.
 */
async function settledRowAtTop(review: ReviewScreenHarness) {
    const read = () =>
        review.diff.evaluate(diff => {
            const { top } = diff.getBoundingClientRect();
            for (const code of diff.querySelectorAll('code')) {
                const box = code.getBoundingClientRect();
                if (box.bottom > top) {
                    return { text: code.textContent, top: box.top - top, scrollTop: diff.scrollTop };
                }
            }

            return null;
        });
    const frame = () => review.page.evaluate(() => new Promise(requestAnimationFrame));
    let settled = await read();
    await expect
        .poll(async () => {
            await frame();
            const next = await read();
            const same = next !== null && JSON.stringify(next) === JSON.stringify(settled);
            settled = next;
            return same;
        })
        .toBe(true);
    if (!settled) {
        throw new Error('No line of code is on screen');
    }

    return settled;
}
