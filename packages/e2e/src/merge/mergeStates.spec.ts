import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { MergePanelHarness } from '../harnesses/MergePanel.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { selectRow } from '../myWork/selectRow.js';

import { getMergeRequests } from './getMergeRequests.js';
import { createSampleMergeableWork, FIRST_TITLE, PROPOSED_TITLE, SECOND_TITLE } from './sampleMergeableWork.js';

/** How much of a commit's sha the panel names it by. */
const SHORT_SHA_LENGTH = 7;
/** Just past the two minutes the app asks GitHub for a merge's result (`MERGE_TIME_LIMIT_MS`). */
const MERGE_TIME_LIMIT = '02:01';

test("PM19: conflicts — the panel says so, and ⌘↵ opens GitHub's conflict editor in a new tab; nothing is merged", async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork({ first: { conflicts: true } });
    github.web('/acme/web/pull/15/conflicts', () => ({ status: 200, body: '<title>Resolve conflicts</title>' }));
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.root).toContainText("Can't merge");
    await expect(panel.root).toContainText("With main. Resolved in GitHub's editor");
    await expect(panel.primary).toContainText('Resolve on GitHub');

    const popup = page.waitForEvent('popup');
    await page.keyboard.press('ControlOrMeta+Enter');
    expect((await popup).url()).toBe('https://github.com/acme/web/pull/15/conflicts');

    await expect(panel.root).toBeVisible();
    expect(getMergeRequests(github)).toEqual([]);
    expect(sample.world.stateOf(sample.first).merged).toBe(false);
});

test('PM20: behind a base branch that requires being up to date — ⌘↵ updates the branch from the head shown, the panel stays, and merging comes back once GitHub says it is up to date', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork({ repository: { requiresUpToDate: true }, first: { behindBase: true } });
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);
    const shown = sample.world.headOf(sample.first);

    await page.keyboard.press('Shift+M');
    await expect(panel.root).toContainText('Behind main');
    await expect(panel.primary).toContainText('Update branch');

    const release = sample.world.holdEdits();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toContainText('Updating the branch');
    await expect(panel.primary).toContainText('Update branch');
    expect(getMergeRequests(github)).toEqual([]);
    const reads = countMergeOptionsReads();
    release();

    // GitHub answers the update with the old head, still working out whether it merges: the panel keeps updating and
    // ⌘↵ merges nothing, until a read again finds the head moved.
    await expect.poll(countMergeOptionsReads).toBe(reads + 1);
    await expect(panel.root).toContainText('Updating the branch');
    await page.keyboard.press('ControlOrMeta+Enter');
    expect(getMergeRequests(github)).toEqual([]);

    // The panel read it again: up to date, at the merge commit that brought main in.
    await expect(panel.root).not.toContainText('Behind main');
    await expect(panel.root).toContainText('Ready to merge');
    await expect(panel.primary).toContainText('Merge');
    await expect(panel.primary).not.toContainText('Update branch');
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);
    expect(updateBranchCalls()).toEqual([
        { pullRequestId: sample.first, expectedHeadOid: shown, updateMethod: 'MERGE' },
    ]);
    const updated = sample.world.headOf(sample.first);
    expect(updated).not.toBe(shown);

    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeHidden();
    expect(getMergeRequests(github)).toEqual([{ merge_method: 'merge', sha: updated }]);
    await expect(myWork.row(FIRST_TITLE)).toHaveCount(0, { timeout: 10_000 });
    expect(sample.world.stateOf(sample.first).merged).toBe(true);

    expect(countMergeOptionsReads()).toBeGreaterThanOrEqual(reads + 2);

    function updateBranchCalls() {
        return github.graphqlCalls.filter(call => call.name === 'UpdatePullRequestBranch').map(call => call.variables);
    }

    function countMergeOptionsReads() {
        return github.graphqlCalls.filter(call => call.name === 'PullRequestMergeOptions').length;
    }
});

