import { expect, test } from '../fixtures.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';

import { answerReview } from './answerReview.js';

const FIRST = 'Split the rate limiter in two';
const SECOND = 'Move the limits to the config';
const THIRD = 'Document the new limits';
const NEXT_STACK_FIRST = 'Read the stack of each pull request';
const NEXT_STACK_SECOND = 'Fold a stack into one entry';

/** My work's two stacks, monalisa's first in the list, then the viewer's; and an issue assigned to the viewer at the end of it. */
function createWorld() {
    const viewer = SAMPLE_VIEWER.viewer.login;
    const world = new GitHubWorld(viewer);
    world.stack({
        repository: 'acme/api',
        number: 7,
        pullRequests: [
            { number: 201, title: FIRST, author: 'monalisa', minutesAgo: 20 },
            {
                number: 202,
                title: SECOND,
                author: 'monalisa',
                foundBy: ['reviewRequested'],
                reviewRequests: [viewer],
                minutesAgo: 15,
            },
            { number: 203, title: THIRD, author: 'monalisa', minutesAgo: 10 },
        ],
    });
    world.stack({
        repository: 'acme/web',
        number: 1,
        pullRequests: [
            {
                number: 101,
                title: NEXT_STACK_FIRST,
                foundBy: ['authored'],
                minutesAgo: 50,
            },
            { number: 102, title: NEXT_STACK_SECOND, foundBy: ['authored'], minutesAgo: 40 },
        ],
    });
    world.issue({
        repository: 'acme/web',
        number: 50,
        title: 'An issue to step over',
        foundBy: ['assigned'],
        minutesAgo: 5,
    });
    return world;
}

/** A hundred files in each pull request, for its review's left column to have room to scroll. */
function answerFiles(github: GitHubMock) {
    const files = Array.from({ length: 100 }, (_, index) => ({
        path: `src/file${index}.ts`,
        before: `export const value = ${index};\n`,
        after: `export const value = ${index + 1};\n`,
    }));
    for (const [repository, number] of [
        ['acme/api', 201],
        ['acme/api', 202],
        ['acme/api', 203],
        ['acme/web', 101],
        ['acme/web', 102],
    ] as const) {
        answerReview(github, { repository, number, files });
    }
}

/** My work's first stack, read from the list: `D` on its first pull request, what Enter on the collapsed entry opens. */
async function openFirstOfCollapsedStack(page: Parameters<typeof openMyWork>[0], github: GitHubMock) {
    const { myWork } = await openMyWork(page, github, createWorld());
    answerFiles(github);
    await expect(myWork.row(FIRST)).toBeVisible();
    await page.keyboard.press('j');
    await page.keyboard.press('Enter');
    const item = new ItemViewHarness(page);
    await expect(item.title).toHaveText(FIRST);
    await page.keyboard.press('d');
    const review = new ReviewScreenHarness(page);
    await expect(page).toHaveURL('/acme/api/pull/201/files');
    await expect(review.fileRow('file0.ts')).toBeVisible();
    return { review, item };
}

/** My work's first stack's second pull request, its entry expanded in the list, and its review entered with `D`. */
async function openReviewFromList(page: Parameters<typeof openMyWork>[0], github: GitHubMock) {
    const { myWork } = await openMyWork(page, github, createWorld());
    answerFiles(github);
    await expect(myWork.row(FIRST)).toBeVisible();
    await page.keyboard.press('j');
    await page.keyboard.press('ArrowRight');
    await expect(myWork.row(SECOND)).toBeVisible();
    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await expect(myWork.selectedRow).toContainText(SECOND);
    await page.keyboard.press('Enter');
    const item = new ItemViewHarness(page);
    await expect(item.title).toHaveText(SECOND);
    await page.keyboard.press('d');
    const review = new ReviewScreenHarness(page);
    await expect(page).toHaveURL('/acme/api/pull/202/files');
    await expect(review.fileRow('file0.ts')).toBeVisible();
    return { review, item };
}

test('J walks the stack and on into the next one, K walks back, Back returns to where the review was entered, and [ ] stay files', async ({
    page,
    github,
}) => {
    const { review, item } = await openReviewFromList(page, github);
    await expect(review.position).toHaveText('2 / 3');
    await expect(review.stackPlace).toHaveText('2 of 3');
    await expect(review.currentStackRow).toContainText(SECOND);

    await page.keyboard.press(']');
    await expect(review.currentFileRow).toContainText('file1.ts');
    await expect(page).toHaveURL('/acme/api/pull/202/files');

    await page.keyboard.press('j');
    await expect(page).toHaveURL('/acme/api/pull/203/files');
    await expect(review.title).toHaveText(THIRD);
    await expect(review.position).toHaveText('3 / 3');
    await expect(review.currentStackRow).toContainText(THIRD);
    await expect(review.fileRow('file0.ts')).toBeVisible();

    // The end of a stack is no special case.
    await page.keyboard.press('j');
    await expect(page).toHaveURL('/acme/web/pull/101/files');
    await expect(review.title).toHaveText(NEXT_STACK_FIRST);
    await expect(review.stackPlace).toHaveText('1 of 2');

    // The list's issue after it is stepped over: walking stays in the review.
    await page.keyboard.press('j');
    await expect(page).toHaveURL('/acme/web/pull/102/files');
    await expect(review.position).toHaveText('2 / 2');
    await expect(review.nextPullRequestButton).toBeDisabled();

    await page.keyboard.press('k');
    await expect(page).toHaveURL('/acme/web/pull/101/files');
    await page.keyboard.press('k');
    await expect(page).toHaveURL('/acme/api/pull/203/files');
    await expect(review.title).toHaveText(THIRD);

    await review.backButton.click();
    await expect(item.title).toHaveText(SECOND);
    await expect(page).not.toHaveURL(/\/files$/);
});

