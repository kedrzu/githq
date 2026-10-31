import { expect, test } from '../fixtures.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { MY_WORK_GROUP_NAMES } from '../harnesses/MyWorkScreen.harness.js';

import { expectMyWorkCounts } from './expectMyWorkCounts.js';
import { openMyWork } from './openMyWork.js';
import { createSampleMyWork } from './sampleMyWork.js';

test('my work lists the four groups in order, each item once, and says it is up to date', async ({ page, github }) => {
    const { myWork, shell } = await openMyWork(page, github, createSampleMyWork().world);

    await expect(myWork.groups).toHaveCount(4);
    for (const [index, name] of MY_WORK_GROUP_NAMES.entries()) {
        await expect(myWork.groups.nth(index)).toHaveAccessibleName(name);
    }

    // Asked for a review and mentioned in it: listed once, where the review is.
    await expect(myWork.rows('Review requested')).toHaveText([/Add rate limit headers to the API/]);
    await expect(myWork.row('Add rate limit headers to the API')).toHaveCount(1);
    await expect(myWork.rows('My pull requests')).toHaveText([
        /Cache search results.*2 checks failing/,
        /Move the sidebar state to the store.*conflicts/,
        /Retry polls on network errors.*waiting for review/,
    ]);
    await expect(myWork.rows('Mentioned')).toHaveText([/Dark mode for the status bar/]);

    await expect(
        myWork.row('Add rate limit headers to the API').getByRole('img', { name: 'Open pull request' }),
    ).toBeVisible();
    await expect(myWork.row('Dark mode for the status bar').getByRole('img', { name: 'Open issue' })).toBeVisible();
    await expect(shell.statusBar).toContainText('Up to date');
});

test('my pull request closing an assigned issue is nested under it, and nowhere else', async ({ page, github }) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);

    await expect(myWork.rows('Assigned to me')).toHaveText([
        /Sign-in loops after the token expires/,
        /Redirect once after sign-in.*#15/,
        /Document the keyboard shortcuts/,
    ]);
    await expect(myWork.row('Redirect once after sign-in')).toHaveCount(1);
    await expect(myWork.rows('My pull requests').filter({ hasText: 'Redirect once after sign-in' })).toHaveCount(0);
    await expect(myWork.groupCount('Assigned to me')).toHaveText('2');
});

test('the sidebar counts what the list shows, and "My work" their sum', async ({ page, github }) => {
    const { myWork, shell } = await openMyWork(page, github, createSampleMyWork().world);

    await expectMyWorkCounts({
        myWork,
        shell,
        counts: { 'Review requested': 1, 'My pull requests': 3, 'Assigned to me': 2, Mentioned: 1 },
    });

    // A group of its own keeps the count, and the list narrowed to it shows the same rows.
    await shell.myWorkLink('My pull requests').click();
    await expect(page).toHaveURL('/my/pull-requests');
    await expect(myWork.groups).toHaveCount(1);
    await expect(myWork.groupCount('My pull requests')).toHaveText('3');
    await expect(shell.myWorkCount('My pull requests')).toHaveText('3');
});

test('"Needs me" and "Waiting on others" keep what each says, the sidebar still counting everything', async ({
    page,
    github,
}) => {
    const { myWork, shell } = await openMyWork(page, github, createSampleMyWork().world);

    await myWork.filter('Needs me').click();
    await expect(myWork.filter('Needs me')).toHaveAttribute('aria-pressed', 'true');
    await expect(myWork.groups).toHaveCount(3);
    await expect(myWork.rows('Review requested')).toHaveText([/Add rate limit headers to the API/]);
    await expect(myWork.rows('My pull requests')).toHaveText([
        /Cache search results/,
        /Move the sidebar state to the store/,
    ]);
    await expect(myWork.groupCount('Assigned to me')).toHaveText('2');
    await expect(myWork.group('Mentioned')).toBeHidden();

    // Every pull request of mine still waits for a review — the ones that need me too.
    await myWork.filter('Waiting on others').click();
    await expect(myWork.groups).toHaveCount(2);
    await expect(myWork.rows('My pull requests')).toHaveText([
        /Cache search results/,
        /Move the sidebar state to the store/,
        /Retry polls on network errors/,
    ]);
    // The issue stays, as the parent of the pull request that waits.
    await expect(myWork.rows('Assigned to me')).toHaveText([
        /Sign-in loops after the token expires/,
        /Redirect once after sign-in/,
    ]);

    await expect(shell.myWorkCount('My work')).toHaveText('7');
});

