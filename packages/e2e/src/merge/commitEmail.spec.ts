import { expect, test } from '../fixtures.js';
import { MergePanelHarness } from '../harnesses/MergePanel.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { selectRow } from '../myWork/selectRow.js';

import { getMergeRequests } from './getMergeRequests.js';
import { getOperationCalls } from './getOperationCalls.js';
import { createSampleMergeableWork, FIRST_TITLE } from './sampleMergeableWork.js';

const DEFAULT_EMAIL = 'mona@acme.dev';
const OTHER_EMAIL = 'mona@personal.dev';

test('D5, PM6: a chosen address goes through `mergePullRequest` with the head the user saw', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork({ repository: { commitEmails: [DEFAULT_EMAIL, OTHER_EMAIL] } });
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.line('Email')).toContainText(DEFAULT_EMAIL);
    await page.keyboard.press('y');
    await expect(panel.line('Email')).toContainText(OTHER_EMAIL);
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    expect(getOperationCalls(github, 'MergePullRequest')).toEqual([
        {
            pullRequestId: sample.first,
            expectedHeadOid: sample.world.headOf(sample.first),
            mergeMethod: 'MERGE',
            authorEmail: OTHER_EMAIL,
        },
    ]);
    expect(getMergeRequests(github)).toEqual([]);
    expect(sample.world.stateOf(sample.first).merged).toBe(true);
});

test('D5: the default stays on REST, with no address sent', async ({ page, github }) => {
    const sample = createSampleMergeableWork({ repository: { commitEmails: [DEFAULT_EMAIL, OTHER_EMAIL] } });
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.line('Email')).toContainText(DEFAULT_EMAIL);
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    expect(getMergeRequests(github)).toEqual([{ merge_method: 'merge', sha: sample.world.headOf(sample.first) }]);
    expect(getOperationCalls(github, 'MergePullRequest')).toEqual([]);
});
