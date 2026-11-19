import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

import { answerReview } from './answerReview.js';
import type { SampleReviewFile } from './answerReview.js';

// Go to file (⌘P, code-review D48, CR144–CR148): the review's command whose level of the command menu finds the pull
// request's files by scattered letters and goes to the one picked; its key runs from a comment box and the open menu
// (commands D15) and is not githq's anywhere else.

const ADDRESS = '/acme/web/pull/15/files';
const LINES = Array.from({ length: 300 }, (_, index) => `const line${index + 1} = ${index + 1};`);

/**
 * Its folder holds every letter of `rvwfl`, its name not all of them: found after a name that does. Last in the list's
 * order, with rows enough below the file before it for that file's header to reach the top.
 */
const IN_FOLDER: SampleReviewFile = {
    path: 'src/review/files/list.ts',
    before: `${LINES.join('\n')}\n`,
    after: `${LINES.map(line => `${line} // listed`).join('\n')}\n`,
};
/** First in the list's order, its rows enough that the files after it are not drawn when the review opens. */
const LONG: SampleReviewFile = {
    path: 'app/engine.ts',
    before: `${LINES.join('\n')}\n`,
    after: `${LINES.map(line => `${line} // changed`).join('\n')}\n`,
};
const TARGET: SampleReviewFile = {
    path: 'packages/app/review/ReviewFileList.vue',
    before: '<template>old</template>\n',
    after: '<template>new</template>\n',
};
const VIEWED: SampleReviewFile = {
    path: 'docs/sync.md',
    before: 'Old words.\n',
    after: 'New words.\n',
    viewed: 'VIEWED',
};
const FILES = [IN_FOLDER, LONG, TARGET, VIEWED];

test('⌘P opens the menu at Go to file with every file of the pull request, the cursor’s checked, and keeps it from the browser (CR144)', async ({
    page,
    github,
}) => {
    const { review, menu } = await openReview(page, github);
    await review.fileRow('list.ts').click();
    await expect(review.currentFileRow).toContainText('list.ts');
    const prevented = await watchModP(page);

    await page.keyboard.press('ControlOrMeta+p');

    await expect(goToFileField(menu)).toBeFocused();
    // The file list's order, folder by folder.
    await expect(menu.root.getByRole('option')).toHaveText([
        /engine\.ts/u,
        /sync\.md/u,
        /ReviewFileList/u,
        /list\.ts/u,
    ]);
    await expect(menu.option(/current$/u)).toHaveCount(1);
    await expect(menu.option(/current$/u)).toContainText('src/review/files');
    expect(await prevented()).toBe(true);
});

test('scattered letters list the file first; Enter lands its header at the top of the diff with the cursor on it (CR145)', async ({
    page,
    github,
}) => {
    const { review, menu } = await openReview(page, github);
    await expect(review.fileHeader(TARGET.path)).toHaveCount(0);

    await page.keyboard.press('ControlOrMeta+p');
    await goToFileField(menu).pressSequentially('rvwfl');
    await expect(menu.root.getByRole('option').first()).toContainText('ReviewFileList.vue');
    await expect(menu.option(/list\.ts/u)).toBeVisible();
    await page.keyboard.press('Enter');

    await expect(menu.root).toBeHidden();
    await expect(review.cursorRow.getByRole('heading', { name: TARGET.path, exact: true })).toBeVisible();
    await expect.poll(() => review.headerOffset(TARGET.path)).toBe(0);
    await expect(review.currentFileRow).toContainText('ReviewFileList.vue');
});

test('a file the path filter or "hide viewed" holds back gives way when picked, and the review lands on it', async ({
    page,
    github,
}) => {
    const { review, menu } = await openReview(page, github);

    await test.step('the path filter', async () => {
        await page.keyboard.press('/');
        await page.keyboard.type('engine');
        await page.keyboard.press('Enter');
        await expect(review.fileRow('ReviewFileList.vue')).toHaveCount(0);

        await page.keyboard.press('ControlOrMeta+p');
        await goToFileField(menu).pressSequentially('reviewfilelist');
        await page.keyboard.press('Enter');

        await expect(review.filterField).toHaveValue('');
        await expect(review.cursorRow.getByRole('heading', { name: TARGET.path, exact: true })).toBeVisible();
        await expect.poll(() => review.headerOffset(TARGET.path)).toBe(0);
    });

    await test.step('hide viewed', async () => {
        await review.hideViewedButton.click();
        await expect(review.hideViewedButton).toHaveAttribute('aria-pressed', 'true');
        await expect(review.fileRow('sync.md')).toHaveCount(0);

        await page.keyboard.press('ControlOrMeta+p');
        await goToFileField(menu).pressSequentially('sync.md');
        await page.keyboard.press('Enter');

        await expect(review.hideViewedButton).toHaveAttribute('aria-pressed', 'false');
        await expect(review.cursorRow.getByRole('heading', { name: VIEWED.path, exact: true })).toBeVisible();
        await expect(review.currentFileRow).toContainText('sync.md');
    });
});

