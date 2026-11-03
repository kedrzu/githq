import { expect, test } from '../fixtures.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { MergePanelHarness } from '../harnesses/MergePanel.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { selectRow } from '../myWork/selectRow.js';

import { getMergeRequests } from './getMergeRequests.js';
import { getOperationCalls } from './getOperationCalls.js';
import { createSampleMergeableWork, FIRST_TITLE } from './sampleMergeableWork.js';

/** The name of {@link createQueueStack}'s stack: its first pull request's title. */
const STACK = 'Read the stack of each pull request';

/** Two approved pull requests of acme/web, whose default branch has a merge queue squashing them. */
function createQueueWork() {
    return createSampleMergeableWork({ repository: { mergeQueueMethod: 'SQUASH' } });
}

/** The viewer's stack of two, #41 and #42, approved, on a merge queue's branch. */
function createQueueStack() {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    world.repository('acme/web', { defaultMergeMethod: 'SQUASH', mergeQueueMethod: 'SQUASH' });
    const [first = '', top = ''] = world.stack({
        repository: 'acme/web',
        number: 1,
        pullRequests: [
            { number: 41, title: STACK, foundBy: ['authored'], reviewDecision: 'APPROVED', minutesAgo: 30 },
            { number: 42, title: 'Fold a stack', foundBy: ['authored'], reviewDecision: 'APPROVED', minutesAgo: 20 },
        ],
    });
    return { world, first, top };
}

test('PM14: ⌘↵ on a queue branch adds it with the head commit alone, never jumping; the row reads in the queue and no merge is offered', async ({
    page,
    github,
}) => {
    const sample = createQueueWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.root).toContainText('Ready for the queue');
    await expect(panel.line('Method')).toContainText('Squash');
    await expect(panel.primary).toHaveText('Add to queue');
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    // GitHub fails anything but the head commit here (live, 2026-11-02); the world does too.
    expect(getMergeRequests(github)).toEqual([{ sha: sample.world.headOf(sample.first) }]);
    expect(getOperationCalls(github, 'EnqueuePullRequest')).toEqual([]);
    const row = myWork.row(FIRST_TITLE);
    await expect(row).toContainText('in queue · 1st');
    expect(sample.world.stateOf(sample.first).merged).toBe(false);

    // The list moved on past it.
    await page.keyboard.press('k');
    await expect(myWork.selectedRow).toContainText(FIRST_TITLE);
    await page.keyboard.press('Shift+M');
    await expect(panel.root).toContainText('In the queue');
    await expect(panel.primary).toContainText('Take out of queue');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeVisible();
    expect(getMergeRequests(github)).toHaveLength(1);
    expect(getOperationCalls(github, 'DequeuePullRequest')).toEqual([]);
});

test('PM14: ⇧⌘↵ jumps to the front of the queue, with the head the user saw, through the mutation that can', async ({
    page,
    github,
}) => {
    const sample = createQueueWork();
    sample.world.enqueue(sample.second);
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.jumpButton).toBeVisible();
    await page.keyboard.press('Shift+ControlOrMeta+Enter');

    await expect(panel.root).toContainText('In the queue');
    expect(getOperationCalls(github, 'EnqueuePullRequest')).toEqual([
        { pullRequestId: sample.first, expectedHeadOid: sample.world.headOf(sample.first), jump: true },
    ]);
    expect(getMergeRequests(github)).toEqual([]);
    expect(sample.world.queuePositionOf(sample.first)).toBe(1);
    expect(sample.world.queuePositionOf(sample.second)).toBe(2);
});

test('PM16: while it waits, a status poll moves its place: the queue moves no updatedAt, and nothing it sent covers that', async ({
    page,
    github,
}) => {
    // Time runs as usual, and the minute to the next poll of the statuses can be skipped.
    await page.clock.install();
    const sample = createQueueWork();
    sample.world.enqueue(sample.second);
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.primary).toHaveText('Add to queue');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeHidden();
    const row = myWork.row(FIRST_TITLE);
    await expect(row).toContainText('in queue · 2nd');

    sample.world.dequeue(sample.second);
    await page.clock.fastForward('01:00');

    await expect(row).toContainText('in queue · 1st');
});

