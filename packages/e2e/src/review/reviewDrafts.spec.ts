import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork } from '../tracking/sampleTrackedWork.js';

import { answerReview } from './answerReview.js';

const DRAFTED = 'Retry polls on network errors';
const OLDER_DRAFTED = 'Cache search results';
const CLEAN = 'Move the sidebar state to the store';
const FIRST = 'Split the rate limiter in two';
const SECOND = 'Move the limits to the config';
const REVIEW_ADDRESS = '/acme/web/pull/3/files';

/** The viewer's pull requests, none with a draft. */
function createWorld() {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    const drafted = world.pullRequest({
        repository: 'acme/web',
        number: 3,
        title: DRAFTED,
        foundBy: ['authored'],
        minutesAgo: 5,
    });
    const older = world.pullRequest({
        repository: 'acme/web',
        number: 2,
        title: OLDER_DRAFTED,
        foundBy: ['authored'],
        minutesAgo: 10,
    });
    world.pullRequest({ repository: 'acme/web', number: 1, title: CLEAN, foundBy: ['authored'], minutesAgo: 20 });
    return { world, drafted, older };
}

function answerFiles(github: GitHubMock, repository: string, number: number) {
    answerReview(github, {
        repository,
        number,
        files: [{ path: 'src/a.ts', before: 'export const a = 1;\n', after: 'export const a = 2;\n' }],
    });
}

/** The next read of the statuses, in time as `page.clock` runs it (a minute with the tab in sight). */
async function nextStatusRead(page: Page) {
    await page.clock.fastForward('01:00');
}

test('a draft begun on github.com shows on the next read of the statuses, in its row and in the sidebar, and both go with it', async ({
    page,
    github,
}) => {
    await page.clock.install();
    const { world, drafted } = createWorld();
    const { shell, myWork } = await openMyWork(page, github, world);
    await expect(myWork.row(DRAFTED)).toBeVisible();
    await expect(shell.draftReviews).toBeHidden();

    world.setPendingReview(drafted, { comments: 3, minutesAgo: 120 });
    await nextStatusRead(page);

    await expect(myWork.row(DRAFTED)).toContainText('Your draft review · 3 comments unsent');
    await expect(myWork.row(CLEAN)).not.toContainText('Your draft review');
    await expect(shell.draftReviews).toContainText('1');

    await shell.draftReviews.click();
    await expect(page).toHaveURL('/pulls/drafts');
    await expect(page.getByRole('listitem').filter({ hasText: DRAFTED })).toBeVisible();

    world.setPendingReview(drafted, null);
    await nextStatusRead(page);

    await expect(shell.draftReviews).toBeHidden();
    await expect(page.getByText('No draft reviews')).toBeVisible();
});

test('a pull request only a tracked repository holds: a draft begun on github.com shows within five minutes, and goes with the next read of the statuses', async ({
    page,
    github,
}) => {
    await page.clock.install();
    const { world, fixPullRequest } = createSampleTrackedWork();
    const shell = await openTrackedWork(page, github, world);
    await expect(shell.statusBar).toContainText('Up to date');
    await expect(shell.draftReviews).toBeHidden();

    world.setPendingReview(fixPullRequest, { comments: 2, minutesAgo: 1 });
    await page.clock.fastForward('05:01');
    await expect(shell.draftReviews).toContainText('1');

    world.setPendingReview(fixPullRequest, null);
    await nextStatusRead(page);
    await expect(shell.draftReviews).toBeHidden();
});

test('the window regaining focus in a tab that does not sync has the syncing tab look for drafts, a minute after its last look', async ({
    context,
    page,
    github,
}) => {
    await context.clock.install();
    const { world, fixPullRequest } = createSampleTrackedWork();
    const shell = await openTrackedWork(page, github, world);
    await expect(shell.statusBar).toContainText('Up to date');
    const other = await context.newPage();
    await other.goto('/');
    const otherShell = new AppShellHarness(other);
    await expect(otherShell.statusBar).toContainText('Up to date');

    world.setPendingReview(fixPullRequest, { comments: 2, minutesAgo: 1 });
    await context.clock.fastForward('01:01');
    await other.evaluate(() => window.dispatchEvent(new Event('focus')));

    await expect(otherShell.draftReviews).toContainText('1');
    expect(github.apiRequestsOf(page)).toContain('PullRequestPendingReviews');
    expect(github.apiRequestsOf(other)).not.toContain('PullRequestPendingReviews');
});

test('⇧S on the list of drafts opens the selected review at its submit dialog', async ({ page, github }) => {
    const { world, drafted, older } = createWorld();
    world.setPendingReview(drafted, { comments: 2, minutesAgo: 30 });
    world.setPendingReview(older, { comments: 1, minutesAgo: 90 });
    const { myWork } = await openMyWork(page, github, world);
    await expect(myWork.row(DRAFTED)).toBeVisible();
    answerReview(github, {
        repository: 'acme/web',
        number: 3,
        id: drafted,
        files: [{ path: 'a.ts', before: 'one\n', after: 'two\n' }],
    });

    await page.goto('/pulls/drafts');
    await expect(page.getByRole('listitem').filter({ hasText: DRAFTED })).toBeVisible();
    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await page.keyboard.press('Shift+S');

    await expect(new ReviewScreenHarness(page).submitDialog).toBeVisible();
    await expect(page).toHaveURL(new RegExp(REVIEW_ADDRESS));
});