test('PM21: a draft — ⌘↵ marks it ready for review, then the panel offers the merge, and ⌘↵ merges', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork({ first: { isDraft: true } });
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.root).toContainText('Mark it ready for review first');
    await expect(panel.primary).toContainText('Mark ready for review');
    await expect(panel.line('Commit')).toHaveCount(0);

    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toContainText('Ready to merge');
    await expect(panel.primary).not.toContainText('Mark ready for review');
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);
    expect(sample.world.stateOf(sample.first).isDraft).toBe(false);
    expect(getMergeRequests(github)).toEqual([]);

    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeHidden();
    expect(getMergeRequests(github)).toEqual([{ merge_method: 'merge', sha: sample.world.headOf(sample.first) }]);
    await expect(myWork.row(FIRST_TITLE)).toHaveCount(0, { timeout: 10_000 });
});

test('PM22: while GitHub is still working out whether it merges, the panel says it is not known and ⌘↵ still merges', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork({ first: { mergeabilityUnknown: true } });
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);
    await expect(panel.root).toContainText('GitHub is computing');
    await expect(panel.root).toContainText('Not known yet');

    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeHidden();
    expect(getMergeRequests(github)).toEqual([{ merge_method: 'merge', sha: sample.world.headOf(sample.first) }]);
    await expect(myWork.row(FIRST_TITLE)).toHaveCount(0, { timeout: 10_000 });
});

test('PM27: a commit pushed after the panel read the head — GitHub refuses the merge, and the panel says a new commit arrived and nothing merged, not a plain refusal; ⌘↵ then merges the new head', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    // GitHub's proposal is in: the read arrived, with the head the merge names.
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);
    const asked = sample.world.headOf(sample.first);
    const pushed = sample.world.push(sample.first, 'monalisa', 'Keep the return address');
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toContainText('A new commit arrived, so nothing was merged');
    await expect(panel.root).not.toContainText('GitHub refused the merge');
    await expect(panel.refusal).toContainText(`monalisa pushed ${pushed.slice(0, SHORT_SHA_LENGTH)}`);
    await expect(panel.refusal).toContainText('“Keep the return address”');
    await expect(panel.refusal).toContainText(`You asked to merge ${asked.slice(0, SHORT_SHA_LENGTH)}`);
    expect(getMergeRequests(github)).toEqual([{ merge_method: 'merge', sha: asked }]);
    expect(sample.world.stateOf(sample.first).merged).toBe(false);

    // The panel said it: the row says it too — who pushed, from the panel's read — and no toast besides.
    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();
    await expect(myWork.row(FIRST_TITLE)).toContainText('Not merged · new commit from monalisa');
    await expect(myWork.row(FIRST_TITLE)).not.toContainText('Merge refused');
    await expect(shell.toasts).toHaveCount(0);

    // Back in the panel, the new commit is ready as well: the next merge names it.
    await page.keyboard.press('Shift+M');
    await expect(panel.root).toContainText('A new commit arrived, so nothing was merged');
    await expect(panel.primary).toContainText('Merge');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeHidden();
    expect(getMergeRequests(github)).toEqual([
        { merge_method: 'merge', sha: asked },
        { merge_method: 'merge', sha: pushed },
    ]);
    await expect(myWork.row(FIRST_TITLE)).toHaveCount(0, { timeout: 10_000 });
});

test('PM27, PM38: refused for a new commit from the opened pull request — its standing names who pushed it, and leads back to the merge', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    const panel = new MergePanelHarness(page);
    await myWork.row(FIRST_TITLE).click();
    await expect(item.mergeButton).toBeVisible();

    await page.keyboard.press('Shift+M');
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);
    sample.world.push(sample.first, 'monalisa', 'Keep the return address');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toContainText('A new commit arrived, so nothing was merged');
    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();

    await expect(item.root).toContainText('Not merged');
    await expect(item.root).toContainText('New commit from monalisa');
    await expect(item.root.getByRole('button', { name: 'Back to the merge' })).toBeVisible();
    await expect(myWork.row(FIRST_TITLE)).toContainText('Not merged · new commit from monalisa');
});

