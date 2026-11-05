import { expect, test } from '../fixtures.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { MergePanelHarness } from '../harnesses/MergePanel.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { selectRow } from '../myWork/selectRow.js';

import { getMergeRequests } from './getMergeRequests.js';
import { createSampleMergeableWork, FIRST_TITLE, PROPOSED_TITLE, SECOND_TITLE } from './sampleMergeableWork.js';

/** A pull request of acme/web the viewer may merge that my work does not list. */
const OUTSIDE = 'Trim the access log';

test("⇧M on the selected row merges with the default method and GitHub's text: being merged until GitHub says merged, then it leaves my work", async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);
    // The repository's default, though Squash is listed first.
    await expect(panel.method('Merge commit')).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);

    const release = sample.world.holdMerges();
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    // Unedited text is GitHub's to write: neither the title nor the message is sent.
    expect(getMergeRequests(github)).toEqual([{ merge_method: 'merge', sha: sample.world.headOf(sample.first) }]);
    await expect(myWork.selectedRow).toContainText(SECOND_TITLE);
    const row = myWork.row(FIRST_TITLE);
    await expect(row).toContainText('Being merged');
    await expect(row.getByRole('img', { name: 'Open pull request' })).toBeVisible();
    expect(sample.world.stateOf(sample.first).merged).toBe(false);
    await expect(shell.statusBar).toContainText('Merge on the way · acme/web#15');

    // My work lists open work only: merged, it leaves it.
    release();
    await expect(row).toHaveCount(0, { timeout: 10_000 });
    await expect(shell.myWorkCount('My pull requests')).toHaveText('1');
    await expect(myWork.selectedRow).toContainText(SECOND_TITLE);
    expect(sample.world.stateOf(sample.first).merged).toBe(true);
    expect(sample.world.stateOf(sample.second).merged).toBe(false);
    // PM34: the user moved on, so the confirmation comes to them — short, and gone by itself.
    const merged = shell.toasts.filter({ hasText: 'acme/web#15 merged into main' });
    await expect(merged).toBeVisible();
    await expect(merged).toBeHidden({ timeout: 10_000 });
    await expect(shell.toasts).toHaveCount(0);
});

test("PM8: closing the panel takes back a ⌘↵ still waiting for the repository's merge settings: nothing is sent", async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    github.holdAnswers();
    await page.keyboard.press('Shift+M');
    await expect(panel.root).toBeVisible();
    await page.keyboard.press('ControlOrMeta+Enter');
    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();
    github.releaseAnswers();

    await expect.poll(() => github.graphqlCalls.some(call => call.name === 'RepositoryMetadata')).toBe(true);
    await page.keyboard.press('Shift+M');
    await expect(panel.method('Merge commit')).toHaveAttribute('aria-pressed', 'true');
    expect(getMergeRequests(github)).toEqual([]);
});

test('⇧M on the opened pull request sends the title edited with E, and its standing waits for GitHub', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    const panel = new MergePanelHarness(page);
    await myWork.row(FIRST_TITLE).click();
    await expect(item.mergeButton).toBeVisible();

    await page.keyboard.press('Shift+M');
    // GitHub's proposal is in: the read arrived.
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);
    await page.keyboard.press('e');
    await expect(panel.titleField).toHaveValue(PROPOSED_TITLE);
    await panel.titleField.fill('Redirect once, keeping the return address');
    const release = sample.world.holdMerges();
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    expect(getMergeRequests(github)).toEqual([
        {
            merge_method: 'merge',
            sha: sample.world.headOf(sample.first),
            commit_title: 'Redirect once, keeping the return address',
        },
    ]);
    // Sent, the panel moves on at once (PM32a); back on it, it says it waits for GitHub.
    await expect(item.title).toHaveText(SECOND_TITLE);
    await page.keyboard.press('k');
    await expect(item.title).toHaveText(FIRST_TITLE);
    await expect(item.root).toContainText('Being merged');
    await expect(item.root).toContainText('Waiting for GitHub');
    await expect(item.mergeButton).toHaveCount(0);
    await expect(item.statePill('Open')).toBeVisible();

    release();
    await expect(item.statePill('Merged')).toBeVisible();
    await expect(item.root).not.toContainText('Being merged');
    expect(sample.world.stateOf(sample.first).merged).toBe(true);
    // The panel left at GitHub's answer: the confirmation is a toast, the only one.
    await expect(shell.toasts).toHaveCount(1);
    await expect(shell.toasts).toContainText('acme/web#15 merged into main');
});

