import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { GitHubHttpError } from '../github/GitHubMock.js';
import type { GitHubWorld } from '../github/GitHubWorld.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

/** The repository of the world browsed in these tests, tracked by none of them at first. */
const BROWSED = 'hubot/tools';

test('⌘K, "Search repositories": what is typed goes to GitHub once typing pauses, its repositories list with their description and visibility, Enter opens one', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    sample.world.repository(BROWSED, { description: 'Tools for the release' });
    sample.world.repository('hubot/secret-tools', { description: 'Tools nobody sees', isPrivate: true });
    addIssues(sample.world, 1);
    // Paused, the search's wait cannot run out between two keys, however slow the machine.
    await page.clock.install();
    await openTrackedWork(page, github, sample.world);
    const menu = new CommandMenuHarness(page);

    await menu.openRepositorySearch();
    await page.clock.pauseAt(Date.now() + 60_000);
    await menu.field.pressSequentially('tools org:hubot');
    expect(searches(github)).toEqual([]);
    await page.clock.resume();

    await expect(menu.option(/^hubot\/tools/u)).toContainText('Tools for the release');
    await expect(menu.option(/^hubot\/tools/u)).toContainText('public');
    await expect(menu.option(/^hubot\/secret-tools/u)).toContainText('Tools nobody sees');
    await expect(menu.option(/^hubot\/secret-tools/u)).toContainText('private');
    expect(searches(github)).toEqual([{ query: 'tools org:hubot' }]);

    await menu.option(/^hubot\/tools/u).hover();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/${BROWSED}/issues`);
    await expect(new RepositoryScreenHarness(page).row('Issue 001')).toBeVisible();
});

test("an untracked repository's sections list GitHub's open items with the tracked toolbar and \"not tracked\", how much is read; the state filter reads that state, the list's end the next page", async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    addIssues(sample.world, 130);
    sample.world.issue({ repository: BROWSED, number: 500, title: 'Closed long ago', closed: true, minutesAgo: 1000 });
    sample.world.pullRequest({ repository: BROWSED, number: 501, title: 'Bump the toolchain', minutesAgo: 5 });
    await openTrackedWork(page, github, sample.world);
    const repository = new RepositoryScreenHarness(page);

    await page.goto(`/${BROWSED}`);
    await expect(repository.row('Issue 001')).toBeVisible();
    await expect(repository.notTrackedChip).toBeVisible();
    await expect(repository.groupingButton).toHaveText('Group: Milestone');
    await expect(repository.layout('List')).toHaveAttribute('aria-pressed', 'true');
    await expect(repository.readCount).toHaveText('100 of 130');
    await expect(repository.section('Issues')).toHaveText('Issues');
    await expect(repository.section('Workflows')).toHaveCount(0);
    expect(pages(github, 'RepositoryIssues')).toEqual([{ states: ['OPEN'], after: null }]);

    // The end of the list comes in reach only by scrolling to it.
    await repository.row('Issue 100').scrollIntoViewIfNeeded();
    await expect(repository.readCount).toHaveText('130 of 130');
    await expect(repository.row('Issue 130')).toBeVisible();
    expect(pages(github, 'RepositoryIssues')).toEqual([
        { states: ['OPEN'], after: null },
        { states: ['OPEN'], after: 'C100' },
    ]);

    await repository.chooseState('Open', 'Closed');
    await expect(repository.row('Closed long ago')).toBeVisible();
    await expect(repository.row('Issue 001')).toHaveCount(0);
    await expect(repository.readCount).toHaveText('1 of 1');
    expect(pages(github, 'RepositoryIssues').at(-1)).toEqual({ states: ['CLOSED'], after: null });

    await repository.section('Pull requests').click();
    await expect(repository.row('Bump the toolchain')).toBeVisible();
    await expect(repository.notTrackedChip).toBeVisible();
    await expect(repository.readCount).toHaveText('1 of 1');
    expect(pages(github, 'RepositoryPullRequests')).toEqual([{ states: ['OPEN'], first: 30, after: null }]);
});

test('on the board of an untracked repository, "Read more" reads the next page', async ({ page, github }) => {
    const sample = createSampleTrackedWork();
    addIssues(sample.world, 130);
    await openTrackedWork(page, github, sample.world);
    const repository = new RepositoryScreenHarness(page);

    await page.goto(`/${BROWSED}`);
    await repository.layout('Board').click();
    await expect(repository.readCount).toHaveText('100 of 130');
    expect(pages(github, 'RepositoryIssues')).toEqual([{ states: ['OPEN'], after: null }]);

    await repository.readMore.click();
    await expect(repository.readCount).toHaveText('130 of 130');
    await expect(repository.readMore).toHaveCount(0);
    expect(pages(github, 'RepositoryIssues').at(-1)).toEqual({ states: ['OPEN'], after: 'C100' });
});

test('in an untracked repository the user may write to, an item edited from the list reaches GitHub and stays shown', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    const [issue = ''] = addIssues(sample.world, 1);
    await openTrackedWork(page, github, sample.world);
    const repository = new RepositoryScreenHarness(page);

    await page.goto(`/${BROWSED}`);
    await expect(repository.row('Issue 001')).toBeVisible();
    await repository.row('Issue 001').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /^Add or remove labels/u }).click();
    await page.getByRole('menuitemcheckbox', { name: 'bug' }).click();

    await expect.poll(() => sample.world.stateOf(issue).labels).toEqual(['bug']);
    expect(sample.world.edits).toEqual([{ mutation: 'AddLabels', itemId: issue }]);
    await expect(repository.row('Issue 001')).toContainText('bug');
});

test('in an untracked repository the user may only read, the edit is not offered', async ({ page, github }) => {
    const sample = createSampleTrackedWork();
    addIssues(sample.world, 1);
    sample.world.repository(BROWSED, { viewerPermission: 'READ' });
    await openTrackedWork(page, github, sample.world);
    const repository = new RepositoryScreenHarness(page);

    await page.goto(`/${BROWSED}`);
    await expect(repository.row('Issue 001')).toBeVisible();
    await repository.row('Issue 001').click({ button: 'right' });
    await expect(page.getByRole('menu')).toContainText(`need triage access to ${BROWSED}`);
    await expect(page.getByRole('menuitem', { name: /^Copy link/u })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /^Add or remove labels/u })).toHaveCount(0);
    expect(sample.world.edits).toEqual([]);
});

test('"Track repository" adds it to the sidebar, starts its first download and leaves the rows; "Stop tracking" returns it to browsing with the rows; each only in its state', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    addIssues(sample.world, 2);
    const shell = await openTrackedWork(page, github, sample.world);
    const repository = new RepositoryScreenHarness(page);
    const menu = new CommandMenuHarness(page);

    await page.goto(`/${BROWSED}`);
    await expect(repository.row('Issue 001')).toBeVisible();
    await expect(shell.tracked(BROWSED)).toHaveCount(0);

    await menu.open();
    await menu.field.pressSequentially('tracking');
    await expect(menu.option(/^Stop tracking/u)).toHaveCount(0);
    await menu.field.clear();
    await menu.field.pressSequentially('Track repository');
    await expect(menu.option(/^Track repository/u)).toBeVisible();
    await page.keyboard.press('Enter');

    await expect(shell.tracked(BROWSED)).toBeVisible();
    // Only a first download reads the closed ones when the state shown is Open.
    await expect.poll(() => pages(github, 'RepositoryIssues')).toContainEqual({ states: ['CLOSED'], after: null });
    await expect(repository.row('Issue 001')).toBeVisible();
    await expect(repository.notTrackedChip).toHaveCount(0);

    await menu.open();
    await menu.field.pressSequentially('Track repository');
    await expect(menu.option(/^Track repository/u)).toHaveCount(0);
    await menu.field.clear();
    await menu.field.pressSequentially('Stop tracking');
    await expect(menu.option(/^Stop tracking/u)).toHaveCount(0);
    await page.keyboard.press('Escape');

    await (await repository.openTitleMenu(BROWSED)).getByRole('menuitem', { name: /^Stop tracking/u }).click();

    await expect(shell.tracked(BROWSED)).toHaveCount(0);
    await expect(repository.notTrackedChip).toBeVisible();
    await expect(repository.row('Issue 001')).toBeVisible();
    await expect(repository.row('Issue 002')).toBeVisible();

    // While Undo is on offer (D25), tracking it again takes the untrack back.
    await menu.open();
    await menu.field.pressSequentially('Track repository');
    await page.keyboard.press('Enter');
    await expect(shell.tracked(BROWSED)).toBeVisible();
    await expect(repository.notTrackedChip).toHaveCount(0);
});

test('a failed look-up says so and tracks nothing', async ({ page, github }) => {
    const sample = createSampleTrackedWork();
    addIssues(sample.world, 1);
    const shell = await openTrackedWork(page, github, sample.world);
    const repository = new RepositoryScreenHarness(page);
    github.graphql('RepositoryForTracking', { repository: null });

    await page.goto(`/${BROWSED}`);
    await expect(repository.row('Issue 001')).toBeVisible();
    await new CommandMenuHarness(page).run('Track repository');

    await expect(shell.toasts.filter({ hasText: `Could not track ${BROWSED}` })).toBeVisible();
    await expect(shell.tracked(BROWSED)).toHaveCount(0);
    await expect(repository.notTrackedChip).toBeVisible();
    await expect(repository.row('Issue 001')).toBeVisible();
});

test('a repository GitHub does not show says so, has the way to GitHub, and sends no further checks', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    await page.clock.install();
    await openTrackedWork(page, github, sample.world);
    const repository = new RepositoryScreenHarness(page);

    await page.goto('/hubot/hidden');
    await expect(repository.notShown).toBeVisible();
    await expect(repository.openOnGitHub).toHaveAttribute('href', 'https://github.com/hubot/hidden');
    await expect(repository.notTrackedChip).toBeVisible();

    const asked = requestsNaming(github, 'hidden').length;
    const polled = pollsOf(github, SAMPLE_REPOSITORY);
    await page.clock.fastForward('02:01');
    // The tracked repository's poll has run meanwhile: time has passed for the app's loops.
    await expect.poll(() => pollsOf(github, SAMPLE_REPOSITORY)).toBeGreaterThan(polled);
    await expect(repository.notShown).toBeVisible();
    expect(requestsNaming(github, 'hidden')).toHaveLength(asked);
});

test('first run and loading D6, ES17: GitHub failing, then offline, on a repository browsed says so instead of ghosts, with its name and the chip; Try again reads it', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    addIssues(sample.world, 1);
    await openTrackedWork(page, github, sample.world);
    const repository = new RepositoryScreenHarness(page);
    github.graphql('RepositoryIssues', new GitHubHttpError(502, 'Bad gateway'));

    await page.goto(`/${BROWSED}/issues`);
    await expect(repository.root.getByRole('heading', { name: "GitHub isn't answering" })).toBeVisible();
    await expect(repository.root).toContainText(`githq couldn't read ${BROWSED}.`);
    await expect(repository.notTrackedChip).toBeVisible();

    await page.context().setOffline(true);
    await expect(repository.root.getByRole('heading', { name: "You're offline" })).toBeVisible();
    await expect(repository.root.getByRole('button', { name: 'Try again' })).toHaveCount(0);

    await page.context().setOffline(false);
    await expect(repository.root.getByRole('heading', { name: "GitHub isn't answering" })).toBeVisible();

    sample.world.install(github);
    await repository.root.getByRole('button', { name: 'Try again' }).click();
    await expect(repository.row('Issue 001')).toBeVisible();
});