test('PM29: a merge GitHub accepted with no answer in time, after the user moved on, reads grey in the row and the status bar — outcome not known, not merged, not failed — with no toast', async ({
    page,
    github,
}) => {
    await page.clock.install();
    const sample = createSampleMergeableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);
    sample.world.holdMerges();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeHidden();
    await expect(myWork.selectedRow).toContainText(SECOND_TITLE);
    const row = myWork.row(FIRST_TITLE);
    await expect(row).toContainText('Being merged');

    // Past the two minutes the app asks GitHub for the merge's result.
    await page.clock.fastForward(MERGE_TIME_LIMIT);

    await expect(row).toContainText('Merge sent · outcome not known yet');
    await expect(row).not.toContainText('Being merged');
    await expect(row).not.toContainText('Merge refused');
    await expect(shell.statusBar).toContainText(
        "acme/web#15 · GitHub hasn't answered · the next refresh will settle it",
    );
    await expect(shell.toasts).toHaveCount(0);
    expect(getMergeRequests(github)).toHaveLength(1);
    expect(sample.world.stateOf(sample.first).merged).toBe(false);
});

test('PM29: a merge GitHub accepted with no answer in time while its panel is open says the outcome is not known and offers no second merge, only GitHub', async ({
    page,
    github,
}) => {
    await page.clock.install();
    const sample = createSampleMergeableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);
    sample.world.holdMerges();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeHidden();

    // Back on it while it is being merged (PM24), its read in, until the time runs out.
    await page.keyboard.press('k');
    await expect(myWork.selectedRow).toContainText(FIRST_TITLE);
    await page.keyboard.press('Shift+M');
    await expect(panel.root).toContainText('Being merged');
    await expect(panel.root).not.toContainText('Reading');
    await page.clock.fastForward(MERGE_TIME_LIMIT);

    await expect(panel.root).toContainText('Outcome not known yet');
    await expect(panel.root).toContainText("GitHub hasn't answered · not shown as merged");
    await expect(panel.root).toContainText('The next refresh will settle this');
    await expect(panel.root.getByRole('link', { name: /Open on GitHub/ })).toHaveAttribute(
        'href',
        'https://github.com/acme/web/pull/15',
    );
    await expect(panel.primary).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+Enter');
    expect(getMergeRequests(github)).toHaveLength(1);

    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();
    await expect(myWork.row(FIRST_TITLE)).toContainText('Merge sent · outcome not known yet');
    await expect(shell.statusBar).toContainText(
        "acme/web#15 · GitHub hasn't answered · the next refresh will settle it",
    );
    await expect(shell.toasts).toHaveCount(0);
    expect(getMergeRequests(github)).toHaveLength(1);
});

test("PM29: back in the panel after the time limit, the panel's own read does not settle it — it stays grey and offers no second merge until the regular refresh reads the pull request", async ({
    page,
    github,
}) => {
    await page.clock.install();
    const sample = createSampleMergeableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);
    sample.world.holdMerges();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeHidden();
    await page.clock.fastForward(MERGE_TIME_LIMIT);
    const row = myWork.row(FIRST_TITLE);
    await expect(row).toContainText('Merge sent · outcome not known yet');

    // Back on it: the panel reads the pull request again, and writes the status it read into the row.
    await page.keyboard.press('k');
    await expect(myWork.selectedRow).toContainText(FIRST_TITLE);
    const reads = countMergeOptionsReads();
    await page.keyboard.press('Shift+M');
    await expect.poll(countMergeOptionsReads).toBe(reads + 1);
    await expect(panel.root).not.toContainText('Reading');

    await expect(panel.root).toContainText('Outcome not known yet');
    await expect(panel.root).not.toContainText('Ready to merge');
    await expect(panel.primary).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeVisible();
    expect(getMergeRequests(github)).toHaveLength(1);
    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();
    await expect(row).toContainText('Merge sent · outcome not known yet');

    // The regular refresh reads the pull request: still open, it is free to merge again.
    await page.clock.fastForward('01:01');
    await expect(row).not.toContainText('outcome not known yet');
    await page.keyboard.press('Shift+M');
    await expect(panel.root).toContainText('Ready to merge');
    await expect(panel.primary).toContainText('Merge');
    expect(getMergeRequests(github)).toHaveLength(1);

    function countMergeOptionsReads() {
        return github.graphqlCalls.filter(call => call.name === 'PullRequestMergeOptions').length;
    }
});