test('⇧M on a pull request opened by its address, outside my work, opens the panel and merges it; the status bar says the merge is on the way', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork();
    const outside = sample.world.pullRequest({
        repository: 'acme/web',
        number: 17,
        title: OUTSIDE,
        foundBy: [],
        reviewDecision: 'APPROVED',
        minutesAgo: 30,
    });
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    const panel = new MergePanelHarness(page);
    await expect(myWork.row(OUTSIDE)).toHaveCount(0);

    await page.goto('/acme/web/pull/17');
    await expect(item.title).toHaveText(OUTSIDE);
    await expect(item.mergeButton).toBeVisible();
    await page.keyboard.press('Shift+M');
    await expect(panel.line('Commit')).toContainText('Merge pull request #17');
    const release = sample.world.holdMerges();
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    expect(getMergeRequests(github)).toEqual([{ merge_method: 'merge', sha: sample.world.headOf(outside) }]);
    await expect(shell.statusBar).toContainText('Merge on the way');
    release();
    await expect(item.statePill('Merged')).toBeVisible({ timeout: 10_000 });
});

test('PM24: ⇧M on a pull request being merged opens the panel in its being-merged state, with the method sent and no primary action', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);
    const release = sample.world.holdMerges();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeHidden();
    await expect(myWork.selectedRow).toContainText(SECOND_TITLE);

    // Back on it: the row still reads being merged.
    await page.keyboard.press('k');
    await expect(myWork.selectedRow).toContainText(FIRST_TITLE);
    await page.keyboard.press('Shift+M');
    await expect(panel.root).toContainText('Being merged');
    await expect(panel.line('Method')).toContainText('Merge commit');
    await expect(panel.line('Commit')).toHaveCount(0);
    await expect(panel.root.getByRole('button', { name: /merge/i })).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+Enter');
    expect(getMergeRequests(github)).toHaveLength(1);

    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();
    release();
    await expect(myWork.row(FIRST_TITLE)).toHaveCount(0, { timeout: 10_000 });
});

test('D9, PM32a: one pull request checked and merged with ⇧M is unchecked once sent, and the list moves past it', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);
    await page.keyboard.press('x');
    await expect(page.getByRole('toolbar')).toContainText('1 selected');

    await page.keyboard.press('Shift+M');
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);
    const release = sample.world.holdMerges();
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    await expect(page.getByRole('toolbar')).toHaveCount(0);
    await expect(myWork.selectedRow).toContainText(SECOND_TITLE);
    release();
    await expect(myWork.row(FIRST_TITLE)).toHaveCount(0, { timeout: 10_000 });
});

test('a merge GitHub refuses at once keeps the panel open with the edited text and says why; nothing is being merged', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork();
    const reason = 'Repository rule violations found. Changes must be made through a pull request.';
    sample.world.refuseMerge(sample.first, reason);
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    // GitHub's proposal is in: the read arrived.
    await expect(panel.line('Commit')).toContainText(PROPOSED_TITLE);
    await page.keyboard.press('e');
    await panel.titleField.fill('Redirect once, keeping the return address');
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.refusal).toHaveText(reason);
    await expect(panel.root).toContainText('GitHub refused the merge');
    await expect(panel.titleField).toHaveValue('Redirect once, keeping the return address');
    expect(getMergeRequests(github)).toHaveLength(1);

    // Out of the field, then out of the panel: the list stayed on the pull request.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();
    await expect(myWork.selectedRow).toContainText(FIRST_TITLE);
    await expect(myWork.row(FIRST_TITLE)).not.toContainText('Being merged');
    expect(sample.world.stateOf(sample.first).merged).toBe(false);
    // The panel says it: no toast besides.
    await expect(shell.toasts).toHaveCount(0);
});

