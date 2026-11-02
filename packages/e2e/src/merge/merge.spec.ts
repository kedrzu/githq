import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import type { GitHubWorldRepositoryParams } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { MergePanelHarness } from '../harnesses/MergePanel.harness.js';
import type { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';

const FIRST = 'Redirect once after sign-in';
const SECOND = 'Cache response headers';
/** What GitHub proposes for the merge commit of {@link FIRST}: its branch, not the fallback the panel writes itself. */
const PROPOSED_TITLE = 'Merge pull request #15 from acme/redirect-once';

test("⇧M on the selected row merges with the default method and GitHub's text: being merged until GitHub says merged, then it leaves my work", async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST);

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
    await expect(myWork.selectedRow).toContainText(SECOND);
    const row = myWork.row(FIRST);
    await expect(row).toContainText('Being merged');
    await expect(row.getByRole('img', { name: 'Open pull request' })).toBeVisible();
    expect(sample.world.stateOf(sample.first).merged).toBe(false);

    // My work lists open work only: merged, it leaves it.
    release();
    await expect(row).toHaveCount(0, { timeout: 10_000 });
    await expect(shell.myWorkCount('My pull requests')).toHaveText('1');
    await expect(myWork.selectedRow).toContainText(SECOND);
    expect(sample.world.stateOf(sample.first).merged).toBe(true);
    expect(sample.world.stateOf(sample.second).merged).toBe(false);
    await expect(shell.toasts).toHaveCount(0);
});

test('⇧M on the opened pull request sends the title edited with E, and its standing waits for GitHub', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    const panel = new MergePanelHarness(page);
    await myWork.row(FIRST).click();
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
    await expect(item.title).toHaveText(FIRST);
    await expect(item.root).toContainText('Being merged');
    await expect(item.root).toContainText('Waiting for GitHub');
    await expect(item.mergeButton).toHaveCount(0);
    await expect(item.statePill('Open')).toBeVisible();

    release();
    await expect(item.statePill('Merged')).toBeVisible();
    await expect(item.root).not.toContainText('Being merged');
    expect(sample.world.stateOf(sample.first).merged).toBe(true);
    await expect(shell.toasts).toHaveCount(0);
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
    await selectRow(myWork, FIRST);

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
    await expect(myWork.selectedRow).toContainText(FIRST);
    await expect(myWork.row(FIRST)).not.toContainText('Being merged');
    expect(sample.world.stateOf(sample.first).merged).toBe(false);
    // The panel says it: no toast besides.
    await expect(shell.toasts).toHaveCount(0);
});

test('without write access in the repository nothing offers merging: the standing says so, ⇧M and the palette have nothing', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork({ viewerPermission: 'READ' });
    const { myWork } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    const panel = new MergePanelHarness(page);

    await selectRow(myWork, FIRST);
    await page.keyboard.press('Shift+M');
    await expect(panel.root).toHaveCount(0);
    await expect(myWork.row(FIRST).getByRole('button', { name: 'Merge', exact: true })).toHaveCount(0);

    await page.keyboard.press('Enter');
    await expect(item.title).toHaveText(FIRST);
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
    const sample = createSampleMergeableWork({ rulesetMergeMethods: ['SQUASH'] });
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST);

    await page.keyboard.press('Shift+M');
    // Said only once the read is in, and the panel offers one method.
    await expect(panel.line('Method')).toContainText('the only method main allows');
    await expect(panel.line('Method')).toContainText('Squash');
    await expect(panel.methods).toHaveCount(0);
    await expect(panel.line('Commit')).toContainText(`${FIRST} (#15)`);

    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeHidden();
    expect(getMergeRequests(github)).toEqual([{ merge_method: 'squash', sha: sample.world.headOf(sample.first) }]);
});

/** The world of the merge tests and the node ids of its pull requests. */
interface SampleMergeableWork {
    readonly world: GitHubWorld;
    /** {@link FIRST} (acme/web#15), approved and ready to merge, at the top of "My pull requests". */
    readonly first: string;
    /** {@link SECOND} (acme/web#16), ready too, the row after it. */
    readonly second: string;
}

/**
 * "My pull requests" of two approved pull requests of acme/web, ready to merge. The repository allows all three
 * methods and starts on a merge commit, unless `repository` says otherwise.
 */
function createSampleMergeableWork(repository: GitHubWorldRepositoryParams = {}): SampleMergeableWork {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    world.repository('acme/web', { defaultMergeMethod: 'MERGE', ...repository });
    const first = world.pullRequest({
        repository: 'acme/web',
        number: 15,
        title: FIRST,
        foundBy: ['authored'],
        reviewDecision: 'APPROVED',
        proposedTexts: { MERGE: { title: PROPOSED_TITLE, body: FIRST } },
        minutesAgo: 5,
    });
    const second = world.pullRequest({
        repository: 'acme/web',
        number: 16,
        title: SECOND,
        foundBy: ['authored'],
        reviewDecision: 'APPROVED',
        minutesAgo: 10,
    });
    return { world, first, second };
}

/**
 * Selects the row titled `title` with the keyboard (`j`), without opening it — again until it is: a key pressed
 * while the screen still loads is lost.
 */
async function selectRow(myWork: MyWorkScreenHarness, title: string) {
    await expect(async () => {
        await myWork.root.page().keyboard.press('j');
        await expect(myWork.selectedRow).toContainText(title, { timeout: 500 });
    }).toPass();
}

/** The merges the app asked GitHub for (`PUT …/merge-async`), by their bodies, oldest first. */
function getMergeRequests(github: GitHubMock) {
    return github.restCalls
        .filter(call => call.method === 'PUT' && call.url.pathname.endsWith('/merge-async'))
        .map(call => call.body);
}
