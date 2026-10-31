import { createSampleEditableWork } from '../edits/sampleEditableWork.js';
import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';

const MINUTE = 60_000;

test('K3: with the API allowance used up refresh pauses, saying until when and why; edits still go through, and it resumes by itself at the reset', async ({
    page,
    github,
}) => {
    // Time runs as usual, and the polls and the pause can be skipped.
    await page.clock.install();
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);

    // GitHub's answers say the hour's allowance is down to what githq keeps for edits, until 18 minutes from now.
    github.rateLimit = { limit: 5000, remaining: 100, resetAt: new Date(Date.now() + 18 * MINUTE) };
    sample.world.retitle(sample.secondIssue, 'Flaky login test on CI');
    await page.clock.fastForward('00:30');
    // That poll still asked GitHub (more was known to be left then), and heard how little is now.
    await expect(myWork.row('Flaky login test on CI')).toBeVisible();

    sample.world.retitle(sample.thirdIssue, 'Document every keyboard shortcut');
    await page.clock.fastForward('01:00');
    await expect(shell.pausedSegment).toHaveText(/^Paused until\s\d\d:\d\d · 100 left$/);
    // Nothing more is asked of GitHub's GraphQL allowance: the change waits.
    await expect(myWork.row('Document every keyboard shortcut')).toHaveCount(0);
    await expect(shell.statusBar).toContainText(/Not refreshed since\s\d\d:\d\d/);
    await expect(shell.statusBar).toContainText('edits still go through');

    await shell.pausedSegment.click();
    await expect(shell.pausedExplanation).toContainText('Background refresh is');
    await expect(shell.pausedExplanation).toContainText(/your edits still go\sthrough/);
    await expect(shell.pausedExplanation).toContainText(/100 of\s5,000 this hour/);
    await page.screenshot({ path: '../../.context/m6-k3.png' });
    await page.keyboard.press('Escape');
    await expect(shell.pausedExplanation).toBeHidden();

    // An edit goes out during the pause, on what was kept for it.
    const item = new ItemViewHarness(page);
    await myWork.row('Sign-in loops after the token expires').click();
    await expect(item.statePill('Open')).toBeVisible();
    await page.keyboard.press('Shift+X');
    await page.getByRole('menuitem', { name: 'Close as not planned' }).click();
    await expect
        .poll(() => sample.world.stateOf(sample.issue))
        .toMatchObject({ state: 'CLOSED', stateReason: 'NOT_PLANNED' });
    await expect(item.statePill('Not planned')).toBeVisible();
    await expect(shell.failedEdits).toHaveCount(0);

    // At the reset refresh resumes by itself, and the change that waited arrives.
    github.rateLimit = { limit: 5000, remaining: 4999, resetAt: new Date(Date.now() + 78 * MINUTE) };
    await page.clock.fastForward('18:00');
    await expect(shell.pausedSegment).toHaveCount(0);
    await expect(shell.statusBar).toContainText(/4,999 of\s5,000 left this hour/);
    await expect(myWork.row('Document every keyboard shortcut')).toBeVisible();
    await expect(shell.statusBar).toContainText('Up to date');
});