test('the list of drafts: the one waiting longest first, J and K move, Enter opens its review, walked from there as any list', async ({
    page,
    github,
}) => {
    const { world, drafted, older } = createWorld();
    world.setPendingReview(drafted, { comments: 1, minutesAgo: 30 });
    world.setPendingReview(older, { comments: 2, minutesAgo: 3 * 24 * 60 });
    const { shell } = await openMyWork(page, github, world);
    answerFiles(github, 'acme/web', 3);
    answerFiles(github, 'acme/web', 2);
    await expect(shell.draftReviews).toContainText('2');

    // By its address: the keys stay with what has the focus, and a link clicked in the sidebar keeps it.
    await page.goto('/pulls/drafts');

    const rows = page.getByRole('region', { name: 'Draft reviews' }).getByRole('listitem');
    await expect(rows).toHaveText([new RegExp(OLDER_DRAFTED), new RegExp(DRAFTED)]);
    await expect(rows.first()).toContainText('Your draft review · 2 comments unsent');
    await expect(rows.first()).toContainText('draft 3d');
    await expect(rows.last()).toContainText('Your draft review · 1 comment unsent');
    await expect(rows.last()).toContainText('draft 30m');

    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(REVIEW_ADDRESS);
    const review = new ReviewScreenHarness(page);
    await expect(review.title).toHaveText(DRAFTED);
    await page.keyboard.press('k');
    await expect(review.title).toHaveText(OLDER_DRAFTED);

    await page.goBack();
    await expect(page).toHaveURL('/pulls/drafts');
});

test('on the review, the toolbar at the foot of the diff says how many wait and offers the ways out; no other pull request has it', async ({
    page,
    github,
}) => {
    const { world, drafted } = createWorld();
    world.setPendingReview(drafted, { comments: 3, minutesAgo: 60 });
    const { shell } = await openMyWork(page, github, world);
    answerFiles(github, 'acme/web', 3);
    answerFiles(github, 'acme/web', 1);
    await expect(shell.draftReviews).toContainText('1');

    await page.goto(REVIEW_ADDRESS);
    const review = new ReviewScreenHarness(page);

    await expect(review.pendingToolbar).toContainText('3 pending comments');
    await expect(review.pendingToolbar).toContainText("Others can't see them until you submit.");
    await expect(review.discardReviewButton).toBeVisible();
    await expect(review.submitReviewButton).toBeVisible();
    const toolbarBox = await review.pendingToolbar.boundingBox();
    const diffBox = await review.diff.boundingBox();
    expect((diffBox?.y ?? 0) + (diffBox?.height ?? 0)).toBeCloseTo(toolbarBox?.y ?? 0, 0);

    await page.goto('/acme/web/pull/1/files');
    await expect(review.title).toHaveText(CLEAN);
    await expect(review.pendingToolbar).toBeHidden();
});

test('a pull request outside the local copy: back from finishing the draft on GitHub, the toolbar goes', async ({
    page,
    github,
}) => {
    const { world } = createWorld();
    const outside = world.pullRequest({ repository: 'acme/web', number: 9, title: 'Not my work', minutesAgo: 30 });
    world.setPendingReview(outside, { comments: 2, minutesAgo: 60 });
    await openMyWork(page, github, world);
    answerFiles(github, 'acme/web', 9);

    await page.goto('/acme/web/pull/9/files');
    const review = new ReviewScreenHarness(page);
    await expect(review.pendingToolbar).toContainText('2 pending comments');

    world.setPendingReview(outside, null);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    await expect(review.pendingToolbar).toBeHidden();
});

test('a pull request outside the local copy: a draft begun on GitHub shows on coming back, a minute after the last read', async ({
    page,
    github,
}) => {
    // Time runs as usual, and the minute can be skipped.
    await page.clock.install();
    const { world } = createWorld();
    const outside = world.pullRequest({ repository: 'acme/web', number: 9, title: 'Not my work', minutesAgo: 30 });
    await openMyWork(page, github, world);
    answerFiles(github, 'acme/web', 9);

    await page.goto('/acme/web/pull/9/files');
    const review = new ReviewScreenHarness(page);
    await expect(review.title).toHaveText('Not my work');
    await expect(review.pendingToolbar).toBeHidden();

    world.setPendingReview(outside, { comments: 2, minutesAgo: 1 });
    await page.clock.fastForward('01:01');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    await expect(review.pendingToolbar).toContainText('2 pending comments');
    // Outside a stack, no stack section.
    await expect(review.stackRows).toHaveCount(0);
});

test('in a stack, the row of the pull request with the draft and its square carry the mark, the others not', async ({
    page,
    github,
}) => {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    const [first] = world.stack({
        repository: 'acme/api',
        number: 7,
        pullRequests: [
            { number: 201, title: FIRST, foundBy: ['authored'], minutesAgo: 20 },
            { number: 202, title: SECOND, foundBy: ['authored'], minutesAgo: 15 },
        ],
    });
    world.setPendingReview(first!, { comments: 2, minutesAgo: 60 });
    const files = Array.from({ length: 100 }, (_, index) => ({
        path: `src/file${index}.ts`,
        before: `export const value = ${index};\n`,
        after: `export const value = ${index + 1};\n`,
    }));
    const { myWork, shell } = await openMyWork(page, github, world);
    answerReview(github, { repository: 'acme/api', number: 202, files });
    await expect(shell.draftReviews).toContainText('1');
    // The collapsed entry says so, for its pull requests are out of sight.
    await expect(myWork.row(FIRST)).toContainText('Your draft review · 2 comments unsent');

    await page.goto('/acme/api/pull/202/files');
    const review = new ReviewScreenHarness(page);

    await expect(review.stackRow(FIRST)).toContainText('Your draft review');
    await expect(review.stackRow(SECOND)).not.toContainText('Your draft review');
    await expect(review.pendingToolbar).toBeHidden();

    await review.leftColumn.evaluate(column => column.scrollTo(0, 400));
    await expect(review.stackStrip.getByRole('link', { name: 'your draft review' })).toHaveCount(1);
});
