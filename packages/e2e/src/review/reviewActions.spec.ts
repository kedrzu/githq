import { expect, test } from '../fixtures.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { MergePanelHarness } from '../harnesses/MergePanel.harness.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { createSampleMergeableWork, PROPOSED_TITLE, SECOND_TITLE } from '../merge/sampleMergeableWork.js';
import { openMyWork } from '../myWork/openMyWork.js';

import { answerReview } from './answerReview.js';

const REVIEW_ADDRESS = '/acme/web/pull/15/files';

test("the review offers the pull request's actions: ⇧M opens its merge panel, and ⌘K names it and lists them", async ({
    page,
    github,
}) => {
    await openReview(page, github);
    const panel = new MergePanelHarness(page);
    const menu = new CommandMenuHarness(page);

    await page.keyboard.press('Shift+M');
    await expect(panel.root).toHaveAccessibleName('Merge acme/web#15');
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);
    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();
    await expect(page).toHaveURL(REVIEW_ADDRESS);

    await menu.open();
    await expect(menu.chip('web#15')).toBeVisible();
    await expect(menu.option(/Close pull request/)).toBeVisible();
    await expect(menu.option(/Next file/)).toBeVisible();
});

test('an item opened over the review has the keys: ⇧M merges it, not the pull request reviewed', async ({
    page,
    github,
}) => {
    await openReview(page, github);
    const panel = new MergePanelHarness(page);

    await page.goto(`${REVIEW_ADDRESS}?pane=issue&issue=acme|web|16`);
    await expect(new ItemViewHarness(page).title).toHaveText(SECOND_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.root).toHaveAccessibleName('Merge acme/web#16');
});

test("an item opened over the review has ⇧S: it submits the item's draft review, not the one of the pull request reviewed", async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork();
    const review = await openReview(page, github, sample);
    sample.world.setPendingReview(sample.second, { comments: 1, minutesAgo: 5 });
    answerReview(github, {
        repository: 'acme/web',
        number: 16,
        id: sample.second,
        files: [],
        threads: [
            {
                id: 'T_mine',
                path: 'src/cache.ts',
                line: 1,
                comments: ['<p>Mine, not sent yet.</p>'],
                pending: true,
                author: 'octocat',
            },
        ],
    });

    await page.goto(`${REVIEW_ADDRESS}?pane=issue&issue=acme|web|16`);
    const item = new ItemViewHarness(page);
    await expect(item.title).toHaveText(SECOND_TITLE);
    await expect(item.entry('Mine, not sent yet.')).toContainText(/^Your review\s*pending/u);

    await page.keyboard.press('Shift+S');
    await expect(review.submitDialog).toHaveAccessibleName('Submit your review of #16');
});

/** Signs in with two pull requests the viewer may merge and opens the review of the first, acme/web#15. */
async function openReview(
    page: Parameters<typeof openMyWork>[0],
    github: Parameters<typeof openMyWork>[1],
    sample = createSampleMergeableWork(),
) {
    await openMyWork(page, github, sample.world);
    answerReview(github, {
        repository: 'acme/web',
        number: 15,
        id: sample.first,
        files: [{ path: 'src/a.ts', before: 'const a = 1;\n', after: 'const a = 2;\n' }],
    });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.fileRow('a.ts')).toBeVisible();
    return review;
}
