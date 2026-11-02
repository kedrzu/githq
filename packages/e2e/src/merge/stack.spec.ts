import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { MergePanelHarness } from '../harnesses/MergePanel.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { selectRow } from '../myWork/selectRow.js';

import { getMergeRequests } from './getMergeRequests.js';

/** The stack's name: its first pull request's title, as none of them closes an issue (stacked PRs D4). */
const STACK = 'Read the stack of each pull request';
/** The title of the stack's last pull request, #103. */
const THIRD = 'Open the next pull request of a stack';
/** The viewer's pull request outside the stack, the row after the stack's entry. */
const AFTER = 'Cache response headers';

/**
 * The viewer's stack of three in acme/web, #101–#103, every one approved and ready, and a pull request of theirs
 * outside it listed after the stack's entry. acme/web squashes by default.
 */
function createStackWorld() {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    world.repository('acme/web', { defaultMergeMethod: 'SQUASH' });
    const [first = '', second = '', third = ''] = world.stack({
        repository: 'acme/web',
        number: 1,
        pullRequests: [
            { number: 101, title: STACK, foundBy: ['authored'], reviewDecision: 'APPROVED', minutesAgo: 30 },
            {
                number: 102,
                title: 'Fold a stack into one entry',
                foundBy: ['authored'],
                reviewDecision: 'APPROVED',
                minutesAgo: 20,
            },
            {
                number: 103,
                title: THIRD,
                foundBy: ['authored'],
                reviewDecision: 'APPROVED',
                minutesAgo: 10,
            },
        ],
    });
    world.pullRequest({
        repository: 'acme/web',
        number: 16,
        title: AFTER,
        foundBy: ['authored'],
        reviewDecision: 'APPROVED',
        minutesAgo: 60,
    });
    return { world, first, second, third };
}