test('filtered out, nothing there: a state hiding all a section holds offers to clear it; a section with nothing says so', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    addIssues(sample.world, 1);
    await openTrackedWork(page, github, sample.world);
    const repository = new RepositoryScreenHarness(page);

    await page.goto(`/${BROWSED}/issues`);
    await expect(repository.row('Issue 001')).toBeVisible();
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Closed', exact: true }).click();
    await expect(repository.root.getByRole('heading', { name: 'Nothing matches this filter' })).toBeVisible();
    await expect(repository.root).toContainText('State is closed hides the 1 issue.');
    await repository.root.getByRole('button', { name: 'Clear filter' }).click();
    await expect(repository.row('Issue 001')).toBeVisible();

    await page.keyboard.press('2');
    await expect(repository.root.getByRole('heading', { name: 'No open pull requests' })).toBeVisible();
});

test("opening a repository by another case of its name settles the address on GitHub's name and lists its rows", async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    addIssues(sample.world, 1);
    await openTrackedWork(page, github, sample.world);
    const repository = new RepositoryScreenHarness(page);

    await page.goto('/Hubot/TOOLS/issues');
    await expect(page).toHaveURL(`/${BROWSED}/issues`);
    await expect(repository.row('Issue 001')).toBeVisible();
    await expect(repository.titleMenuButton(BROWSED)).toBeVisible();
});

