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

test('a stack is one entry in my work, whole when only one of its pull requests is mine to review; Enter opens the first not approved and J and K step entry by entry, opening what Enter opens', async ({
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
    await expect(mine).toContainText('1 of 3 ready, #102 waiting for review');
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

    // Enter on the viewer's stack opens its first pull request not yet approved.
    await page.keyboard.press('j');
    await expect(myWork.selectedRow).toContainText('Read the stack of each pull request');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C102');
    await expect(item.title).toHaveText('Fold a stack into one entry');
    await expect(item.position).toHaveText('2 / 2');

    // Its pull requests are no steps: nothing follows the last entry, and K is the entry before it, on what Enter opens.
    await page.keyboard.press('j');
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C102');
    await page.keyboard.press('k');
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Capi%7C201');
    await expect(item.title).toHaveText('Split the rate limiter in two');
    await expect(myWork.selectedRow).toContainText('Split the rate limiter in two');

    // Expanded, the entry is a step and so is each row; J and K open them in that order.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('j');
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Capi%7C201');
    await expect(myWork.selectedRow).toHaveText(/Split the rate limiter in two/);
    await page.keyboard.press('j');
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Capi%7C202');
    await expect(myWork.selectedRow).toContainText('Move the limits to the config');
    await page.keyboard.press('k');
    await page.keyboard.press('k');
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Capi%7C201');
    await expect(myWork.selectedRow).toContainText('Your review');
});

test('a pull request of a stack opened in the panel shows the whole stack beside it, its own row marked; a click on another row opens that one; expanded, J moves the mark', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createStacksWorld());
    const item = new ItemViewHarness(page);

    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await expect(myWork.selectedRow).toContainText('Read the stack of each pull request');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(item.title).toHaveText('Fold a stack into one entry');
    await expect(item.stackMapRows).toHaveText([
        /#101\s*Read the stack of each pull request/,
        /#102\s*Fold a stack into one entry/,
        /#103\s*Open the next pull request of a stack/,
    ]);
    await expect(item.stackMapCurrent).toHaveText(/#102/);

    await item.stackMapRows.filter({ hasText: '#101' }).click();
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C101');
    await expect(item.title).toHaveText('Read the stack of each pull request');
    await expect(item.stackMapCurrent).toHaveText(/#101/);

    await page.keyboard.press('j');
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C102');
    await expect(item.stackMapCurrent).toHaveText(/#102/);
    await expect(item.stackMapRows).toHaveCount(3);
});

test('on its own page J and K walk the items of the list, the position counting them, and one reached through the map keeps its entry until a step leaves it', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createStacksWorld());
    const item = new ItemViewHarness(page);

    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await expect(myWork.selectedRow).toContainText('Read the stack of each pull request');
    await page.keyboard.press('Enter');
    await expect(item.title).toHaveText('Fold a stack into one entry');
    await item.arrangement('Full page').click();
    await expect(page).toHaveURL('/acme/web/pull/102');
    await expect(item.position).toHaveText('2 / 2');
    // The entry is collapsed: its other pull requests are no steps, so the map hints neither key on them.
    await expect(item.stackMapRows.filter({ hasText: '#101' })).not.toHaveAttribute('aria-keyshortcuts');
    await expect(item.stackMapRows.filter({ hasText: '#103' })).not.toHaveAttribute('aria-keyshortcuts');

    await page.keyboard.press('k');
    await expect(page).toHaveURL('/acme/api/pull/201');
    await expect(item.position).toHaveText('1 / 2');

    await page.keyboard.press('j');
    await expect(page).toHaveURL('/acme/web/pull/102');
    await expect(item.position).toHaveText('2 / 2');

    await item.stackMapRows.filter({ hasText: '#103' }).click();
    await expect(page).toHaveURL('/acme/web/pull/103');
    await expect(item.position).toHaveText('2 / 2');
    await page.keyboard.press('k');
    await expect(page).toHaveURL('/acme/api/pull/201');
});

test('on its own page, the entry expanded, the stack map hints K and J on the neighbouring rows, and those keys reach them', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createStacksWorld());
    const item = new ItemViewHarness(page);
    const row = (number: string) => item.stackMapRows.filter({ hasText: number });

    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await expect(myWork.selectedRow).toContainText('Read the stack of each pull request');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(item.title).toHaveText('Fold a stack into one entry');
    await item.arrangement('Full page').click();
    await expect(page).toHaveURL('/acme/web/pull/102');

    await expect(row('#101')).toHaveAttribute('aria-keyshortcuts', 'K');
    await expect(row('#103')).toHaveAttribute('aria-keyshortcuts', 'J');

    await page.keyboard.press('j');
    await expect(page).toHaveURL('/acme/web/pull/103');
    await expect(row('#102')).toHaveAttribute('aria-keyshortcuts', 'K');
    await expect(row('#101')).not.toHaveAttribute('aria-keyshortcuts');
});

test('the stack map hints J and K only on the row they reach, with the panel open on an expanded entry too; the buttons go where something opens', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createStacksWorld());
    const item = new ItemViewHarness(page);
    const row = (number: string) => item.stackMapRows.filter({ hasText: number });

    // Collapsed, the entry's neighbours are outside the stack: neither hint.
    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await expect(myWork.selectedRow).toContainText('Read the stack of each pull request');
    await page.keyboard.press('Enter');
    await expect(item.stackMapCurrent).toHaveText(/#102/);
    await expect(row('#101')).not.toHaveAttribute('aria-keyshortcuts');
    await expect(row('#103')).not.toHaveAttribute('aria-keyshortcuts');

    // Expanded with the cursor on the entry, J goes to its first row, not to the one after the opened pull request.
    await page.keyboard.press('ArrowRight');
    await expect(row('#101')).toHaveAttribute('aria-keyshortcuts', 'J');
    await expect(row('#103')).not.toHaveAttribute('aria-keyshortcuts');
    await page.keyboard.press('j');
    await expect(item.stackMapCurrent).toHaveText(/#101/);

    // On the entry of a stack whose first row is the one opened, J only moves the cursor; the button opens the next one.
    await page.keyboard.press('k');
    await page.keyboard.press('k');
    await expect(myWork.selectedRow).toContainText('Split the rate limiter in two');
    await page.keyboard.press('ArrowRight');
    await expect(item.stackMapCurrent).toHaveText(/#201/);
    await item.nextButton.click();
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Capi%7C202');
});
