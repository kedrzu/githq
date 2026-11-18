import { createSampleEditableWork } from '../edits/sampleEditableWork.js';
import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

// The reading cursor over an opened item's thread (D44): on its page the keys move it and act on its stop; in the panel
// beside a list they stay the list's.

const ISSUE = 'Sign-in loops after the token expires';
const FIRST_COMMENT = 'Seen it twice today.';
const SECOND_COMMENT = 'Happens on mobile too.';

test('on its page the cursor opens on the description and ] [ step from comment to comment, staying at the last', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    sample.world.comment(sample.issue, { author: 'hubot', body: FIRST_COMMENT, minutesAgo: 4 });
    sample.world.comment(sample.issue, { author: 'monalisa', body: SECOND_COMMENT, minutesAgo: 3 });
    const { myWork } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await expect(item.title).toHaveText(ISSUE);
    await page.keyboard.press('Shift+Enter');
    await expect(item.backToPanelButton).toBeVisible();

    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', 'description');
    await page.keyboard.press(']');
    await expect(item.readingCursor).toContainText(FIRST_COMMENT);
    await page.keyboard.press(']');
    await expect(item.readingCursor).toContainText(SECOND_COMMENT);
    await page.keyboard.press(']');
    await expect(item.readingCursor).toContainText(SECOND_COMMENT);
    await page.keyboard.press('[');
    await expect(item.readingCursor).toContainText(FIRST_COMMENT);
});

test("in the panel beside a repository's list, ↓ ↑ move the list's row and ] its section, and no stop is marked", async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    const repository = new RepositoryScreenHarness(page);
    const item = new ItemViewHarness(page);
    await page.goto(`/${SAMPLE_REPOSITORY}/issues`);
    await repository.row('Crash on start').click();
    await expect(item.title).toHaveText('Crash on start');
    await expect(item.fullScreenButton).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await expect(repository.selectedRow).toContainText('Add a dark theme');
    await expect(item.title).toHaveText('Add a dark theme');
    await page.keyboard.press('ArrowUp');
    await expect(repository.selectedRow).toContainText('Crash on start');
    await expect(item.readingCursor).toHaveCount(0);

    await page.keyboard.press(']');
    await expect(page).toHaveURL(new RegExp(`/${SAMPLE_REPOSITORY}/pulls`));
    await expect(repository.section('Pull requests')).toHaveAttribute('aria-pressed', 'true');
});
