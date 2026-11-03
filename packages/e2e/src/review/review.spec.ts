import { expect, test } from '../fixtures.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

import { answerReview } from './answerReview.js';
import type { AnsweredReview, SampleReviewFile } from './answerReview.js';

const REVIEW_ADDRESS = '/acme/web/pull/15/files';
const PULL_REQUEST_ADDRESS = '/acme/web/pull/15';
const PULL_REQUEST = 'Redirect once after sign-in';
const ISSUE_ADDRESS = '/acme/web/issues/12';

const ENGINE = 'src/sync/engine.ts';
const CLIENT = 'src/api/client.ts';
const README = 'README.md';
const LOGO = 'public/logo.png';
const SCHEMA = 'src/api/schema.json';

const UNCHANGED = Array.from({ length: 60 }, (_, index) => `const unchanged${index} = ${index};`).join('\n');
const FILES: readonly SampleReviewFile[] = [
    { path: CLIENT, before: `export const client = 1;\n`, after: `export const client = 2;\n` },
    {
        path: ENGINE,
        before: `${UNCHANGED}\nconst MAX_BATCH = 20;\nif (ready) {\nflush();\n}\n`,
        after: `${UNCHANGED}\nconst MAX_BATCH = 50;\nif (ready) {\n    flush();\n}\n`,
    },
    { path: README, before: `# Web\n`, after: `# Web\n\nThe web app.\n`, viewed: 'VIEWED' },
    { path: LOGO, before: 'binary', after: 'binary!', binary: true },
    { path: SCHEMA, before: '{}\n', after: '{ }\n', byteSize: 4_000_000 },
];

test('D opens the review of the pull request open, at its GitHub address, in the place the design gives it; ] moves on, a reload stays and Back returns', async ({
    page,
    github,
}) => {
    await openPullRequest(page, github);
    const review = new ReviewScreenHarness(page);

    await page.keyboard.press('d');

    await expect(page).toHaveURL(REVIEW_ADDRESS);
    await expect(review.title).toHaveText(PULL_REQUEST);
    await expect(review.fileRow('client.ts')).toBeVisible();
    await expect(review.code('export const client = 2;')).toBeVisible();
    await expect(review.currentFileRow).toContainText(README);

    await page.keyboard.press(']');
    await expect(review.currentFileRow).toContainText('logo.png');
    await expect.poll(() => review.headerOffset(LOGO)).toBe(0);

    await page.keyboard.press('[');
    await expect(review.currentFileRow).toContainText(README);

    await page.reload();
    await expect(review.title).toHaveText(PULL_REQUEST);
    await expect(page).toHaveURL(REVIEW_ADDRESS);
    await expect(review.code('export const client = 2;')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(PULL_REQUEST_ADDRESS);
    await expect(new ItemViewHarness(page).title).toHaveText(PULL_REQUEST);
});

test("Review files in the merge section opens the review; /changes opens it too, and an issue's number settles on the issue", async ({
    page,
    github,
}) => {
    const item = await openPullRequest(page, github);
    const review = new ReviewScreenHarness(page);

    await item.root.getByRole('link', { name: 'Review files' }).click();
    await expect(page).toHaveURL(REVIEW_ADDRESS);
    await expect(review.fileRow('engine.ts')).toBeVisible();

    await page.goto('/acme/web/pull/15/changes');
    await expect(review.fileRow('engine.ts')).toBeVisible();

    await page.goto(`${ISSUE_ADDRESS}/files`);
    await expect(page).toHaveURL(ISSUE_ADDRESS);
    await expect(item.title).toBeVisible();
});

test("D does nothing on an issue, nor typed in the pull request's comment box", async ({ page, github }) => {
    const item = await openPullRequest(page, github);

    await item.commentBox.click();
    await page.keyboard.type('d');
    await expect(item.commentBox).toHaveValue('d');
    await expect(page).toHaveURL(PULL_REQUEST_ADDRESS);

    await page.goto(ISSUE_ADDRESS);
    await expect(item.title).toBeVisible();
    await page.keyboard.press('d');
    await page.waitForTimeout(100);
    await expect(page).toHaveURL(ISSUE_ADDRESS);
});

test('the review forces the rail without touching the choice kept: leaving it brings the sidebar back as it was, whichever that was', async ({
    page,
    github,
}) => {
    await openPullRequest(page, github);
    const shell = new AppShellHarness(page);
    const review = new ReviewScreenHarness(page);
    const kept = () => page.evaluate(() => localStorage.getItem('githq.sidebarCollapsed'));
    const before = await kept();
    await expect(shell.collapseButton).toBeVisible();

    await page.keyboard.press('d');
    await expect(page).toHaveURL(REVIEW_ADDRESS);
    await expect(review.fileRow('engine.ts')).toBeVisible();
    await expect(shell.collapseButton).toBeHidden();
    // `[` is the previous file here, and nothing expands a rail that's forced.
    await page.keyboard.press('[');
    await expect(shell.collapseButton).toBeHidden();
    await expect(shell.expandButton).toBeHidden();
    expect(await kept()).toBe(before);

    await review.backButton.click();
    await expect(page).toHaveURL(PULL_REQUEST_ADDRESS);
    await expect(shell.collapseButton).toBeVisible();
    expect(await kept()).toBe(before);

    // Collapsed by the user: it stays collapsed after a review too.
    await shell.collapseButton.click();
    await page.keyboard.press('d');
    await expect(review.fileRow('engine.ts')).toBeVisible();
    await review.backButton.click();
    await expect(shell.expandButton).toBeVisible();
    expect(await kept()).toBe('true');
});

test('a jump lands the file exactly at the top and it stays there as files arrive above it and the layout and whitespace change', async ({
    page,
    github,
}) => {
    await openPullRequest(page, github);
    const release = answerReview(github, { repository: 'acme/web', number: 15, files: manyFiles() }).hold(
        'src/a/file00.ts',
    );
    const review = new ReviewScreenHarness(page);
    // In the second query for contents: the first, with what's above it, is held.
    const target = 'src/a/file35.ts';

    await page.goto(REVIEW_ADDRESS);
    await review.fileRow('file35.ts').click();
    await expect(review.code('const changed35 = 2;')).toHaveCount(1);
    await expect.poll(() => review.headerOffset(target)).toBe(0);

    // The file above arrives, much shorter or longer than its placeholder.
    release();
    await expect(review.fileRow('file00.ts').locator('svg[aria-label="Loading"]')).toHaveCount(0);
    await page.waitForTimeout(200);
    expect(await review.headerOffset(target)).toBe(0);

    await review.chooseLayout('Unified');
    await expect(review.diff.getByText('+', { exact: true }).first()).toBeVisible();
    expect(await review.headerOffset(target)).toBe(0);

    await review.toggleHideWhitespace();
    await expect(review.viewOptionsButton).toHaveText(/Unified · whitespace hidden/);
    await page.waitForTimeout(100);
    expect(await review.headerOffset(target)).toBe(0);
    await expect(review.fileRow('file35.ts')).toHaveAttribute('aria-current', 'true');
});

test('the list keeps the current file in view as ] walks past what fits', async ({ page, github }) => {
    await openPullRequest(page, github);
    answerReview(github, { repository: 'acme/web', number: 15, files: manyFiles() });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.currentFileRow).toContainText('file00.ts');

    for (let step = 0; step < 39; step++) {
        await page.keyboard.press(']');
    }

    await expect(review.currentFileRow).toContainText('file39.ts');
    await expect(review.currentFileRow).toBeInViewport();
});

