import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

import { answerReview } from './answerReview.js';
import type { SampleReviewFile } from './answerReview.js';

// Find in the diff (D47, CR137–CR143): ⌘F's bar counts and marks the shown lines' matches, Enter and ⌘G walk them with
// the cursor, and its switches read the query as VS Code does.

const ADDRESS = '/acme/web/pull/15/files';

/**
 * Lines 1 and 2 unchanged, 3 and 4 changed. `marker`: once unchanged (a split row shows it twice), once deleted, once
 * added. `beacon`: once unchanged, once added.
 */
const ALPHA: SampleReviewFile = {
    path: 'src/a/alpha.ts',
    before: "const a1 = 'marker';\nconst a2 = 'beacon';\nconst a3 = 'marker old';\nconst a4 = 4;\n",
    after: "const a1 = 'marker';\nconst a2 = 'beacon';\nconst a3 = 'marker new';\nconst a4 = 'beacon';\n",
};
/** Every line changed, none matching: rows enough that the file after it is not drawn when the review opens. */
const LONG: SampleReviewFile = {
    path: 'src/b/long.ts',
    before: `${numbered(300).join('\n')}\n`,
    after: `${numbered(300)
        .map(line => `${line} // changed`)
        .join('\n')}\n`,
};
/** Far below the first file: `marker` and `beacon` once each, both added. */
const FAR: SampleReviewFile = {
    path: 'src/c/far.ts',
    before: 'export const far = 1;\n',
    after: "export const far = 'marker';\nexport const farther = 'beacon';\n",
};

test('⌘F opens the bar with its field focused; the counter counts the shown lines of both files, an unchanged line once, in split and in unified (D47)', async ({
    page,
    github,
}) => {
    const review = await openFind(page, github, [ALPHA, LONG, FAR]);

    await page.keyboard.press('ControlOrMeta+f');
    await expect(review.findField).toBeFocused();
    await review.findField.fill('marker');
    // Alpha's unchanged, deleted and added lines, and far's added line; the split row's two halves of line 1 count once.
    await expect(review.findCounter).toHaveText('1 of 4');
    await expect(
        review.diff.locator('[data-cursor-key]', { hasText: "const a1 = 'marker';" }).locator('mark'),
    ).toHaveCount(2);

    await review.chooseLayout('Unified');
    await expect(review.findCounter).toHaveText('1 of 4');
    await expect(
        review.diff.locator('[data-cursor-key]', { hasText: "const a1 = 'marker';" }).locator('mark'),
    ).toHaveCount(1);
});

test('Enter goes to the next match, drawing a far file and putting the cursor on its row, and wraps past the last; ⇧Enter and ⇧⌘G go back (D47)', async ({
    page,
    github,
}) => {
    const review = await openFind(page, github, [ALPHA, LONG, FAR]);
    await expect(review.code("export const farther = 'beacon';")).toHaveCount(0);

    await review.find('beacon');
    // A new query lands on the first match from the cursor, which is on the first file.
    await expect(review.findCounter).toHaveText('1 of 3');

    // The first Enter goes to the match landed on, not past it.
    await page.keyboard.press('Enter');
    await expect(review.findCounter).toHaveText('1 of 3');
    await expectCursorOnMatch(review, "const a2 = 'beacon';");

    await page.keyboard.press('Enter');
    await expect(review.findCounter).toHaveText('2 of 3');
    await expectCursorOnMatch(review, "const a4 = 'beacon';");

    await page.keyboard.press('Enter');
    await expect(review.findCounter).toHaveText('3 of 3');
    await expectCursorOnMatch(review, "export const farther = 'beacon';");
    await expect(review.currentMatch).toBeInViewport();
    await expect(review.findField).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(review.findCounter).toHaveText('1 of 3');
    await expectCursorOnMatch(review, "const a2 = 'beacon';");

    await page.keyboard.press('Shift+Enter');
    await expect(review.findCounter).toHaveText('3 of 3');
    await expectCursorOnMatch(review, "export const farther = 'beacon';");

    await page.keyboard.press('ControlOrMeta+Shift+g');
    await expect(review.findCounter).toHaveText('2 of 3');
    await expectCursorOnMatch(review, "const a4 = 'beacon';");
    await expect(review.currentMatch).toBeInViewport();
});

test('Match case, Match whole word and a regular expression change the matches as VS Code does; an invalid pattern says so and marks nothing (D47)', async ({
    page,
    github,
}) => {
    const review = await openFind(page, github, [
        {
            path: 'src/d/toggles.ts',
            changeType: 'ADDED',
            before: null,
            after: 'const foo = 1;\nconst Foo = 2;\nconst foobar = 3;\nconst fooo = 4;\n',
        },
    ]);

    await review.find('foo');
    await expectMatches(review, 4);

    await review.findToggle('Match case').click();
    await expect(review.findToggle('Match case')).toHaveAttribute('aria-pressed', 'true');
    await expectMatches(review, 3);
    await expect(review.code('const Foo = 2;').locator('mark')).toHaveCount(0);

    await review.findToggle('Match whole word').click();
    await expectMatches(review, 1);
    await expect(review.code('const foo = 1;').locator('mark')).toHaveCount(1);

    await review.findToggle('Match case').click();
    await expectMatches(review, 2);
    await expect(review.code('const foobar = 3;').locator('mark')).toHaveCount(0);

    await review.findToggle('Match whole word').click();
    await review.findToggle('Use a regular expression').click();
    await review.findField.fill(String.raw`fo+\b`);
    // `foo`, `Foo` and `fooo`; in `foobar` no run of o ends a word.
    await expectMatches(review, 3);
    await expect(review.code('const foobar = 3;').locator('mark')).toHaveCount(0);

    await review.findField.fill('fo(');
    await expect(review.findCounter).toHaveText('Invalid regular expression');
    await expect(review.findMarks).toHaveCount(0);
});

test('a line hidden in a gap is not matched until the gap is opened (D47)', async ({ page, github }) => {
    const numberedGap = numbered(20);
    const before = numberedGap.map((line, index) => (index === 9 ? "const hidden = 'zephyr';" : line));
    const after = before.map((line, index) => (index === 0 || index === 19 ? `${line} // changed` : line));
    const review = await openFind(page, github, [
        { path: 'src/e/gap.ts', before: `${before.join('\n')}\n`, after: `${after.join('\n')}\n` },
    ]);

    await review.find('zephyr');
    await expect(review.findCounter).toHaveText('No results');

    await review.gapArrow('all').click();
    await expect(review.code("const hidden = 'zephyr';").first()).toBeVisible();
    await expect(review.findCounter).toHaveText('1 of 1');
    await expect(review.findMarks).toHaveCount(2);
});