test('from a collapsed entry J goes through the stack and on into the next entry at its end, K back through it and on to the entry before', async ({
    page,
    github,
}) => {
    const { review } = await openFirstOfCollapsedStack(page, github);
    await expect(review.position).toHaveText('1 / 3');

    await page.keyboard.press('j');
    await expect(page).toHaveURL('/acme/api/pull/202/files');
    await expect(review.position).toHaveText('2 / 3');
    await page.keyboard.press('j');
    await expect(page).toHaveURL('/acme/api/pull/203/files');
    await expect(review.position).toHaveText('3 / 3');

    await page.keyboard.press('j');
    await expect(page).toHaveURL('/acme/web/pull/101/files');
    await expect(review.position).toHaveText('1 / 2');
    await page.keyboard.press('j');
    await expect(page).toHaveURL('/acme/web/pull/102/files');

    await page.keyboard.press('k');
    await expect(page).toHaveURL('/acme/web/pull/101/files');
    // Back over the end of a stack it is one step again: the entry before, on what Enter opens.
    await page.keyboard.press('k');
    await expect(page).toHaveURL('/acme/api/pull/201/files');
    await expect(review.position).toHaveText('1 / 3');
});

test('a stack row is a link to its review, replacing the address; the command menu goes to any of them', async ({
    page,
    github,
}) => {
    const { review, item } = await openReviewFromList(page, github);

    await expect(review.stackRow(THIRD)).toHaveAttribute('href', '/acme/api/pull/203/files');
    await review.stackRow(THIRD).click();
    await expect(page).toHaveURL('/acme/api/pull/203/files');
    await expect(review.title).toHaveText(THIRD);
    await expect(review.currentStackRow).toContainText(THIRD);

    await new CommandMenuHarness(page).run(`Go to #201`);
    await expect(page).toHaveURL('/acme/api/pull/201/files');

    await review.backButton.click();
    await expect(item.title).toHaveText(SECOND);
});

test('scrolled, the bar stays pinned with the file list head under it, one click per pull request; the diff keeps its height and ⌘B hides it all', async ({
    page,
    github,
}) => {
    const { review } = await openReviewFromList(page, github);
    const diffHeight = (await review.diff.boundingBox())?.height;
    await expect(review.stackStrip).toBeHidden();
    await expect(review.stackRows).toHaveCount(3);

    const column = review.leftColumn;
    const top = (await column.boundingBox())?.y ?? 0;
    await column.evaluate(element => element.scrollTo(0, 400));

    await expect(review.stackStrip).toBeVisible();
    await expect(review.stackSquare(THIRD)).toBeInViewport();
    expect((await review.stackStrip.boundingBox())?.y).toBe(top);
    // The bar's 32 px, then the head with its filter.
    await expect.poll(async () => ((await review.filterField.boundingBox())?.y ?? 0) - top).toBeGreaterThanOrEqual(32);
    await expect(review.stackRow(THIRD)).not.toBeInViewport();
    expect((await review.diff.boundingBox())?.height).toBe(diffHeight);

    await review.stackSquare(THIRD).click();
    await expect(page).toHaveURL('/acme/api/pull/203/files');
    await expect(review.title).toHaveText(THIRD);
    // Another pull request starts at the top, its rows back in view.
    await expect(review.stackRow(THIRD)).toBeInViewport();

    await page.keyboard.press('ControlOrMeta+b');
    await expect(review.fileList).toBeHidden();
    await expect(review.stackRows).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+b');
    await expect(review.stackRows).toHaveCount(3);
});

test('a stack known only once the files are on screen leaves them where they are, the bar showing and its rows one scroll up', async ({
    page,
    github,
}) => {
    let release = () => {};
    const released = new Promise<void>(resolve => {
        release = resolve;
    });
    await page.route('**/graphql', async route => {
        if (route.request().postData()?.includes('PullRequestStacks')) {
            await released;
        }

        await route.fallback();
    });
    const { myWork } = await openMyWork(page, github, createWorld());
    answerFiles(github);
    await expect(myWork.row(SECOND)).toBeVisible();

    await page.goto('/acme/api/pull/202/files');
    const review = new ReviewScreenHarness(page);
    await expect(review.title).toHaveText(SECOND);
    await expect(review.fileRow('file3.ts')).toBeVisible();
    await expect(review.stackRows).toHaveCount(0);
    const before = await review.fileRow('file3.ts').boundingBox();

    release();

    await expect(review.stackStrip).toBeVisible();
    expect(await review.fileRow('file3.ts').boundingBox()).toEqual(before);
    await review.leftColumn.evaluate(column => column.scrollTo(0, 0));
    await expect(review.stackRow(THIRD)).toBeInViewport();
    await expect(review.stackStrip).toBeHidden();
});

test('opened by its address, a pull request of a stack has no list to walk, J does nothing, and its stack still goes to the others', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createWorld());
    answerFiles(github);
    await expect(myWork.row(FIRST)).toBeVisible();

    await page.goto('/acme/api/pull/202/files');
    const review = new ReviewScreenHarness(page);
    await expect(review.title).toHaveText(SECOND);
    await expect(review.fileRow('file0.ts')).toBeVisible();
    await expect(review.position).toBeHidden();

    await page.keyboard.press('j');
    await expect(page).toHaveURL('/acme/api/pull/202/files');

    await expect(review.stackRows).toHaveCount(3);
    await review.stackRow(THIRD).click();
    await expect(page).toHaveURL('/acme/api/pull/203/files');
});