test('a line being read stays where it is through a layout switch', async ({ page, github }) => {
    await openPullRequest(page, github);
    const numbers = Array.from({ length: 300 }, (_, index) => index);
    answerReview(github, {
        repository: 'acme/web',
        number: 15,
        files: [
            {
                path: 'long.ts',
                before: numbers.map(index => `old ${index}\n`).join(''),
                after: numbers.map(index => `new ${index}\n`).join(''),
            },
        ],
    });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.code('new 0')).toHaveCount(1);

    await review.diff.hover();
    await page.mouse.wheel(0, 2000);
    await expect(review.code('new 0')).toHaveCount(0);
    const before = await review.topLine('new ');

    await review.chooseLayout('Unified');
    await expect(review.diff.getByText('+', { exact: true }).first()).toBeVisible();

    const after = await review.code(before.text).boundingBox();
    expect(Math.abs((after?.y ?? 0) - before.y)).toBeLessThan(20);
});

test('the layout and hide whitespace are kept for the next review, and hiding whitespace leaves its changes out', async ({
    page,
    github,
}) => {
    await openPullRequest(page, github);
    const review = new ReviewScreenHarness(page);

    await page.keyboard.press('d');
    await expect(review.viewOptionsButton).toHaveText(/^Split/);
    await review.fileRow('engine.ts').click();
    await review.chooseLayout('Unified');
    // Deleted and added, differing only by indentation.
    await expect(review.code('flush();')).toHaveCount(2);

    await review.toggleHideWhitespace();
    await expect(review.viewOptionsButton).toHaveText(/Unified · whitespace hidden/);
    // Unchanged once whitespace doesn't count: one line of context; the real change is still there.
    await expect(review.code('flush();')).toHaveCount(1);
    await expect(review.code('const MAX_BATCH = 50;')).toBeVisible();

    await page.reload();
    await expect(review.viewOptionsButton).toHaveText(/Unified · whitespace hidden/);
});