test('a catastrophic pattern is stopped and the bar says it is too slow, the screen still answering keys (D47)', async ({
    page,
    github,
}) => {
    const review = await openFind(page, github, [
        {
            path: 'src/f/slow.ts',
            changeType: 'ADDED',
            before: null,
            after: `const first = 1;\n${'a'.repeat(40)}!\nconst third = 3;\nconst fourth = 4;\n`,
        },
    ]);

    await page.keyboard.press('ControlOrMeta+f');
    await review.findToggle('Use a regular expression').click();
    await review.findField.fill('(a+)+$');
    // The 1.5 s budget after the 150 ms pause, with room for a busy machine.
    await expect(review.findCounter).toHaveText('Pattern too slow', { timeout: 3000 });

    await review.diff.focus();
    const before = await review.cursorKey();
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => review.cursorKey()).not.toBe(before);
    await expect(review.findCounter).toHaveText('Pattern too slow');
});

test('Esc in the field closes the bar and takes every mark away, the cursor staying on the last match; ? lists the find keys (D47)', async ({
    page,
    github,
}) => {
    const review = await openFind(page, github, [ALPHA, LONG, FAR]);

    await review.find('beacon');
    await expect(review.findCounter).toHaveText('1 of 3');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expectCursorOnMatch(review, "const a4 = 'beacon';");
    const match = await review.currentMatchKey();

    await page.keyboard.press('Escape');
    await expect(review.findBar).toBeHidden();
    await expect(review.findMarks).toHaveCount(0);
    expect(await review.cursorKey()).toBe(match);

    await page.keyboard.press('?');
    const finding = page.getByRole('dialog', { name: 'Keys in a review' }).getByRole('region', { name: 'Finding' });
    await expect(finding.getByText('Find in the diff')).toBeVisible();
    await expect(finding.getByText('Next and previous match')).toBeVisible();
    await expect(finding.getByText('The same, with function keys')).toBeVisible();
    await expect(finding.getByText('The same, in the find field')).toBeVisible();
    await expect(finding.getByText('Close the bar, in the field')).toBeVisible();
});

async function openFind(
    page: Page,
    github: Parameters<typeof openMyWork>[1],
    files: readonly SampleReviewFile[],
): Promise<ReviewScreenHarness> {
    await openMyWork(page, github, createSampleMyWork().world);
    answerReview(github, { repository: 'acme/web', number: 15, files });
    const review = new ReviewScreenHarness(page);
    await page.goto(ADDRESS);
    await expect(review.cursorRow).toBeAttached();
    await expect(page.getByText(/Fetching file contents/u)).toHaveCount(0);
    return review;
}

/** The current match is on the line `text`, and the cursor on its row. */
async function expectCursorOnMatch(review: ReviewScreenHarness, text: string) {
    await expect(review.currentMatchRow).toContainText(text);
    await expect.poll(() => review.cursorKey()).toBe(await review.currentMatchKey());
}

/** The counter says `count` matches, and the code marks as many: a file added, so no line shows twice. */
async function expectMatches(review: ReviewScreenHarness, count: number) {
    await expect(review.findCounter).toHaveText(new RegExp(`^\\d+\\s+of\\s+${count}$`, 'u'));
    await expect(review.findMarks).toHaveCount(count);
}

function numbered(count: number) {
    return Array.from({ length: count }, (_, index) => `const line${index + 1} = ${index + 1};`);
}