test('⌘K lists Go to file with ⌘P on a review, and the open menu moves to its level on ⌘P', async ({
    page,
    github,
}) => {
    const { menu } = await openReview(page, github);

    await menu.open();
    await expect(menu.option(/^Go to file/u).locator('kbd')).toHaveText(/^(Ctrl\+)?P$/u);
    await page.keyboard.press('ControlOrMeta+p');
    await expect(goToFileField(menu)).toBeFocused();
    await expect(menu.option(/ReviewFileList\.vue/u)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu.field).toHaveAccessibleName('Type a command or search…');
});

test('off a review ⌘K has no Go to file and ⌘P is left to the browser', async ({ page, github }) => {
    await openMyWork(page, github, createSampleMyWork().world);
    const menu = new CommandMenuHarness(page);

    await menu.open();
    await menu.field.pressSequentially('go to file');
    await expect(menu.option(/^Go to file/u)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(menu.root).toBeHidden();

    const prevented = await watchModP(page);
    await page.keyboard.press('ControlOrMeta+p');
    expect(await prevented()).toBe(false);
    await expect(menu.root).toBeHidden();
});

test('from a comment box ⌘P opens Go to file and Esc brings the draft back untouched; ⌘A and ⌘Z stay the box’s', async ({
    page,
    github,
}) => {
    const { review, menu } = await openReview(page, github);
    await review.lineNumber(1).click();
    const field = review.commentField('Comment on line 1');
    await expect(field).toBeFocused();
    await field.pressSequentially('Half a thought');

    await page.keyboard.press('ControlOrMeta+p');
    await expect(goToFileField(menu)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu.field).toHaveAccessibleName('Type a command or search…');
    await page.keyboard.press('Escape');
    await expect(menu.root).toBeHidden();
    await expect(field).toHaveValue('Half a thought');
    await expect(field).toBeFocused();

    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('x');
    await expect(field).toHaveValue('x');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(field).toHaveValue('Half a thought');
    await expect(menu.root).toBeHidden();
});

/** The review of {@link FILES}, read whole, its cursor in the first file. */
async function openReview(page: Page, github: GitHubMock) {
    await openMyWork(page, github, createSampleMyWork().world);
    answerReview(github, { repository: 'acme/web', number: 15, files: FILES });
    const review = new ReviewScreenHarness(page);
    await page.goto(ADDRESS);
    await expect(review.cursorRow).toBeAttached();
    await expect(page.getByText(/Fetching file contents/u)).toHaveCount(0);
    return { review, menu: new CommandMenuHarness(page) };
}

/** The field of the menu's Go to file level. */
function goToFileField(menu: CommandMenuHarness) {
    return menu.root.getByRole('textbox', { name: 'Go to file…' });
}

/** Watches the next ⌘P (Ctrl+P): resolves whether the page took it from the browser, once every listener has had it. */
async function watchModP(page: Page): Promise<() => Promise<boolean>> {
    await page.evaluate(() => {
        const watched = window as Window & { modPTaken?: boolean };
        delete watched.modPTaken;
        window.addEventListener('keydown', event => {
            if (event.key.toLowerCase() === 'p' && (event.metaKey || event.ctrlKey)) {
                setTimeout(() => {
                    watched.modPTaken ??= event.defaultPrevented;
                });
            }
        });
    });

    return async () => {
        await expect
            .poll(() => page.evaluate(() => (window as Window & { modPTaken?: boolean }).modPTaken))
            .not.toBeUndefined();
        return await page.evaluate(() => (window as Window & { modPTaken?: boolean }).modPTaken === true);
    };
}