test('PM35: a merge GitHub refuses after the user moved on reaches them in a toast that stays and says nothing merged; ⌥M goes back to the panel of that pull request with the edited text', async ({
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
    await page.keyboard.press('e');
    await panel.titleField.fill('Redirect once, keeping the return address');
    sample.world.holdMerges();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeHidden();
    await expect(myWork.selectedRow).toContainText(SECOND_TITLE);

    const reason = 'At least 2 approving reviews are required by reviewers with write access.';
    sample.world.refuseHeldMerges(reason);
    await page.clock.fastForward('00:02');

    const toast = shell.toasts.filter({ hasText: "acme/web#15 wasn't merged" });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(`GitHub refused it: “${reason}” Nothing changed on GitHub.`);
    await expect(shell.statusBar.getByRole('button', { name: 'Merge refused · acme/web#15' })).toBeVisible();
    await expect(myWork.row(FIRST_TITLE)).toContainText('Merge refused');
    await expect(myWork.row(FIRST_TITLE)).not.toContainText('Being merged');
    expect(sample.world.stateOf(sample.first).merged).toBe(false);

    // It stays until dismissed, long past an edit's toast — and past the regular refresh, which reads the pull request
    // again: the row then says what GitHub holds.
    await page.clock.fastForward('00:30');
    await expect(toast).toBeVisible();
    await expect(myWork.row(FIRST_TITLE)).not.toContainText('Merge refused');

    // ⌥M is the toast's: the panel of the refused pull request, not of the row selected, with the text it was sent with.
    await expect(myWork.selectedRow).toContainText(SECOND_TITLE);
    await page.keyboard.press('Alt+M');
    await expect(panel.root).toHaveAccessibleName('Merge acme/web#15');
    await expect(panel.root).toContainText('Ready to merge');
    await expect(panel.line('Commit')).toContainText('Redirect once, keeping the return address');
    await expect(toast).toBeHidden();
});

test('without write access in the repository nothing offers merging: the standing says so, ⇧M and the palette have nothing', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork({ repository: { viewerPermission: 'READ' } });
    const { myWork } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    const panel = new MergePanelHarness(page);

    await selectRow(myWork, FIRST_TITLE);
    await page.keyboard.press('Shift+M');
    await expect(panel.root).toHaveCount(0);
    await expect(myWork.row(FIRST_TITLE).getByRole('button', { name: 'Merge', exact: true })).toHaveCount(0);

    await page.keyboard.press('Enter');
    await expect(item.title).toHaveText(FIRST_TITLE);
    await expect(item.root).toContainText("You can't merge in this repository");
    await expect(item.mergeButton).toHaveCount(0);
    await page.keyboard.press('Shift+M');
    await expect(panel.root).toHaveCount(0);

    const palette = new CommandMenuHarness(page);
    await palette.open();
    await palette.field.pressSequentially('Merge');
    await expect(palette.option(/^Merge…/)).toHaveCount(0);
    await page.keyboard.press('Escape');
    expect(getMergeRequests(github)).toEqual([]);
});

test('a ruleset allowing only squash narrows the methods to Squash once the panel has read it, and squash is sent', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork({ repository: { rulesetMergeMethods: ['SQUASH'] } });
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    // Said only once the read is in, and the panel offers one method.
    await expect(panel.line('Method')).toContainText('the only method main allows');
    await expect(panel.line('Method')).toContainText('Squash');
    await expect(panel.methods).toHaveCount(0);
    await expect(panel.line('Commit')).toContainText(`${FIRST_TITLE} (#15)`);

    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeHidden();
    expect(getMergeRequests(github)).toEqual([{ merge_method: 'squash', sha: sample.world.headOf(sample.first) }]);
});
