import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';

import { answerReview } from './answerReview.js';
import type { SampleReviewFile } from './answerReview.js';

const FIRST = 'Split the rate limiter in two';
const SECOND = 'Move the limits to the config';
const THIRD = 'Document the new limits';
const ENGINE = 'src/engine.ts';

/** 200 lines, every tenth one changed, for a line to be read deep in a file. */
function longFile(name: string): SampleReviewFile {
    const lines = Array.from({ length: 200 }, (_, index) => `const ${name}${index} = ${index};`);
    return {
        path: `src/${name}.ts`,
        before: `${lines.join('\n')}\n`,
        after: `${lines.map((line, index) => (index % 10 === 0 ? `${line} // changed` : line)).join('\n')}\n`,
    };
}

const FILES: readonly SampleReviewFile[] = [
    { path: 'README.md', before: '# Web\n', after: '# Web!\n', viewed: 'VIEWED' },
    longFile('engine'),
    longFile('other'),
];

/** A stack the viewer's list holds, walked from its second pull request; `count` long, for more than a model's worth. */
function createWorld(count: number) {
    const viewer = SAMPLE_VIEWER.viewer.login;
    const world = new GitHubWorld(viewer);
    world.stack({
        repository: 'acme/api',
        number: 7,
        pullRequests: Array.from({ length: count }, (_, index) => ({
            number: 201 + index,
            title: [FIRST, SECOND, THIRD][index] ?? `Pull request ${index}`,
            author: 'monalisa',
            foundBy: index === 1 ? ['reviewRequested' as const] : undefined,
            reviewRequests: index === 1 ? [viewer] : undefined,
            minutesAgo: 20 - index,
        })),
    });
    return world;
}

/** The stack's second pull request, its entry expanded in the list, its review entered with `D`. Answers every review of the stack with `files`. */
async function openReview(page: Page, github: GitHubMock, files = FILES, count = 3) {
    const { myWork } = await openMyWork(page, github, createWorld(count));
    const answered = answerReview(github, { repository: 'acme/api', number: 202, files });
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
    await expect(page).toHaveURL('/acme/api/pull/202/files');
    const review = new ReviewScreenHarness(page);
    await expect(review.currentFileRow).toBeVisible();
    return { review, answered };
}

/** Scrolls the line to `top` below the top of the diff, however far off it is, and waits past the position's throttle. */
async function readLine(review: ReviewScreenHarness, text: string, top: number) {
    await expect
        .poll(() =>
            review.diff.evaluate(
                (diff, { wanted, at }) => {
                    const line = [...diff.querySelectorAll('code')].find(other => other.textContent?.includes(wanted));
                    const distance = line
                        ? line.getBoundingClientRect().top - diff.getBoundingClientRect().top - at
                        : 400;
                    diff.scrollTop += distance;
                    return line ? distance : null;
                },
                { wanted: text, at: top },
            ),
        )
        .toBe(0);
    await review.page.waitForTimeout(700);
}

/** How far below the top of the diff the line is, on whichever side it shows first. */
async function lineOffset(review: ReviewScreenHarness, text: string) {
    return await review.diff.evaluate((diff, wanted) => {
        const line = [...diff.querySelectorAll('code')].find(other => other.textContent?.includes(wanted));
        return line ? line.getBoundingClientRect().top - diff.getBoundingClientRect().top : null;
    }, text);
}

/** Takes the texts off the disk, for a reload to have to ask GitHub for them. */
async function forgetKeptTexts(page: Page) {
    await page.evaluate(
        name =>
            new Promise<void>((resolve, reject) => {
                const opening = indexedDB.open(name);
                opening.addEventListener('error', () => reject(new Error('Could not open the database')));
                opening.addEventListener('success', () => {
                    const db = opening.result;
                    const clearing = db.transaction('blobs', 'readwrite').objectStore('blobs').clear();
                    clearing.addEventListener('success', () => {
                        db.close();
                        resolve();
                    });
                });
            }),
        `githq-blobs/${SAMPLE_VIEWER.viewer.login}`,
    );
}

const READ = 'const engine47 = 47;';
const READ_TOP = 137;
/** A line under the top of the screen: the one a position is kept by. */
const TOP_LINE_TOP = -6;