/** The pull requests the app sent a merge to (`PUT …/pulls/{n}/merge-async`), by number, oldest first. */
function getMergedNumbers(github: GitHubMock): number[] {
    return github.restCalls
        .filter(call => call.method === 'PUT' && call.url.pathname.endsWith('/merge-async'))
        .map(call => Number(/\/pulls\/(\d+)\//.exec(call.url.pathname)?.[1]));
}

/** How many times the app read stacks whole (`PullRequestStacks`). */
function countStackReads(github: GitHubMock): number {
    return github.graphqlCalls.filter(call => call.name === 'PullRequestStacks').length;
}

test("D11: ⇧M on a stack's entry merges the whole stack with one merge of its top — no commit text; every one reads being merged until GitHub says merged, and the list moves past the entry", async ({
    page,
    github,
}) => {
    const { world, first, second, third } = createStackWorld();
    const { myWork, shell } = await openMyWork(page, github, world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, STACK);

    await page.keyboard.press('Shift+M');
    await expect(panel.root).toHaveAccessibleName(`Merge the stack ${STACK}`);
    await expect(panel.stackMembers).toHaveText([/^#101.*Ready/, /^#102.*Ready/, /^#103.*Ready/]);
    await expect(panel.root).toContainText('All 3 land, first to last');
    await expect(panel.primary).toHaveText('Squash and merge all 3');
    await expect(panel.line('Commit')).toHaveCount(0);

    const release = world.holdMerges();
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    // One merge, of the top, with its head: GitHub lands everything below it, each under its own title.
    expect(getMergedNumbers(github)).toEqual([103]);
    expect(getMergeRequests(github)).toEqual([{ merge_method: 'squash', sha: world.headOf(third) }]);
    await expect(myWork.selectedRow).toContainText(AFTER);
    const entry = myWork.row(STACK);
    await expect(entry).toContainText('Being merged · 3 going · not merged yet');
    await expect(shell.statusBar).toContainText('Merge on the way · acme/web, 3 pull requests');
    for (const id of [first, second, third]) {
        expect(world.stateOf(id).merged).toBe(false);
    }

    // Back on the entry: the panel says every one is being merged, none merged.
    await page.keyboard.press('k');
    await expect(myWork.selectedRow).toContainText(STACK);
    await page.keyboard.press('Shift+M');
    await expect(panel.root).toContainText('Being merged, all 3');
    await expect(panel.stackMembers).toHaveText([/Being merged/, /Being merged/, /Being merged/]);
    await expect(panel.stackMembers.filter({ hasText: /Merged/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();

    // GitHub merges them: my work lists open work only, so the entry leaves; each pull request reads merged.
    release();
    await expect(entry).toHaveCount(0, { timeout: 10_000 });
    for (const id of [first, second, third]) {
        expect(world.stateOf(id).merged).toBe(true);
    }

    const item = new ItemViewHarness(page);
    for (const number of [101, 102, 103]) {
        await page.goto(`/acme/web/pull/${number}`);
        await expect(item.statePill('Merged')).toBeVisible();
    }
});

test('D18: ↑ moves the line to the second of three — one merge of the second lands the first two, the third stays open', async ({
    page,
    github,
}) => {
    const { world, first, second, third } = createStackWorld();
    const { myWork } = await openMyWork(page, github, world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, STACK);

    await page.keyboard.press('Shift+M');
    await expect(panel.primary).toHaveText('Squash and merge all 3');
    await page.keyboard.press('ArrowUp');
    await expect(panel.root.getByTestId('stack-line')).toContainText('Stops here');
    await expect(panel.stackMember(103)).toContainText('Stays open');
    await expect(panel.root).toContainText('2 land · 1 stay open');
    await expect(panel.primary).toHaveText('Squash and merge 2 of 3');
    await expect(panel.line('Commit')).toHaveCount(0);

    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    expect(getMergedNumbers(github)).toEqual([102]);
    expect(getMergeRequests(github)).toEqual([{ merge_method: 'squash', sha: world.headOf(second) }]);
    await expect.poll(() => world.stateOf(second).merged).toBe(true);
    expect(world.stateOf(first).merged).toBe(true);
    expect(world.stateOf(third).merged).toBe(false);

    // Merged, the first two leave my work: what stays of the stack is its open one, a row of its own.
    await expect(myWork.row(STACK)).toHaveCount(0, { timeout: 10_000 });
    await expect(myWork.row(THIRD)).toContainText('3 of 3');
    await expect(myWork.row(THIRD)).not.toContainText('Being merged');
});

test('D18, SP43: with the line at the first, one going is an ordinary merge — the commit text is shown and the edited title sent', async ({
    page,
    github,
}) => {
    const { world, first, second } = createStackWorld();
    const { myWork } = await openMyWork(page, github, world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, STACK);

    await page.keyboard.press('Shift+M');
    await expect(panel.primary).toHaveText('Squash and merge all 3');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(panel.root).toContainText('Only #101 · 2 stay open');
    await expect(panel.primary).toHaveText('Squash and merge');
    // GitHub's proposal for the first, read for the panel.
    await expect(panel.line('Commit')).toContainText(`${STACK} (#101)`);

    await page.keyboard.press('e');
    await expect(panel.titleField).toHaveValue(`${STACK} (#101)`);
    await panel.titleField.fill('Read every stack whole');
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    expect(getMergedNumbers(github)).toEqual([101]);
    expect(getMergeRequests(github)).toEqual([
        { merge_method: 'squash', sha: world.headOf(first), commit_title: 'Read every stack whole' },
    ]);
    await expect.poll(() => world.stateOf(first).merged).toBe(true);
    expect(world.stateOf(second).merged).toBe(false);
});

test('D8, D21: a stack needing a rebase — #101 pushed to under #102 — sends no merge; ⌘↵ opens its top pull request on GitHub', async ({
    page,
    github,
}) => {
    const { world, first, third } = createStackWorld();
    world.push(first, SAMPLE_VIEWER.viewer.login, 'Name the stack after its issue');
    github.web('/acme/web/pull/103', () => ({ status: 200, body: '<title>Rebase stack</title>' }));
    const { myWork } = await openMyWork(page, github, world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, STACK);

    await page.keyboard.press('Shift+M');
    await expect(panel.root).toContainText('Needs rebase');
    await expect(panel.root).toContainText("Nothing can merge until it's done");
    await expect(panel.root).toContainText('#101 has a new commit');
    await expect(panel.primary).toHaveText('Rebase stack on GitHub');

    const popup = page.waitForEvent('popup');
    await page.keyboard.press('ControlOrMeta+Enter');
    expect((await popup).url()).toBe(world.urlOf(third).href);
    expect(getMergeRequests(github)).toEqual([]);
});

test("SP61, D11: a stack's merge GitHub refuses says so in GitHub's words; the stack is read again and nothing reads merged", async ({
    page,
    github,
}) => {
    const { world, first, second, third } = createStackWorld();
    const reason = 'Required status check "e2e" is expected.';
    world.refuseMerge(third, reason);
    const { myWork, shell } = await openMyWork(page, github, world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, STACK);

    await page.keyboard.press('Shift+M');
    await expect(panel.primary).toHaveText('Squash and merge all 3');
    const readsBefore = countStackReads(github);
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toContainText('GitHub refused it');
    await expect(panel.root).toContainText('Nothing was merged');
    await expect(panel.root).toContainText(reason);
    expect(getMergedNumbers(github)).toEqual([103]);
    await expect.poll(() => countStackReads(github)).toBeGreaterThan(readsBefore);
    await expect(panel.stackMembers.filter({ hasText: /Merged|Being merged/ })).toHaveCount(0);
    for (const id of [first, second, third]) {
        expect(world.stateOf(id).merged).toBe(false);
    }

    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();
    await expect(myWork.row(STACK)).not.toContainText('Being merged');
    await expect(shell.toasts).toHaveCount(0);
});

test('SP62: a push to #101 after the panel opened — GitHub refuses the merge of the top, and the panel names the new commit; nothing merged', async ({
    page,
    github,
}) => {
    const { world, first, second, third } = createStackWorld();
    const { myWork } = await openMyWork(page, github, world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, STACK);

    await page.keyboard.press('Shift+M');
    await expect(panel.primary).toHaveText('Squash and merge all 3');
    world.push(first, 'monalisa', 'Name the stack after its issue');
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toContainText('Not merged: #101 has a new commit');
    await expect(panel.stackMember(101)).toContainText('New commit');
    expect(getMergeRequests(github)).toEqual([{ merge_method: 'squash', sha: world.headOf(third) }]);
    for (const id of [first, second, third]) {
        expect(world.stateOf(id).merged).toBe(false);
    }
});
