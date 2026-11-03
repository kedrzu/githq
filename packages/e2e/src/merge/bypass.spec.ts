import { expect, test } from '../fixtures.js';
import { MergePanelHarness } from '../harnesses/MergePanel.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { selectRow } from '../myWork/selectRow.js';

import { getMergeRequests } from './getMergeRequests.js';
import { getOperationCalls } from './getOperationCalls.js';
import { createSampleMergeableWork, FIRST_TITLE } from './sampleMergeableWork.js';

test('D12, PM12a: ⌥⌘↵ merges past what isn’t met and says so; ⌘↵ never does', async ({ page, github }) => {
    const sample = createSampleMergeableWork({
        repository: { viewerCanMergeAsAdmin: true },
        first: { reviewDecision: 'REVIEW_REQUIRED' },
    });
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.bypassButton).toBeVisible();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeVisible();
    expect(getMergeRequests(github)).toEqual([]);

    await page.keyboard.press('Alt+ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    expect(getMergeRequests(github)).toEqual([
        { merge_method: 'merge', sha: sample.world.headOf(sample.first), bypass_rules: true },
    ]);
    await expect.poll(() => sample.world.stateOf(sample.first).merged).toBe(true);
});

test('PM12a: not offered without `viewerCanMergeAsAdmin`, and ⌥⌘↵ asks for nothing', async ({ page, github }) => {
    const sample = createSampleMergeableWork({ first: { reviewDecision: 'REVIEW_REQUIRED' } });
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect.poll(() => getOperationCalls(github, 'PullRequestMergeOptions').length).toBeGreaterThan(0);
    await expect(panel.root).toContainText('Not ready yet');
    await expect(panel.bypassButton).toHaveCount(0);
    await page.keyboard.press('Alt+ControlOrMeta+Enter');

    await expect(panel.root).toBeVisible();
    expect(getMergeRequests(github)).toEqual([]);
});