test("a file that fails says GitHub's words in place and marks its row, the others unaffected, and Try again fetches it; binary and too large say so", async ({
    page,
    github,
}) => {
    const review = new ReviewScreenHarness(page);
    let answered: AnsweredReview | undefined;
    await openPullRequest(page, github, sample => {
        answered = sample;
        sample.fail(CLIENT, 'Server Error 502');
    });

    await page.keyboard.press('d');
    await expect(review.diff.getByText("Couldn't fetch this file")).toBeVisible();
    await expect(review.diff.getByText(/Server Error 502/)).toBeVisible();
    await expect(review.fileRow('client.ts').getByRole('img', { name: "Couldn't fetch this file" })).toBeVisible();
    await expect(review.code('# Web')).toHaveCount(2);

    await review.fileRow('logo.png').click();
    await expect(review.diff.getByText('Binary file, nothing to diff')).toBeVisible();
    await expect(review.fileRow('logo.png')).toContainText('binary');
    await expect(review.diff.getByText('Too large to diff here')).toBeVisible();
    await expect(review.fileRow('schema.json')).toContainText('too large');

    answered?.heal(CLIENT);
    await review.fileRow('client.ts').click();
    await review.diff.getByRole('button', { name: 'Try again' }).click();
    await expect(review.code('export const client = 2;')).toBeVisible();
    await expect(review.diff.getByText("Couldn't fetch this file")).toHaveCount(0);
});

test('a pull request with no changes says so', async ({ page, github }) => {
    await openPullRequest(page, github);
    answerReview(github, { repository: 'acme/web', number: 15, files: [] });
    const review = new ReviewScreenHarness(page);

    await page.goto(REVIEW_ADDRESS);
    await expect(page.getByRole('heading', { name: 'No changes' })).toBeVisible();
    await expect(review.fileList).toContainText('0 of 0 viewed');
});

test('D leaves the keyboard in the diff: PageDown scrolls it at once', async ({ page, github }) => {
    await openPullRequest(page, github);
    const numbers = Array.from({ length: 300 }, (_, index) => index);
    answerReview(github, {
        repository: 'acme/web',
        number: 15,
        files: [
            {
                path: 'long.ts',
                before: numbers.map(index => `old ${index}\n`).join(''),
                after: numbers.map(index => `new ${index}\n`).join(''),
            },
        ],
    });
    const review = new ReviewScreenHarness(page);

    await page.keyboard.press('d');
    await expect(review.code('new 0')).toHaveCount(1);
    await expect(review.diff).toBeFocused();

    await page.keyboard.press('PageDown');
    await expect.poll(() => review.diff.evaluate(diff => diff.scrollTop)).toBeGreaterThan(100);
});

test('the diff arriving does not take the keyboard from a field the user went to meanwhile', async ({
    page,
    github,
}) => {
    await openPullRequest(page, github);
    const menu = new CommandMenuHarness(page);

    github.holdAnswers();
    await page.keyboard.press('d');
    await expect(page).toHaveURL(REVIEW_ADDRESS);
    await menu.open();
    await expect(menu.field).toBeFocused();

    github.releaseAnswers();
    // Behind the open menu, out of the accessibility tree.
    await expect(page.locator('code', { hasText: 'export const client = 2;' })).toBeAttached();

    await expect(menu.field).toBeFocused();
});

test('a pull request read before draws its list and its code on a reload with GitHub silent', async ({
    page,
    github,
}) => {
    await openPullRequest(page, github);
    const review = new ReviewScreenHarness(page);
    await page.keyboard.press('d');
    await expect(review.code('export const client = 2;')).toBeVisible();
    // All of it is written to disk behind what shows.
    await page.waitForTimeout(300);

    github.holdAnswers();
    await page.reload();

    await expect(review.fileRow('engine.ts')).toBeVisible();
    await expect(review.code('export const client = 2;')).toBeVisible();
    github.releaseAnswers();
});

/** Signs in and opens the sample's pull request on its own page, its review answered. */
async function openPullRequest(
    page: Parameters<typeof openMyWork>[0],
    github: Parameters<typeof openMyWork>[1],
    prepare?: (answered: AnsweredReview) => void,
) {
    await openMyWork(page, github, createSampleMyWork().world);
    const answered = answerReview(github, { repository: 'acme/web', number: 15, files: FILES });
    prepare?.(answered);
    const item = new ItemViewHarness(page);
    await page.goto(PULL_REQUEST_ADDRESS);
    await expect(item.title).toHaveText(PULL_REQUEST);
    return item;
}

/** Forty files of about 40 changed lines each, in one folder. */
function manyFiles(): SampleReviewFile[] {
    return Array.from({ length: 40 }, (_, index) => {
        const name = String(index).padStart(2, '0');
        const body = Array.from({ length: 40 }, (__, line) => `const line${line} = ${index};`).join('\n');
        return {
            path: `src/a/file${name}.ts`,
            before: `${body}\nif (ready) {\nconst changed${index} = 1;\n}\n`,
            after: `${body}\nif (ready) {\n  const changed${index} = 2;\n}\n`,
        };
    });
}
