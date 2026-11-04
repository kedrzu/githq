import { expect, test } from '../fixtures.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { TrackingScreenHarness } from '../harnesses/TrackingScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

test('a tracked repository opens on its issues grouped by milestone, as a board by issue type a column per type; its pull requests are a section of their own on 2', async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await shell.tracked(SAMPLE_REPOSITORY).click();
    const repository = new RepositoryScreenHarness(page);

    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/issues`);
    await expect(repository.section('Issues')).toHaveAttribute('aria-pressed', 'true');
    await expect(repository.section('Issues')).toHaveText(/Issues\s*3/);
    await expect(repository.section('Pull requests')).toHaveText(/Pull requests\s*1/);
    await expect(repository.groupingButton).toHaveText('Group: Milestone');
    await expect(repository.groups).toHaveText([/^\s*v1\.0\s*1/, /^\s*v2\.0\s*1/, /^\s*No\smilestone\s*1/]);
    await expect(repository.rows('v1.0')).toHaveText([/Crash on start/]);
    await expect(repository.rows('v2.0')).toHaveText([/Add a dark theme/]);
    await expect(repository.rows('No milestone')).toHaveText([/Document the setup/]);

    await repository.layout('Board').click();
    await repository.groupingButton.click();
    await page.getByRole('menuitemradio', { name: 'Issue type' }).click();
    await expect(repository.groupingButton).toHaveText('Group: Issue type');
    await expect(repository.rows('Bug')).toHaveText([/Crash on start/]);
    await expect(repository.rows('Feature')).toHaveText([/Add a dark theme/]);
    await expect(repository.rows('No type')).toHaveText([/Document the setup/]);

    // The pull requests keep their own grouping and layout: a list by milestone.
    await page.keyboard.press('2');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/pulls`);
    await expect(repository.section('Pull requests')).toHaveAttribute('aria-pressed', 'true');
    await expect(repository.groupingButton).toHaveText('Group: Milestone');
    await expect(repository.layout('List')).toHaveAttribute('aria-pressed', 'true');
    await expect(repository.rows('v1.0')).toHaveText([/Fix the crash on start/]);

    await page.keyboard.press('1');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/issues`);
    await expect(repository.groupingButton).toHaveText('Group: Issue type');
});

test("a repository's link opens the section it was left on, and its own address shows that section without a redirect", async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    const repository = new RepositoryScreenHarness(page);
    await page.goto(`/${SAMPLE_REPOSITORY}/pulls`);
    await expect(repository.section('Pull requests')).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/pulls`);

    await shell.myWorkLink('My work').click();
    await expect(page).toHaveURL('/');
    // The link itself names the tab, so the page opens on it rather than switching to it after a first paint.
    await expect(shell.tracked(SAMPLE_REPOSITORY)).toHaveAttribute('href', `/${SAMPLE_REPOSITORY}/pulls`);
    await shell.tracked(SAMPLE_REPOSITORY).click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/pulls`);

    // Typed or pasted, the repository's own address shows that section at once and stays as typed.
    await page.goto(`/${SAMPLE_REPOSITORY}?x=1#top`);
    await expect(repository.section('Pull requests')).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}?x=1#top`);

    await repository.section('Issues').click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/issues?x=1#top`);
    await expect(shell.tracked(SAMPLE_REPOSITORY)).toHaveAttribute('href', `/${SAMPLE_REPOSITORY}/issues`);
});

test("on a section's board, ⇧→ sets the next milestone on GitHub", async ({ page, github }) => {
    const sample = createSampleTrackedWork();
    await openTrackedWork(page, github, sample.world);
    const repository = new RepositoryScreenHarness(page);
    await page.goto(`/${SAMPLE_REPOSITORY}/issues`);
    await repository.layout('Board').click();

    await moveFirstRow(repository, 'v1.0', 'Crash on start');
    await expect(repository.rows('v2.0')).toHaveText([/Crash on start/, /Add a dark theme/]);
    await expect.poll(() => sample.world.stateOf(sample.assignedIssue).milestone).toBe('v2.0');
});

test("in a repository the user may only read, a section's board moves nothing", async ({ page, github }) => {
    const sample = createSampleTrackedWork();
    sample.world.repository(SAMPLE_REPOSITORY, { viewerPermission: 'READ' });
    await openTrackedWork(page, github, sample.world);
    const repository = new RepositoryScreenHarness(page);
    await page.goto(`/${SAMPLE_REPOSITORY}/issues`);
    await repository.layout('Board').click();

    await moveFirstRow(repository, 'v1.0', 'Crash on start');
    await expect(repository.rows('v1.0')).toHaveText([/Crash on start/]);
    await expect(repository.rows('v2.0')).toHaveText([/Add a dark theme/]);
    expect(sample.world.edits).toEqual([]);
});

test('D31, CH37: an untracked repository lists all of its open items, read from GitHub, and offers no button to track it; tracked in Settings, it is counted and kept', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    sample.world.issue({
        repository: 'hubot/tools',
        number: 31,
        title: 'Lint the release notes',
        author: 'hubot',
        foundBy: ['mentioned'],
        minutesAgo: 60,
    });
    sample.world.issue({ repository: 'hubot/tools', number: 32, title: 'Cache the build', minutesAgo: 90 });
    sample.world.pullRequest({
        repository: 'hubot/tools',
        number: 33,
        title: 'Bump the toolchain',
        author: 'hubot',
        minutesAgo: 120,
    });
    const shell = await openTrackedWork(page, github, sample.world);
    const repository = new RepositoryScreenHarness(page);

    await page.goto('/hubot/tools');
    await expect(repository.section('Issues')).toHaveAttribute('aria-pressed', 'true');
    await expect(repository.notTrackedChip).toBeVisible();
    await expect(repository.section('Issues')).toHaveText('Issues');
    await expect(repository.groupingButton).toHaveText('Group: Milestone');
    await expect(repository.rows('No milestone')).toHaveText([/Lint the release notes/, /Cache the build/]);
    await expect(page.getByRole('button', { name: /^Track/ })).toHaveCount(0);

    await repository.section('Pull requests').click();
    await expect(repository.rows('No milestone')).toHaveText([/Bump the toolchain/]);
    await repository.section('Issues').click();
    await expect(repository.rows('No milestone')).toHaveText([/Lint the release notes/, /Cache the build/]);

    await page.goto('/settings?q=hubot%2Ftools');
    const tracking = new TrackingScreenHarness(page);
    await tracking.track('hubot/tools');
    await shell.tracked('hubot/tools').click();

    await expect(repository.groupingButton).toHaveText('Group: Milestone');
    await expect(repository.rows('No milestone')).toHaveText([/Lint the release notes/, /Cache the build/]);
    await expect(repository.section('Pull requests')).toHaveText(/Pull requests\s*1/);
    await expect(shell.trackedCount('hubot/tools')).toHaveText('3');
    await expect(repository.notTrackedChip).toHaveCount(0);
});

/** Selects the first card of the column `group` — `title` — with the board's keys, and presses ⇧→. */
async function moveFirstRow(repository: RepositoryScreenHarness, group: string, title: string) {
    // Away from the tabs, so the keys are the board's.
    await repository.group(group).click({ position: { x: 5, y: 5 } });
    await repository.page.keyboard.press('j');
    await expect(repository.selectedRow).toContainText(title);
    await repository.page.keyboard.press('Shift+ArrowRight');
}
