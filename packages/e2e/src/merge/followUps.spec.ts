import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { expect, test } from '../fixtures.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { MergePanelHarness } from '../harnesses/MergePanel.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { selectRow } from '../myWork/selectRow.js';

import { getOperationCalls } from './getOperationCalls.js';
import { createSampleMergeableWork, FIRST_TITLE, SECOND_TITLE } from './sampleMergeableWork.js';

for (const [key, updateMethod] of [
    ['u', 'MERGE'],
    ['Shift+U', 'REBASE'],
] as const) {
    test(`${key}: a branch behind updates from the list by ${updateMethod}, naming the head shown, and is read until it moved`, async ({
        page,
        github,
    }) => {
        const sample = createSampleMergeableWork({
            repository: { requiresUpToDate: true },
            first: { behindBase: true },
        });
        const head = sample.world.headOf(sample.first);
        const { myWork } = await openMyWork(page, github, sample.world);
        await selectRow(myWork, FIRST_TITLE);

        await page.keyboard.press(key);

        await expect
            .poll(() => getOperationCalls(github, 'UpdatePullRequestBranch'))
            .toEqual([{ pullRequestId: sample.first, expectedHeadOid: head, updateMethod }]);
        await expect.poll(() => sample.world.headOf(sample.first)).not.toBe(head);
    });
}

test('⇧E: failed checks re-run from the list, once per run', async ({ page, github }) => {
    const sample = createSampleMergeableWork({ first: { failingChecks: 1, failedRuns: [71] } });
    const { myWork } = await openMyWork(page, github, sample.world);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+E');

    await expect
        .poll(() => github.restCalls.filter(call => call.url.pathname.endsWith('/rerun-failed-jobs')).length)
        .toBe(1);
});

test('⇧E outside GitHub Actions: nothing is sent, and it says why', async ({ page, github }) => {
    const sample = createSampleMergeableWork({ first: { failingChecks: 1 } });
    const { myWork } = await openMyWork(page, github, sample.world);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+E');

    await expect(page.getByText('None of the checks that failed runs on GitHub Actions')).toBeVisible();
});

test('PM34: a merge confirmed after moving on offers ⌥D, on the pull request merged, not the row selected (D15)', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);
    const land = sample.world.holdMerges();

    await page.keyboard.press('Shift+M');
    await expect(panel.primary).toBeVisible();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeHidden();
    await expect(myWork.selectedRow).toContainText(SECOND_TITLE);
    land();
    await expect(page.getByText('acme/web#15 merged into main', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Delete branch/u })).toBeVisible();

    await page.keyboard.press('Alt+d');

    await expect.poll(() => getOperationCalls(github, 'DeleteRef')).toEqual([{ refId: `REF_${sample.first}` }]);
    expect(await myWork.selectedRow.textContent()).toContain(SECOND_TITLE);
});

test('PM34: "Revert…" opens a new pull request, and its toast leads to it', async ({ page, github }) => {
    const sample = createSampleMergeableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);
    const land = sample.world.holdMerges();

    await page.keyboard.press('Shift+M');
    await expect(panel.primary).toBeVisible();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(myWork.selectedRow).toContainText(SECOND_TITLE);
    land();
    await page.getByRole('button', { name: /^Revert…/u }).click();

    await expect(page.getByText('acme/web#15 reverted by #17')).toBeVisible();
    expect(getOperationCalls(github, 'RevertPullRequest')).toEqual([{ pullRequestId: sample.first }]);
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page).toHaveURL(/\/acme\/web\/pull\/17$/u);
});

test('the palette offers only what applies: a pull request behind updates, and nothing of a merged one', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork({ repository: { requiresUpToDate: true }, first: { behindBase: true } });
    const { myWork } = await openMyWork(page, github, sample.world);
    const menu = new CommandMenuHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await menu.open();

    await expect(menu.option(/^Update branch by rebase/u)).toBeVisible();
    await expect(menu.option(/^Delete branch/u)).toBeHidden();
    await expect(menu.option(/^Revert…/u)).toBeHidden();
    await expect(menu.option(/^Take out of queue/u)).toBeHidden();
});

test('⇧Q in a stack goes to its first open member, whichever row is selected (D11); the whole stack leaves', async ({
    page,
    github,
}) => {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    world.repository('acme/web', { defaultMergeMethod: 'SQUASH', mergeQueueMethod: 'SQUASH' });
    const [first = '', top = ''] = world.stack({
        repository: 'acme/web',
        number: 1,
        pullRequests: [
            {
                number: 41,
                title: 'First of the stack',
                foundBy: ['authored'],
                reviewDecision: 'APPROVED',
                minutesAgo: 30,
            },
            {
                number: 42,
                title: 'Top of the stack',
                foundBy: ['authored'],
                reviewDecision: 'APPROVED',
                minutesAgo: 20,
            },
        ],
    });
    world.enqueue(first);
    world.enqueue(top);
    const { myWork } = await openMyWork(page, github, world);
    await expect(myWork.root).toContainText('First of the stack');
    await page.keyboard.press('j');

    await page.keyboard.press('Shift+Q');

    await expect.poll(() => getOperationCalls(github, 'DequeuePullRequest')).toEqual([{ id: first }]);
    await expect.poll(() => world.queuePositionOf(top)).toBeNull();
});
