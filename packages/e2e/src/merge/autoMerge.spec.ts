import { expect, test } from '../fixtures.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { MergePanelHarness } from '../harnesses/MergePanel.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { selectRow } from '../myWork/selectRow.js';

import { getMergeRequests } from './getMergeRequests.js';
import { getOperationCalls } from './getOperationCalls.js';
import { createSampleMergeableWork, FIRST_TITLE } from './sampleMergeableWork.js';

/** The first pull request waits for a review, in a repository that allows auto-merge. */
function createWaitingWork() {
    return createSampleMergeableWork({
        repository: { autoMergeAllowed: true },
        first: { reviewDecision: 'REVIEW_REQUIRED' },
    });
}

test('PM10, PM11: not met, ⌘↵ turns auto-merge on with the method and the text edited, then turns it off; nothing merges', async ({
    page,
    github,
}) => {
    const sample = createWaitingWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.primary).toHaveAccessibleName('Enable auto-merge');
    await expect(panel.method('Squash')).toBeVisible();
    await page.keyboard.press('1');
    await expect(panel.method('Squash')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('e');
    await panel.titleField.fill('Redirect once, by itself');
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.primary).toHaveAccessibleName('Turn off auto-merge');
    expect(getOperationCalls(github, 'EnablePullRequestAutoMerge')).toEqual([
        expect.objectContaining({
            pullRequestId: sample.first,
            mergeMethod: 'SQUASH',
            commitHeadline: 'Redirect once, by itself',
            expectedHeadOid: sample.world.headOf(sample.first),
        }),
    ]);
    expect(sample.world.autoMergeOf(sample.first)).toMatchObject({
        mergeMethod: 'SQUASH',
        commitHeadline: 'Redirect once, by itself',
    });
    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();
    await expect(myWork.row(FIRST_TITLE)).toContainText('auto-merge on · squash');

    await page.keyboard.press('Shift+M');
    await expect(panel.primary).toHaveAccessibleName('Turn off auto-merge');
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.primary).toHaveAccessibleName('Enable auto-merge');
    expect(getOperationCalls(github, 'DisablePullRequestAutoMerge')).toEqual([{ pullRequestId: sample.first }]);
    expect(sample.world.autoMergeOf(sample.first)).toBeNull();
    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();
    await expect(myWork.row(FIRST_TITLE)).not.toContainText('auto-merge on');
    expect(getMergeRequests(github)).toEqual([]);
    expect(sample.world.stateOf(sample.first).merged).toBe(false);
});

test('D11, SP52: never offered on a stacked pull request, though GitHub says the viewer may; ⌘↵ asks for nothing', async ({
    page,
    github,
}) => {
    const stackName = 'Read the stack of each pull request';
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    world.repository('acme/web', { defaultMergeMethod: 'SQUASH', autoMergeAllowed: true });
    world.stack({
        repository: 'acme/web',
        number: 1,
        pullRequests: [
            { number: 41, title: stackName, foundBy: ['authored'], reviewDecision: 'REVIEW_REQUIRED', minutesAgo: 30 },
            {
                number: 42,
                title: 'Fold a stack',
                foundBy: ['authored'],
                reviewDecision: 'REVIEW_REQUIRED',
                minutesAgo: 20,
            },
        ],
    });
    const { myWork } = await openMyWork(page, github, world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, stackName);

    await page.keyboard.press('Shift+M');
    await expect(panel.stackMembers).toHaveCount(2);
    await expect.poll(() => getOperationCalls(github, 'PullRequestMergeOptions').length).toBeGreaterThan(0);
    await expect(panel.root).not.toContainText('Enable auto-merge');
    await page.keyboard.press('ControlOrMeta+Enter');

    // With one going, the merge is an ordinary one: still none.
    await page.keyboard.press('ArrowUp');
    await expect(panel.root).not.toContainText('Enable auto-merge');
    await page.keyboard.press('ControlOrMeta+Enter');

    expect(getOperationCalls(github, 'EnablePullRequestAutoMerge')).toEqual([]);
});