test('J then K comes back to the very line, at the same distance from the top, and a reload does too', async ({
    page,
    github,
}) => {
    const { review } = await openReview(page, github);
    await readLine(review, READ, READ_TOP);

    await page.keyboard.press('j');
    await expect(page).toHaveURL('/acme/api/pull/203/files');
    await expect(review.title).toHaveText(THIRD);
    await page.keyboard.press('k');
    await expect(page).toHaveURL('/acme/api/pull/202/files');
    await expect(review.title).toHaveText(SECOND);

    // Exactly, not nearly: within what the browser's own pixel rounding leaves.
    await expect.poll(() => lineOffset(review, READ)).toBeCloseTo(READ_TOP, 0);
    await expect(review.currentFileRow).toContainText('engine.ts');

    await page.reload();
    await expect(review.title).toHaveText(SECOND);
    await expect.poll(() => lineOffset(review, READ)).toBeCloseTo(READ_TOP, 0);
    await expect(review.currentFileRow).toContainText('engine.ts');
});

test('the status bar says why a review opens where it does, until the first move', async ({ page, github }) => {
    const { review } = await openReview(page, github);
    const { statusBar } = new AppShellHarness(page);
    await expect(statusBar).toContainText("First visit: starting at the first file you haven't viewed · 1 of 3 viewed");

    await readLine(review, READ, TOP_LINE_TOP);
    await expect(statusBar).not.toContainText('First visit');

    await page.keyboard.press('j');
    await expect(review.title).toHaveText(THIRD);
    await expect(statusBar).toContainText(
        "#203, first visit: starting at the first file you haven't viewed · K back to #202",
    );

    await page.keyboard.press('k');
    await expect(review.title).toHaveText(SECOND);
    // The first line showing under the pinned header, not the one kept hidden under it: `engine47` is line 48, kept at -6.
    // Rows of 20 px under a header of 38: 48 and 49 are behind it, 50 reaches below.
    await expect(statusBar).toContainText(/Back\sin\s#202\swhere\syou\sleft\sit:\sengine\.ts,\sline\s50/);
});

test('a remembered line whose file is not here holds its header and takes over when it comes; a scroll meanwhile is left alone', async ({
    page,
    github,
}) => {
    const { review, answered } = await openReview(page, github);
    await readLine(review, READ, READ_TOP);
    await forgetKeptTexts(page);

    let release = answered.hold(ENGINE);
    await page.reload();
    await expect(review.fileRow('engine.ts')).toBeVisible();
    await expect.poll(() => review.headerOffset(ENGINE)).toBe(0);
    release();
    await expect.poll(() => lineOffset(review, READ)).toBeCloseTo(READ_TOP, 0);

    await forgetKeptTexts(page);
    release = answered.hold(ENGINE);
    await page.reload();
    await expect(review.fileRow('engine.ts')).toBeVisible();
    await expect.poll(() => review.headerOffset(ENGINE)).toBe(0);
    await review.diff.hover();
    await page.mouse.wheel(0, -500);
    await expect.poll(() => review.diff.evaluate(diff => diff.scrollTop)).toBe(0);

    release();
    await expect(review.code('const engine0 = 0;').first()).toBeAttached();
    await page.waitForTimeout(100);
    expect(await review.diff.evaluate(diff => diff.scrollTop)).toBe(0);
    expect(await review.headerOffset('README.md')).toBe(0);
});

test('what was done in a pull request comes back on a reload: collapsed, hide viewed, the filter, expanded context; another pull request has its own', async ({
    page,
    github,
}) => {
    const { review } = await openReview(page, github);
    await expect(review.code('const engine10 = 10; // changed').first()).toBeVisible();
    await review.gapArrow('all').first().click();
    await expect(review.code('const engine5 = 5;').first()).toBeVisible();

    await review.fileRow('other.ts').click();
    await expect(review.currentFileRow).toContainText('other.ts');
    await page.keyboard.press('Space');
    await expect(review.code('const other0 = 0;')).toHaveCount(0);
    await review.hideViewedButton.click();
    await expect(review.fileRow('README.md')).toHaveCount(0);
    await review.filterField.fill('src/');
    await review.fileRow('engine.ts').click();
    await expect(review.currentFileRow).toContainText('engine.ts');

    await page.keyboard.press('j');
    await expect(review.title).toHaveText(THIRD);
    await expect(review.filterField).toHaveValue('');
    await expect(review.fileRow('README.md')).toBeVisible();
    await page.keyboard.press('k');
    await expect(review.title).toHaveText(SECOND);
    await page.waitForTimeout(100);

    await page.reload();
    await expect(review.title).toHaveText(SECOND);
    await expect(review.filterField).toHaveValue('src/');
    await expect(review.fileRow('engine.ts')).toBeVisible();
    await expect(review.fileRow('README.md')).toHaveCount(0);
    await expect(review.code('const engine5 = 5;').first()).toBeAttached();
    await page.keyboard.press(']');
    await expect(review.currentFileRow).toContainText('other.ts');
    await expect(review.code('const other0 = 0;')).toHaveCount(0);
});

test('a regular expression that hangs the tab is not there in the next tab; one that came back from running is', async ({
    page,
    context,
    github,
}) => {
    // Exponential on a path of a's that doesn't end as it asks.
    const hanging = `^(a+)+$`;
    const { review } = await openReview(page, github, [
        ...FILES,
        { path: `${'a'.repeat(40)}!.ts`, before: 'a\n', after: 'b\n' },
    ]);

    await review.regexToggle.click();
    await review.filterField.fill('engine');
    await expect(review.fileRow('other.ts')).toHaveCount(0);
    await page.waitForTimeout(100);

    void review.filterField.fill(hanging).catch(() => {});
    await expect
        .poll(
            () =>
                Promise.race([
                    page.evaluate(() => 'answers'),
                    new Promise<string>(resolve => {
                        setTimeout(() => resolve('hung'), 1000);
                    }),
                ]),
            { timeout: 15_000 },
        )
        .toBe('hung');
    await page.close();

    const next = await context.newPage();
    await next.goto('/acme/api/pull/202/files');
    const again = new ReviewScreenHarness(next);
    await expect(again.fileRow('engine.ts')).toBeVisible();
    await expect(again.filterField).toHaveValue('engine');
});

test('nine pull requests on, the first comes back from disk at its line, without asking GitHub for its text', async ({
    page,
    github,
}) => {
    const { review } = await openReview(page, github, FILES, 12);
    await readLine(review, READ, READ_TOP);

    for (let number = 203; number <= 211; number++) {
        await page.keyboard.press('j');
        await expect(page).toHaveURL(`/acme/api/pull/${number}/files`);
        await expect(review.code('const engine0 = 0;').first()).toBeAttached();
    }

    for (let number = 210; number >= 203; number--) {
        await page.keyboard.press('k');
        await expect(page).toHaveURL(`/acme/api/pull/${number}/files`);
    }

    const texts = countTextQueries(github, page);
    expect(texts).toBeGreaterThan(0);
    const [took] = await Promise.all([
        page.evaluate(
            async ({ wanted, top }) => {
                const pressed = new Promise<number>(resolve => {
                    window.addEventListener('keydown', () => resolve(performance.now()), { capture: true, once: true });
                });
                const start = await pressed;
                return await new Promise<number>(resolve => {
                    const check = () => {
                        const diff = document.querySelector('[role="region"][aria-label="Changes"]');
                        const line = [...(diff?.querySelectorAll('code') ?? [])].find(code =>
                            code.textContent?.includes(wanted),
                        );
                        const offset =
                            diff && line && line.getBoundingClientRect().top - diff.getBoundingClientRect().top;
                        if (location.pathname.endsWith('/202/files') && offset != null && Math.abs(offset - top) < 1) {
                            resolve(performance.now() - start);
                        } else {
                            requestAnimationFrame(check);
                        }
                    };

                    check();
                });
            },
            { wanted: READ, top: READ_TOP },
        ),
        page.waitForTimeout(50).then(() => page.keyboard.press('k')),
    ]);

    await expect(page).toHaveURL('/acme/api/pull/202/files');
    await expect.poll(() => lineOffset(review, READ)).toBeCloseTo(READ_TOP, 0);
    expect(countTextQueries(github, page)).toBe(texts);
    test.info().annotations.push({ type: 'return through an evicted model', description: `${took.toFixed(0)} ms` });
    expect(took).toBeLessThan(1000);
});

function countTextQueries(github: GitHubMock, page: Page) {
    return github.apiRequestsOf(page).filter(request => request === 'ReviewBlobTexts').length;
}