test('"Needs me" with nothing for me points at what waits on others', async ({ page, github }) => {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    world.pullRequest({
        repository: 'acme/api',
        number: 4,
        title: 'Retry polls on network errors',
        foundBy: ['authored'],
        reviewRequests: ['monalisa'],
        minutesAgo: 30,
    });
    world.issue({
        repository: 'acme/api',
        number: 2,
        title: 'Dark mode for the status bar',
        author: 'hubot',
        foundBy: ['mentioned'],
        minutesAgo: 60,
    });
    const { myWork } = await openMyWork(page, github, world);

    await myWork.filter('Needs me').click();
    await expect(myWork.root.getByRole('heading', { name: 'Nothing needs you right now' })).toBeVisible();
    await expect(myWork.groups).toHaveCount(0);

    await myWork.root.getByRole('button', { name: /1 of your pull requests is waiting on others/ }).click();
    await expect(myWork.filter('Waiting on others')).toHaveAttribute('aria-pressed', 'true');
    await expect(myWork.rows('My pull requests')).toHaveText([/Retry polls on network errors/]);
});

test('nothing on my plate (K4) says what was checked and offers the next keys: a new issue, the command menu', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, new GitHubWorld(SAMPLE_VIEWER.viewer.login));

    await expect(myWork.root.getByRole('heading', { name: 'Nothing on your plate' })).toBeVisible();
    await page.screenshot({ path: '../../.context/m6-k4.png' });
    await myWork.root.getByRole('button', { name: 'Jump to a project' }).click();
    await expect(new CommandMenuHarness(page).root).toBeVisible();
    await page.keyboard.press('Escape');

    await myWork.root.getByRole('button', { name: 'New issue' }).click();
    await expect(page.getByRole('dialog', { name: 'New issue' })).toBeVisible();
});

test('"Waiting on others" with nothing waiting says so', async ({ page, github }) => {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    world.issue({
        repository: 'acme/api',
        number: 2,
        title: 'Dark mode for the status bar',
        author: 'hubot',
        foundBy: ['mentioned'],
        minutesAgo: 60,
    });
    const { myWork } = await openMyWork(page, github, world);

    await myWork.filter('Waiting on others').click();
    await expect(myWork.root.getByRole('heading', { name: 'Nothing is waiting on others' })).toBeVisible();
    await expect(myWork.groups).toHaveCount(0);
});

test('j/k move the selection through the rows, nested ones too, and 1/2/3 switch filters', async ({ page, github }) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    await expect(myWork.selectedRow).toHaveCount(0);

    await page.keyboard.press('j');
    await expect(myWork.selectedRow).toContainText('Add rate limit headers to the API');
    for (let step = 0; step < 4; step++) {
        await page.keyboard.press('j');
    }

    await expect(myWork.selectedRow).toContainText('Sign-in loops after the token expires');
    await page.keyboard.press('j');
    await expect(myWork.selectedRow).toContainText('Redirect once after sign-in');
    await page.keyboard.press('k');
    await expect(myWork.selectedRow).toContainText('Sign-in loops after the token expires');
    await expect(myWork.selectedRow).toHaveCount(1);

    await page.keyboard.press('2');
    await expect(myWork.filter('Needs me')).toHaveAttribute('aria-pressed', 'true');
    await expect(myWork.group('Mentioned')).toBeHidden();
    await page.keyboard.press('3');
    await expect(myWork.filter('Waiting on others')).toHaveAttribute('aria-pressed', 'true');
    await expect(myWork.group('Review requested')).toBeHidden();
    // The selected issue is still listed — the parent of a pull request that waits — and stays selected.
    await expect(myWork.selectedRow).toContainText('Sign-in loops after the token expires');
    await page.keyboard.press('1');
    await expect(myWork.filter('All')).toHaveAttribute('aria-pressed', 'true');
    await expect(myWork.groups).toHaveCount(4);
});

test('o opens the selected item on GitHub in a new tab', async ({ page, context, github }) => {
    const sample = createSampleMyWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const url = sample.world.urlOf(sample.closingPullRequest);
    github.web(url.pathname, () => ({
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: '<title>PR</title>',
    }));

    // A click selects the row and opens it in the panel beside the list.
    await myWork.row('Redirect once after sign-in').click();
    await expect(myWork.selectedRow).toContainText('Redirect once after sign-in');
    await expect(page).toHaveURL('/?open=acme/web/15');
    const opened = context.waitForEvent('page');
    await page.keyboard.press('o');

    const tab = await opened;
    await expect(tab).toHaveURL(url.href);
    await expect(page).toHaveURL('/?open=acme/web/15');
    expect(context.pages()).toHaveLength(2);
});