test('PM15: ⇧Q takes it out of the queue: the row stops saying so and it can be added again', async ({
    page,
    github,
}) => {
    const sample = createQueueWork();
    sample.world.enqueue(sample.first);
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);
    await expect(myWork.row(FIRST_TITLE)).toContainText('in queue');

    await page.keyboard.press('Shift+M');
    await expect(panel.takeOutButton).toBeVisible();
    await page.keyboard.press('Shift+Q');

    await expect(panel.primary).toHaveText('Add to queue');
    expect(getOperationCalls(github, 'DequeuePullRequest')).toEqual([{ id: sample.first }]);
    expect(sample.world.queuePositionOf(sample.first)).toBeNull();
    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();
    await expect(myWork.row(FIRST_TITLE)).not.toContainText('in queue');
});

test('SP53, SP54: ⌘↵ on a stack sends the head commit alone to its top; each one reads its own place, and the verdict the first one’s', async ({
    page,
    github,
}) => {
    const { world, first, top } = createQueueStack();
    const { myWork } = await openMyWork(page, github, world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, STACK);

    await page.keyboard.press('Shift+M');
    await expect(panel.primary).toHaveText('Add all 2 to the queue');
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    expect(getMergeRequests(github)).toEqual([{ sha: world.headOf(top) }]);
    expect(
        github.restCalls
            .filter(call => call.method === 'PUT')
            .map(call => /\/pulls\/(\d+)\//.exec(call.url.pathname)?.[1]),
    ).toEqual(['42']);
    await expect.poll(() => world.queuePositionOf(first)).toBe(1);
    expect(world.queuePositionOf(top)).toBe(2);

    await selectRow(myWork, STACK);
    await page.keyboard.press('Shift+M');
    await expect(panel.stackMembers).toHaveText([/^#41.*1st · waiting for checks/, /^#42.*2nd · waiting for checks/]);
    await expect(panel.root).toContainText('In the queue1st · waiting for checks');
    await expect(panel.primary).toContainText('Take out of queue');
    await page.keyboard.press('ControlOrMeta+Enter');
    expect(getMergeRequests(github)).toHaveLength(1);
});

test('SP54: taken out from the panel, a stack goes through its first one, whole, and never reads as thrown out', async ({
    page,
    github,
}) => {
    const { world, first, top } = createQueueStack();
    const { myWork } = await openMyWork(page, github, world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, STACK);
    await page.keyboard.press('Shift+M');
    await expect(panel.primary).toHaveText('Add all 2 to the queue');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeHidden();
    await expect.poll(() => world.queuePositionOf(top)).toBe(2);

    await selectRow(myWork, STACK);
    await page.keyboard.press('Shift+M');
    await expect(panel.stackMembers).toHaveText([/1st/, /2nd/]);
    await page.keyboard.press('Shift+Q');

    await expect(panel.primary).toHaveText('Add all 2 to the queue');
    expect(getOperationCalls(github, 'DequeuePullRequest')).toEqual([{ id: first }]);
    expect(world.queuePositionOf(first)).toBeNull();
    expect(world.queuePositionOf(top)).toBeNull();
    await expect(panel.root).not.toContainText('Out of the queue');
    await expect(panel.root).not.toContainText('thrown out');

    // Opened again it reads the stack as it does: still not thrown out.
    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();
    await selectRow(myWork, STACK);
    await page.keyboard.press('Shift+M');
    await expect(panel.primary).toHaveText('Add all 2 to the queue');
    await expect(panel.root).not.toContainText('Out of the queue');
});

test('SP54: a stack whose entries went elsewhere reads as thrown out: this session did not take it out', async ({
    page,
    github,
}) => {
    const { world, first, top } = createQueueStack();
    const { myWork } = await openMyWork(page, github, world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, STACK);
    await page.keyboard.press('Shift+M');
    await expect(panel.primary).toHaveText('Add all 2 to the queue');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(panel.root).toBeHidden();
    await expect.poll(() => world.queuePositionOf(top)).toBe(2);
    await selectRow(myWork, STACK);
    await page.keyboard.press('Shift+M');
    await expect(panel.stackMembers).toHaveText([/1st/, /2nd/]);
    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();

    world.dequeue(first);
    await selectRow(myWork, STACK);
    await page.keyboard.press('Shift+M');

    await expect(panel.root).toContainText('Out of the queue');
    await expect(panel.root).toContainText('#41 was thrown out, the later ones left with it');
    expect(getOperationCalls(github, 'DequeuePullRequest')).toEqual([]);
});
