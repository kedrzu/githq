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
    await expect(review.codeToken('export const client = 2;').first()).toBeVisible();
    // README.md, first, is viewed: opened for the first time it lands on the first file that isn't (D16).
    await expect(review.currentFileRow).toContainText('logo.png');
    await expect.poll(() => review.headerOffset(LOGO)).toBe(0);

    await page.keyboard.press('[');
    await expect(review.currentFileRow).toContainText(README);

    await page.keyboard.press(']');
    await expect(review.currentFileRow).toContainText('logo.png');
    await expect.poll(() => review.headerOffset(LOGO)).toBe(0);

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

test('a file arriving under a reader deep in its placeholder shows from its start, and stays the file the list is at', async ({
    page,
    github,
}) => {
    await openPullRequest(page, github);
    const rewritten = (tag: string) => Array.from({ length: 100 }, (_, line) => `const ${tag}${line} = 1;`).join('\n');
    const files = [
        { path: 'src/rewritten.ts', before: rewritten('old'), after: rewritten('new') },
        { path: 'src/next.ts', before: 'const next = 1;\n', after: 'const next = 2;\n' },
    ];
    const release = answerReview(github, { repository: 'acme/web', number: 15, files }).hold(files[0]?.path ?? '');
    const review = new ReviewScreenHarness(page);

    await page.goto(REVIEW_ADDRESS);
    await expect(review.fileRow('rewritten.ts')).toBeVisible();
    await review.diff.hover();
    await page.mouse.wheel(0, 3000);
    await expect.poll(() => review.diff.evaluate(diff => diff.scrollTop)).toBe(3000);

    release();
    await expect(review.code('const new0 = 1;')).toHaveCount(1);
    await expect.poll(() => review.headerOffset('src/rewritten.ts')).toBe(0);
    await expect(review.fileRow('rewritten.ts')).toHaveAttribute('aria-current', 'true');
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

test('the view options are commands that change what their controls change, their titles saying what picking them does', async ({
    page,
    github,
}) => {
    const review = await openReview(page, github);
    const menu = new CommandMenuHarness(page);
    await review.fileRow('engine.ts').click();
    await expect(review.viewOptionsButton).toHaveText(/^Split/);

    await menu.run('Show unified diff');
    await expect(review.viewOptionsButton).toHaveText(/^Unified/);
    await expect(review.code('flush();')).toHaveCount(2);

    await menu.run('Hide whitespace changes');
    await expect(review.viewOptionsButton).toHaveText(/Unified · whitespace hidden/);
    await expect(review.code('flush();')).toHaveCount(1);

    await menu.open();
    await expect(menu.option('Show split diff')).toBeVisible();
    await expect(menu.option('Show whitespace changes')).toBeVisible();
    await expect(menu.option('Hide comments in collapsed files')).toBeVisible();
    await expect(menu.option('Hide viewed files')).toBeVisible();
    await page.keyboard.press('Escape');

    await menu.run('Hide comments in collapsed files');
    await review.viewOptionsButton.click();
    await expect(page.getByRole('switch', { name: 'Comments in collapsed files' })).not.toBeChecked();
    await page.keyboard.press('Escape');

    await menu.run('Hide viewed files');
    await expect(review.hideViewedButton).toHaveAttribute('aria-pressed', 'true');
    await menu.open();
    await expect(menu.option('Show viewed files')).toBeVisible();
    await expect(menu.option('Show comments in collapsed files')).toBeVisible();
    await page.keyboard.press('Escape');

    await menu.run('Show split diff');
    await expect(review.viewOptionsButton).toHaveText(/^Split · whitespace hidden/);
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
    await expect(review.code('const MAX_BATCH = 50;')).toBeVisible();

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

test('the allowance running out pauses the missing files, saying when, while a viewed mark goes through; they come by themselves at the reset, without a reload', async ({
    page,
    github,
}) => {
    const review = new ReviewScreenHarness(page);
    await page.clock.install();
    let answered: AnsweredReview | undefined;
    const resetAt = new Date(Date.now() + 3_600_000);
    await openPullRequest(page, github, sample => {
        answered = sample;
        // With the list's own answer, as any of the item's answers coming in earlier would pause the list itself.
        sample.beforeNextList(() => {
            github.rateLimit = { limit: 5000, remaining: 50, resetAt };
        });
    });

    await page.keyboard.press('d');
    await expect(review.diff.getByText("Waiting for GitHub's API allowance").first()).toBeVisible();
    await expect(
        review.fileRow('client.ts').getByRole('img', { name: "Waiting for GitHub's API allowance" }),
    ).toBeVisible();
    const status = page.getByRole('contentinfo', { name: 'Status' });
    await expect(status).toContainText('API allowance used up · 4 files wait until');
    await expect(status).toContainText('edits still go through');

    await review.fileRow('client.ts').click();
    await page.keyboard.press('v');
    await expect(review.fileRow('client.ts').getByRole('img', { name: 'Viewed' })).toBeVisible();
    await expect.poll(() => answered?.marked).toEqual([CLIENT]);

    github.rateLimit = { limit: 5000, remaining: 4000, resetAt: new Date(resetAt.getTime() + 3_600_000) };
    await page.clock.fastForward('01:00:01');

    await expect(review.code('const MAX_BATCH = 50;')).toBeVisible();
    await expect(status).not.toContainText('API allowance used up');
});

test('a push since the last visit names the files that lost their viewed mark, tags them, and the line goes when dismissed; the rest of the marks stay', async ({
    page,
    github,
}) => {
    const review = new ReviewScreenHarness(page);
    await openPullRequest(page, github);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.fileRow('README.md').getByRole('img', { name: 'Viewed' })).toBeVisible();
    // The list is written to disk behind what shows.
    await page.waitForTimeout(300);

    answerReview(github, {
        repository: 'acme/web',
        number: 15,
        files: FILES.map(file => (file.path === README ? { ...file, viewed: 'DISMISSED' } : file)),
    });
    await page.reload();

    const line = page.getByRole('status').filter({ hasText: 'lost its viewed mark' });
    await expect(line).toContainText('README.md');
    await expect(review.fileRow('README.md')).toContainText('changed since');
    await expect(review.fileRow('client.ts')).not.toContainText('changed since');

    await line.getByRole('button', { name: 'Show only this one' }).click();
    await expect(review.fileRow('client.ts')).toHaveCount(0);

    await line.getByRole('button', { name: 'Dismiss' }).click();
    await expect(line).toHaveCount(0);
    await expect(review.fileRow('README.md')).toContainText('changed since');
});

test('V collapses the file in place with viewed files shown, nothing moving; a second V opens it, and Space opens a viewed one and collapses it back (D13)', async ({
    page,
    github,
}) => {
    await openPullRequest(page, github);
    answerReview(github, { repository: 'acme/web', number: 15, files: FILES });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.code('export const client = 2;')).toBeVisible();
    // The one GitHub says is viewed comes as a header, nothing of it read.
    await expect(review.fileHeader(README)).toBeAttached();
    await expect(review.code('The web app.')).toHaveCount(0);

    await review.fileRow('client.ts').click();
    await expect.poll(() => review.headerOffset(CLIENT)).toBe(0);

    await page.keyboard.press('v');
    await expect(review.viewedButton(CLIENT)).toHaveAttribute('aria-pressed', 'true');
    await expect(review.code('export const client = 2;')).toHaveCount(0);
    await expect.poll(() => review.headerOffset(CLIENT)).toBe(0);
    await expect(review.currentFileRow).toContainText('client.ts');

    await page.keyboard.press('v');
    await expect(review.viewedButton(CLIENT)).toHaveAttribute('aria-pressed', 'false');
    await expect(review.code('export const client = 2;')).toBeVisible();

    await review.fileRow('README.md').click();
    await page.keyboard.press('Space');
    await expect(review.code('The web app.')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(review.code('The web app.')).toHaveCount(0);
});

test('a pull request with no changes says so', async ({ page, github }) => {
    await openPullRequest(page, github);
    answerReview(github, { repository: 'acme/web', number: 15, files: [] });
    const review = new ReviewScreenHarness(page);

    await page.goto(REVIEW_ADDRESS);
    await expect(page.getByRole('heading', { name: 'No changes' })).toBeVisible();
    await expect(review.fileList).not.toContainText('viewed');
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

test('a lock file shows only its header, saying why, and is not fetched until Space opens it; Space collapses it back', async ({
    page,
    github,
}) => {
    await openPullRequest(page, github);
    const answered = answerReview(github, {
        repository: 'acme/web',
        number: 15,
        files: [
            { path: 'bun.lock', before: 'lock before\n', after: 'lock after\n' },
            { path: 'src/app.ts', before: 'const app = 1;\n', after: 'const app = 2;\n' },
        ],
    });
    const review = new ReviewScreenHarness(page);
    const askedForLock = () => answered.asked.filter(expression => expression.endsWith(':bun.lock'));

    await page.goto(REVIEW_ADDRESS);
    await expect(review.code('const app = 2;')).toBeVisible();
    await expect(review.diff.getByText('lock file').first()).toBeVisible();
    await expect(review.fileRow('bun.lock')).toContainText('lock file');
    await expect(review.code('lock after')).toHaveCount(0);
    expect(askedForLock()).toEqual([]);

    // Collapsed, it isn't where a first open lands (D16).
    await expect(review.currentFileRow).toContainText('app.ts');
    await page.keyboard.press('[');
    await expect(review.currentFileRow).toContainText('bun.lock');
    const scrolled = await review.diff.evaluate(diff => diff.scrollTop);
    await page.keyboard.press('Space');
    await expect(review.code('lock after')).toBeVisible();
    expect(askedForLock()).toHaveLength(2);
    expect(await review.diff.evaluate(diff => diff.scrollTop)).toBe(scrolled);
    // Opened, it still says why it started collapsed; only the list's tag goes.
    await expect(review.diff.getByText('lock file').first()).toBeVisible();
    await expect(review.fileRow('bun.lock')).not.toContainText('lock file');

    await page.keyboard.press('Space');
    await expect(review.code('lock after')).toHaveCount(0);
    await expect(review.diff.getByText('lock file').first()).toBeVisible();

    await review.topHeader('bun.lock').click();
    await expect(review.code('lock after')).toBeVisible();
    expect(askedForLock()).toHaveLength(2);
});

test('V with viewed files hidden brings the next file to the top of the screen, and the count follows; everything viewed says so', async ({
    page,
    github,
}) => {
    await openPullRequest(page, github);
    const files = answerReview(github, {
        repository: 'acme/web',
        number: 15,
        files: [
            { path: 'src/a.ts', before: 'const a = 1;\n', after: 'const a = 2;\n' },
            { path: 'src/b.ts', before: 'const b = 1;\n', after: 'const b = 2;\n' },
        ],
    });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.code('const a = 2;')).toBeVisible();
    await expect(review.fileList).toContainText('0 of 2 viewed');

    await review.hideViewedButton.click();
    await expect(review.hideViewedButton).toHaveAttribute('aria-pressed', 'true');
    await review.diff.focus();

    await page.keyboard.press('v');
    await expect(review.fileRow('a.ts')).toHaveCount(0);
    await expect(review.code('const a = 2;')).toHaveCount(0);
    await expect(review.fileList).toContainText('1 of 2 viewed');
    await expect(review.currentFileRow).toContainText('b.ts');
    await expect.poll(() => review.headerOffset('src/b.ts')).toBe(0);
    await expect.poll(() => files.marked).toEqual(['src/a.ts']);

    await page.keyboard.press('v');
    await expect(page.getByRole('heading', { name: 'All 2 files viewed' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Next: #/u })).toHaveCount(0);
    await page.getByRole('button', { name: 'Submit review…' }).click();
    await expect(review.submitDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Show viewed files' }).click();
    await expect(review.viewedButton('src/a.ts')).toHaveAttribute('aria-pressed', 'true');
    await expect(review.code('const a = 2;')).toHaveCount(0);
    await expect(review.fileList).toContainText('2 of 2 viewed');
});

test('a mark GitHub refuses goes back and a toast says so; V typed in a field does nothing', async ({
    page,
    github,
}) => {
    await openPullRequest(page, github);
    const files = answerReview(github, {
        repository: 'acme/web',
        number: 15,
        files: [{ path: 'src/a.ts', before: 'const a = 1;\n', after: 'const a = 2;\n' }],
    });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.code('const a = 2;')).toBeVisible();

    // The review has no field of its own yet: any will do, for the key is refused by where it is typed.
    await page.evaluate(() => {
        const field = document.createElement('input');
        field.id = 'a-field';
        document.body.append(field);
        field.focus();
    });
    await page.keyboard.type('v');
    await expect(page.locator('#a-field')).toHaveValue('v');
    await expect(review.fileList).toContainText('0 of 1 viewed');
    await page.locator('#a-field').evaluate(field => field.remove());

    files.refuseMarks('You may not do that');
    await review.viewedButton('src/a.ts').click();
    await expect(page.getByRole('region', { name: 'Notifications' })).toContainText('You may not do that');
    await expect(review.fileList).toContainText('0 of 1 viewed');
    await expect(review.viewedButton('src/a.ts')).toHaveAttribute('aria-pressed', 'false');

    files.allowMarks();
    await review.viewedButton('src/a.ts').click();
    await expect(review.fileList).toContainText('1 of 1 viewed');
    await expect.poll(() => files.marked).toEqual(['src/a.ts']);
});

test('ten files selected with shift+click, x and { } are marked viewed at once in one request, and leave a list hiding viewed ones; Esc clears', async ({
    page,
    github,
}) => {
    await openMyWork(page, github, createSampleMyWork().world);
    const files = answerReview(github, { repository: 'acme/web', number: 15, files: manyFiles() });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.fileRow('file00.ts')).toBeVisible();

    await review.fileRow('file00.ts').click();
    await review.fileRow('file09.ts').click({ modifiers: ['Shift'] });
    await expect(review.selectionCount('10 files selected')).toBeVisible();
    await expect(review.fileRow('file05.ts')).toHaveAttribute('aria-pressed', 'true');
    await expect(review.fileRow('file10.ts')).not.toHaveAttribute('aria-pressed', 'true');

    await review.fileRow('file20.ts').click({ modifiers: ['ControlOrMeta'] });
    await expect(review.selectionCount('11 files selected')).toBeVisible();
    await review.fileRow('file20.ts').click({ modifiers: ['ControlOrMeta'] });
    await expect(review.selectionCount('10 files selected')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(review.markViewedButton).toBeHidden();

    await review.fileRow('file00.ts').click();
    await page.keyboard.press('x');
    await expect(review.selectionCount('1 file selected')).toBeVisible();
    await expect(page.getByText('x select · { } extend · V mark viewed · Esc clear')).toBeVisible();
    await page.keyboard.type('}}');
    await expect(review.selectionCount('3 files selected')).toBeVisible();
    await expect(review.currentFileRow).toContainText('file02.ts');
    await page.keyboard.type('{');
    await expect(review.currentFileRow).toContainText('file01.ts');
    await expect(review.selectionCount('3 files selected')).toBeVisible();

    // A plain click ends it: V acts on the file clicked, not on the ones selected before.
    await review.fileRow('file20.ts').click();
    await expect(review.markViewedButton).toBeHidden();
    await expect(page.getByText('x select · { } extend · V mark viewed · Esc clear')).toBeHidden();

    await review.fileRow('file00.ts').click();
    await review.fileRow('file09.ts').click({ modifiers: ['Shift'] });
    await review.hideViewedButton.click();
    await review.markViewedButton.click();

    await expect(review.fileList).toContainText('10 of 40 viewed');
    await expect(review.fileRow('file00.ts')).toBeHidden();
    await expect(review.markViewedButton).toBeHidden();
    await expect.poll(() => files.marked.length).toBe(10);
    expect(files.markRequests()).toBe(1);
});

test('V takes the selection; x, {, }, / and V typed in the filter are typed', async ({ page, github }) => {
    await openMyWork(page, github, createSampleMyWork().world);
    const files = answerReview(github, { repository: 'acme/web', number: 15, files: manyFiles() });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.fileRow('file00.ts')).toBeVisible();

    await page.keyboard.press('/');
    await expect(review.filterField).toBeFocused();
    await page.keyboard.type('x{}/V');
    await expect(review.filterField).toHaveValue('x{}/V');
    await expect(review.markViewedButton).toBeHidden();
    await expect(review.fileList).toContainText('0 of 40 match');

    await page.keyboard.press('Escape');
    await expect(review.filterField).toHaveValue('');
    await expect(review.filterField).not.toBeFocused();
    await expect(review.fileList).toContainText('0 of 40 viewed');

    await page.keyboard.press('x');
    await page.keyboard.type('}');
    await page.keyboard.press('v');
    await expect(review.fileList).toContainText('2 of 40 viewed');
    await expect.poll(() => files.marked.length).toBe(2);
});

test('the filter takes a pattern and a regular expression, holds what stays on screen and lands a filtered file on the next one', async ({
    page,
    github,
}) => {
    await openMyWork(page, github, createSampleMyWork().world);
    answerReview(github, {
        repository: 'acme/web',
        number: 15,
        files: [
            ...manyFiles(),
            { path: 'docs/images/logo.svg', before: '<a/>\n', after: '<b/>\n' },
            { path: 'docs/guide.md', before: 'one\n', after: 'two\n' },
        ],
    });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.fileRow('file00.ts')).toBeVisible();

    // Hiding the files above leaves the file read, and its line, where they are.
    await review.fileRow('file05.ts').click();
    await expect(review.code('const changed5 = 2;').first()).toBeAttached();
    await review.diff.evaluate(diff => diff.scrollBy(0, 40));
    const before = await review.topLine('const line');
    expect(before.text).toContain('= 5;');
    await page.keyboard.press('/');
    await page.keyboard.type('**/file05.ts');
    await expect(review.fileList).toContainText('1 of 42 match');
    await expect(review.fileRow('file04.ts')).toBeHidden();
    expect(await review.topLine('const line')).toEqual(before);
    await page.keyboard.press('Enter');
    await expect(review.diff).toBeFocused();

    // Filtered away, it gives way to the next file left.
    await review.filterField.fill('file07, file09');
    await expect(review.currentFileRow).toContainText('file07.ts');

    await review.filterField.fill('.md');
    await expect(review.fileList).toContainText('1 of 42 match');
    await expect(review.fileHeader('docs/guide.md')).toBeVisible();

    await review.filterField.fill('docs/**/*.svg');
    await expect(review.fileHeader('docs/images/logo.svg')).toBeVisible();

    await review.regexToggle.click();
    await expect(review.regexToggle).toHaveAttribute('aria-pressed', 'true');
    await review.filterField.fill('^src/a/file0[12]');
    await expect(review.fileList).toContainText('2 of 42 match');

    await review.filterField.fill('^src/a/file0[');
    await expect(review.fileList.getByRole('status')).toContainText('Not a valid regular expression');
    await expect(review.fileList).toContainText('2 of 42 match');

    await review.filterField.fill('^nothing$');
    await expect(review.fileList).toContainText('No files match this filter.');
    await expect(page.getByRole('heading', { name: 'No files match this filter' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear the filter' }).click();
    await expect(review.fileList).toContainText('0 of 42 viewed');
});

test('Show 20 brings the lines nearest the change below and keeps the line being read; Show all empties the gap', async ({
    page,
    github,
}) => {
    await openMyWork(page, github, createSampleMyWork().world);
    const body = Array.from({ length: 100 }, (_, index) => `    const kept${index} = ${index};`).join('\n');
    answerReview(github, {
        repository: 'acme/web',
        number: 15,
        files: [
            {
                path: 'src/long.ts',
                before: `export class SyncEngine {\n    const first = 1;\n${body}\n    const last = 1;\n}\n`,
                after: `export class SyncEngine {\n    const first = 2;\n${body}\n    const last = 2;\n}\n`,
            },
        ],
    });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.code('const last = 2;')).toBeVisible();
    await expect(review.diff.getByText('export class SyncEngine {').last()).toBeVisible();

    const read = await review.code('const last = 2;').boundingBox();
    await review.gapButton('Show 20').click();
    await expect(review.code('const kept96 = 96;').first()).toBeAttached();
    await expect(review.code('const kept77 = 77;').first()).toBeAttached();
    await expect(review.code('const kept76 = 76;')).toHaveCount(0);
    expect((await review.code('const last = 2;').boundingBox())?.y).toBe(read?.y);

    await review.diff.evaluate(diff => diff.scrollTo(0, 0));
    await review.gapButton('Show all').click();
    await expect(review.code('const kept50 = 50;').first()).toBeAttached();
    await expect(review.gapButton('Show all')).toHaveCount(0);
});

test('⌘B hides the file list and remembers it, the toggle and the view options say so; [ and ] still walk the files', async ({
    page,
    github,
}) => {
    const review = await openReview(page, github);
    await expect(review.fileList).toBeVisible();

    await page.keyboard.press('ControlOrMeta+b');
    await expect(review.fileList).toBeHidden();
    await expect(review.fileListToggle).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press(']');
    await expect.poll(() => review.headerOffset(CLIENT)).toBe(0);

    await page.reload();
    await expect(review.fileHeader(CLIENT)).toBeAttached();
    await expect(review.fileList).toBeHidden();

    await review.viewOptionsButton.click();
    await page.getByRole('switch', { name: 'File list' }).click();
    await page.keyboard.press('Escape');
    await expect(review.fileList).toBeVisible();

    await review.fileListToggle.click();
    await expect(review.fileList).toBeHidden();
    await page.keyboard.press('/');
    await expect(review.filterField).toBeFocused();
    await page.keyboard.press('ControlOrMeta+b');
    await expect(review.fileList).toBeHidden();
});

/** Signs in and opens the review of the sample's pull request at its address. */
async function openReview(page: Parameters<typeof openMyWork>[0], github: Parameters<typeof openMyWork>[1]) {
    await openMyWork(page, github, createSampleMyWork().world);
    answerReview(github, { repository: 'acme/web', number: 15, files: FILES });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.fileRow('client.ts')).toBeVisible();
    return review;
}

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
