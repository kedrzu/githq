import { expect, test } from '../fixtures.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';

import { expectMyWorkCounts } from './expectMyWorkCounts.js';
import { openMyWork } from './openMyWork.js';

/**
 * The viewer's stack of three in `acme/web`, the first approved; and monalisa's in `acme/api`, asking the viewer's
 * review on its middle pull request alone — the other two in no search of "my work".
 */
function createStacksWorld() {
    const viewer = SAMPLE_VIEWER.viewer.login;
    const world = new GitHubWorld(viewer);
    world.stack({
        repository: 'acme/web',
        number: 1,
        pullRequests: [
            {
                number: 101,
                title: 'Read the stack of each pull request',
                foundBy: ['authored'],
                reviewDecision: 'APPROVED',
                minutesAgo: 50,
            },
            { number: 102, title: 'Fold a stack into one entry', foundBy: ['authored'], minutesAgo: 40 },
            { number: 103, title: 'Open the next pull request of a stack', foundBy: ['authored'], minutesAgo: 30 },
        ],
    });
    world.stack({
        repository: 'acme/api',
        number: 7,
        pullRequests: [
            { number: 201, title: 'Split the rate limiter in two', author: 'monalisa', minutesAgo: 20 },
            {
                number: 202,
                title: 'Move the limits to the config',
                author: 'monalisa',
                foundBy: ['reviewRequested'],
                reviewRequests: [viewer],
                minutesAgo: 15,
            },
            { number: 203, title: 'Document the new limits', author: 'monalisa', minutesAgo: 10 },
        ],
    });
    return world;
}

test('a stack is one entry in my work, whole when only one of its pull requests is mine to review; Enter opens the first not approved and J walks on through the stack', async ({
    page,
    github,
}) => {
    const { myWork, shell } = await openMyWork(page, github, createStacksWorld());
    const item = new ItemViewHarness(page);

    // Monalisa's stack, read whole after its one pull request the search found: its first one's title names it.
    const theirs = myWork.rows('Review requested');
    await expect(theirs).toContainText('Your review on 1 of 3 · 0 ready');
    await expect(theirs).toHaveText([/^Split the rate limiter in two/]);
    await expect(theirs.getByText('3', { exact: true })).toBeVisible();
    const mine = myWork.rows('My pull requests');
    await expect(mine).toContainText('1 of 3 ready, #102 blocks');
    await expect(mine).toHaveText([/^Read the stack of each pull request/]);
    for (const title of [
        'Move the limits to the config',
        'Document the new limits',
        'Fold a stack into one entry',
        'Open the next pull request of a stack',
    ]) {
        await expect(myWork.row(title)).toHaveCount(0);
    }

    // Only the stack the copy held part of was read whole; the viewer's own came whole with the search.
    expect(
        github.graphqlCalls.filter(call => call.name === 'PullRequestStacks').map(call => call.variables.ids),
    ).toEqual([['PRS_acme_api_7']]);

    await expectMyWorkCounts({
        myWork,
        shell,
        counts: { 'Review requested': 1, 'My pull requests': 1, 'Assigned to me': 0, Mentioned: 0 },
    });

    // Expanded, monalisa's stack lists all three, those no search found too.
    await page.keyboard.press('j');
    await expect(myWork.selectedRow).toContainText('Split the rate limiter in two');
    await page.keyboard.press('ArrowRight');
    await expect(theirs).toHaveText([
        /^Split the rate limiter in two.*Your review/,
        /Split the rate limiter in two/,
        /Move the limits to the config/,
        /Document the new limits/,
    ]);
    await page.keyboard.press('ArrowLeft');
    await expect(theirs).toHaveCount(1);

    // Enter on the viewer's stack opens its first pull request not yet approved; J the next one of the stack.
    await page.keyboard.press('j');
    await expect(myWork.selectedRow).toContainText('Read the stack of each pull request');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C102');
    await expect(item.title).toHaveText('Fold a stack into one entry');
    await expect(item.position).toHaveText('5 / 6');

    await page.keyboard.press('j');
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C103');
    await expect(item.title).toHaveText('Open the next pull request of a stack');
    await expect(item.position).toHaveText('6 / 6');
    await expect(myWork.selectedRow).toContainText('Read the stack of each pull request');

    // K walks back through it, and on into monalisa's stack at its last.
    await page.keyboard.press('k');
    await page.keyboard.press('k');
    await page.keyboard.press('k');
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Capi%7C203');
    await expect(item.title).toHaveText('Document the new limits');
    await expect(myWork.selectedRow).toContainText('Split the rate limiter in two');
});