test('on screen the section is checked every minute; once left, nothing further names the repository', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    addIssues(sample.world, 1);
    await page.clock.install();
    const shell = await openTrackedWork(page, github, sample.world);
    const repository = new RepositoryScreenHarness(page);

    await page.goto(`/${BROWSED}`);
    await expect(repository.row('Issue 001')).toBeVisible();

    await page.clock.fastForward('01:01');
    await expect.poll(() => pollsOf(github, BROWSED)).toBe(1);

    await shell.myWorkLink('My work').click();
    await expect(page).toHaveURL('/');
    const asked = requestsNaming(github, 'tools').length;
    const polled = pollsOf(github, SAMPLE_REPOSITORY);

    await page.clock.fastForward('02:01');
    await expect.poll(() => pollsOf(github, SAMPLE_REPOSITORY)).toBeGreaterThan(polled);
    expect(requestsNaming(github, 'tools')).toHaveLength(asked);
});

/** Gives {@link BROWSED} `count` open issues, "Issue 001" the most recently changed; returns their node ids in that order. */
function addIssues(world: GitHubWorld, count: number) {
    return Array.from({ length: count }, (_, index) =>
        world.issue({
            repository: BROWSED,
            number: index + 1,
            title: `Issue ${String(index + 1).padStart(3, '0')}`,
            author: 'hubot',
            minutesAgo: index + 10,
        }),
    );
}

/** What the command's search sent to GitHub. */
function searches(github: GitHubMock) {
    return github.graphqlCalls.filter(call => call.name === 'RepositoryBrowseSearch').map(call => call.variables);
}

/** The pages of {@link BROWSED}'s section asked of GitHub, oldest first, without the names. */
function pages(github: GitHubMock, operation: 'RepositoryIssues' | 'RepositoryPullRequests') {
    return github.graphqlCalls
        .filter(call => call.name === operation && call.variables.name === 'tools')
        .map(({ variables: { owner: _owner, name: _name, ...page } }) => page);
}

/** The change polls of the repository answered so far. */
function pollsOf(github: GitHubMock, nameWithOwner: string) {
    return github.restCalls.filter(call => call.url.pathname === `/repos/${nameWithOwner}/issues`).length;
}

/** Every request to GitHub so far that names `text`, in its variables or its address. */
function requestsNaming(github: GitHubMock, text: string) {
    return [
        ...github.graphqlCalls.filter(call => JSON.stringify(call.variables).toLowerCase().includes(text)),
        ...github.restCalls.filter(call => call.url.pathname.toLowerCase().includes(text)),
    ];
}
