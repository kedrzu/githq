import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { WorkflowItemHarness } from '../harnesses/WorkflowItem.harness.js';
import type { SettingsRepository } from '../settings/answerSettingsRepository.js';
import { turnOnSaving } from '../settings/turnOnSaving.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

// An opened workflow (`OpenedWorkflow.vue`, `WorkflowView.vue`): in the panel beside the Workflows section or on its
// page, its runs read from GitHub page after page under the filters set, grouped as the settings file says.

const LIST = `/${SAMPLE_REPOSITORY}/actions`;
const PROBE_PAGE = `/${SAMPLE_REPOSITORY}/actions/workflows/probe.yml`;
const DEPLOY_PAGE = `/${SAMPLE_REPOSITORY}/actions/workflows/deploy.yml`;
/** Probe of the sample repository, as the panel's address names it (`owner|name|probe.yml`, encoded). */
const PROBE_PANEL = `${LIST}?pane=workflow&workflow=${encodeURIComponent(`${SAMPLE_REPOSITORY.replace('/', '|')}|probe.yml`)}`;

test('Enter opens a workflow in the panel, Enter again on its page: runs and details side by side there, tabs in the panel; Esc goes back to the panel', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Probe', runs: [{ conclusion: 'success', minutesAgo: 20 }] });
    await openTrackedWork(page, github, world);
    await page.goto(LIST);

    const repository = new RepositoryScreenHarness(page);
    const probe = new WorkflowItemHarness(page, 'Probe');
    await expect(repository.workflow('Probe')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(PROBE_PANEL);
    await expect(probe.runRows).toHaveCount(1);
    await expect(probe.details).toHaveCount(0);

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(PROBE_PAGE);
    await expect(probe.runRows).toHaveCount(1);
    await expect(probe.details).toContainText('Triggers');
    await expect(probe.tab('Details')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(PROBE_PANEL);
    await probe.tab('Details').click();
    await expect(probe.details).toContainText('Triggers');
    await expect(probe.runs).toHaveCount(0);
});

test('narrowed until the panel no longer fits, the workflow in it moves to its page in place of the address', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Probe', runs: [{ conclusion: 'success', minutesAgo: 20 }] });
    await openTrackedWork(page, github, world);
    await page.goto(LIST);

    const probe = new WorkflowItemHarness(page, 'Probe');
    await expect(new RepositoryScreenHarness(page).workflow('Probe')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(PROBE_PANEL);

    await page.setViewportSize({ width: 1000, height: 800 });
    await expect(page).toHaveURL(PROBE_PAGE);
    await expect(probe.runRows).toHaveCount(1);

    // The panel's address was replaced: Back is the list.
    await page.goBack();
    await expect(page).toHaveURL(LIST);
});

test('full screen, j/k walk the runs and Enter opens one; Esc comes back to the workflow full screen on that run', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Deploy',
        runs: [
            { conclusion: 'success', minutesAgo: 60 },
            { conclusion: 'success', minutesAgo: 40 },
            { conclusion: 'success', minutesAgo: 20 },
        ],
    });
    await openTrackedWork(page, github, world);
    await page.goto(DEPLOY_PAGE);

    const deploy = new WorkflowItemHarness(page, 'Deploy');
    await expect(deploy.run(3)).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await expect(deploy.run(1)).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('k');
    await expect(deploy.run(2)).toHaveAttribute('aria-current', 'true');
    await expect(deploy.run(1)).not.toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions/runs/2`);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(DEPLOY_PAGE);
    await expect(deploy.run(2)).toHaveAttribute('aria-current', 'true');
    await expect(deploy.run(3)).not.toHaveAttribute('aria-current', 'true');
});

test('each filter — ref, event, status, actor — is asked of GitHub, and only the runs it lets through show; "Any …" clears it', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    const workflowId = world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Deploy',
        runs: [
            { conclusion: 'failure', minutesAgo: 40, event: 'schedule' },
            { conclusion: 'success', minutesAgo: 30, branch: 'feature', actor: 'hubot' },
            { conclusion: 'failure', minutesAgo: 20, branch: 'feature', event: 'pull_request', actor: 'hubot' },
            { conclusion: 'success', minutesAgo: 10 },
        ],
    });
    await openTrackedWork(page, github, world);
    await page.goto(DEPLOY_PAGE);

    const deploy = new WorkflowItemHarness(page, 'Deploy');
    await expect(deploy.runRows).toHaveCount(4);

    await deploy.filter('Ref', 'feature');
    await expect(deploy.filterChip('Ref')).toHaveAccessibleName('Ref: feature');
    await expectRuns(deploy, [3, 2]);
    await expect.poll(() => lastRunsQuery(github, workflowId)).toMatchObject({ branch: 'feature' });
    await deploy.filter('Ref', null);
    await expectRuns(deploy, [4, 3, 2, 1]);

    await deploy.filter('Event', 'pull request');
    await expectRuns(deploy, [3]);
    await expect.poll(() => lastRunsQuery(github, workflowId)).toMatchObject({ event: 'pull_request' });
    await deploy.filter('Event', null);

    await deploy.filter('Status', 'failure');
    await expectRuns(deploy, [3, 1]);
    await expect.poll(() => lastRunsQuery(github, workflowId)).toMatchObject({ status: 'failure' });

    // Filters add up.
    await deploy.filter('Actor', 'monalisa');
    await expectRuns(deploy, [1]);
    await expect.poll(() => lastRunsQuery(github, workflowId)).toMatchObject({ status: 'failure', actor: 'monalisa' });
    await deploy.filter('Status', null);
    await expectRuns(deploy, [4, 1]);
    await expect.poll(() => lastRunsQuery(github, workflowId)).not.toHaveProperty('status');
});

test('the grouping chosen shows the runs under their groups, is written to the settings file and groups another workflow too', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Deploy',
        // Minutes and a month old: Today and Older whatever the hour.
        runs: [
            { conclusion: 'failure', minutesAgo: 30 * 24 * 60, event: 'schedule' },
            { conclusion: 'success', minutesAgo: 2, branch: 'feature', actor: 'hubot' },
            { conclusion: 'success', minutesAgo: 1 },
        ],
    });
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Probe', runs: [{ conclusion: 'success', minutesAgo: 20 }] });
    await openTrackedWork(page, github, world);
    const repository = await turnOnSaving(page, github, { exists: false, file: null });
    await page.goto(DEPLOY_PAGE);

    const deploy = new WorkflowItemHarness(page, 'Deploy');
    await expect(deploy.runRows).toHaveCount(3);
    await expect(deploy.groupHeadings).toHaveCount(0);

    await deploy.groupBy('Status');
    await expect(deploy.groupHeadings).toHaveText([/^Failed\s*1$/u, /^Succeeded\s*2$/u]);
    await expect.poll(() => readSettings(repository)).toMatchObject({ workflowRuns: { groupBy: 'status' } });

    await deploy.groupBy('Ref');
    await expect(deploy.groupHeadings).toHaveText([/^main\s*2$/u, /^Other branches\s*1$/u]);
    await deploy.groupBy('Event');
    await expect(deploy.groupHeadings).toHaveText([/^push\s*2$/u, /^schedule\s*1$/u]);
    await deploy.groupBy('Day');
    await expect(deploy.groupHeadings).toHaveText([/^Today\s*2$/u, /^Older\s*1$/u]);
    await deploy.groupBy('Actor');
    await expect(deploy.groupHeadings).toHaveText([/^monalisa\s*2$/u, /^hubot\s*1$/u]);
    await expect.poll(() => readSettings(repository)).toMatchObject({ workflowRuns: { groupBy: 'actor' } });

    // A heading folds its group.
    await deploy.groupHeadings.filter({ hasText: 'hubot' }).getByRole('button').click();
    await expect(deploy.runRows).toHaveCount(2);

    await page.goto(PROBE_PAGE);
    await expect(new WorkflowItemHarness(page, 'Probe').groupHeadings).toHaveText([/^monalisa\s*1$/u]);
});

test('scrolling to the end of the runs reads the next page from GitHub, until there is none', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    // 45 runs: a page of 30, then the 15 left.
    const workflowId = world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Probe',
        runs: Array.from({ length: 45 }, (_, index) => ({ conclusion: 'success', minutesAgo: 900 - index * 10 })),
    });
    await openTrackedWork(page, github, world);
    await page.goto(PROBE_PAGE);

    const probe = new WorkflowItemHarness(page, 'Probe');
    await expect(probe.count).toHaveText('30+ runs · newest first');
    await expect(probe.runRows).toHaveCount(30);
    expect(pagesRead(github, workflowId)).not.toContain('2');

    await probe.runRows.last().scrollIntoViewIfNeeded();
    await expect(probe.count).toHaveText('45 runs · newest first');
    await expect(probe.runRows).toHaveCount(45);
    await expect(probe.run(1)).toBeVisible();
    expect(pagesRead(github, workflowId)).toContain('2');
});

/** The runs shown, by their numbers, in order. */
async function expectRuns(workflow: WorkflowItemHarness, numbers: readonly number[]) {
    await expect(workflow.runRows).toHaveText(numbers.map(number => new RegExp(`#${number}(?!\\d)`, 'u')));
}

/** The REST reads of the workflow's runs, oldest first. */
function runsCalls(github: GitHubMock, workflowId: number) {
    return github.restCalls.filter(call => call.url.pathname.endsWith(`/actions/workflows/${workflowId}/runs`));
}

/** Which page each read of the workflow's runs asked for: `null` the first. */
function pagesRead(github: GitHubMock, workflowId: number) {
    return runsCalls(github, workflowId).map(call => call.url.searchParams.get('page'));
}

/** The query of the last read of the workflow's runs. */
function lastRunsQuery(github: GitHubMock, workflowId: number) {
    return Object.fromEntries(runsCalls(github, workflowId).at(-1)?.url.searchParams ?? []);
}

function readSettings(repository: SettingsRepository): unknown {
    return repository.file && JSON.parse(repository.file.text);
}

test('W41: ⌘K disables the workflow, which shows disabled at once and offers to enable it again; none on a key', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Deploy',
        runs: [{ conclusion: 'success', minutesAgo: 20 }],
    });
    await openTrackedWork(page, github, world);
    await page.goto(DEPLOY_PAGE);
    const deploy = new WorkflowItemHarness(page, 'Deploy');
    await expect(deploy.details).toContainText('Disable workflow in the command menu');

    const menu = new CommandMenuHarness(page);
    await menu.open();
    for (const name of [/Disable workflow/u, /Open workflow file/u, /Copy link to the workflow/u]) {
        await expect(menu.option(name)).toHaveCount(1);
        await expect(menu.option(name).locator('kbd')).toHaveCount(0);
    }
    await page.keyboard.press('Escape');

    await menu.run('Disable workflow');

    await expect(deploy.details).toContainText('Enable workflow in the command menu');
    const toggles = () =>
        github.restCalls.filter(call => /\/actions\/workflows\/\d+\/(enable|disable)$/u.test(call.url.pathname));
    await expect.poll(() => toggles().map(call => call.url.pathname.split('/').at(-1))).toEqual(['disable']);
    await menu.open();
    await expect(menu.option(/Enable workflow/u)).toHaveCount(1);
    await expect(menu.option(/Disable workflow/u)).toHaveCount(0);
});

test('W40: full screen, ⌘K cancels the run under the cursor while it goes, and re-runs all the jobs of one that finished', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Deploy',
        runs: [
            { conclusion: 'success', minutesAgo: 40 },
            { conclusion: null, minutesAgo: 20 },
        ],
    });
    await openTrackedWork(page, github, world);
    await page.goto(DEPLOY_PAGE);
    const deploy = new WorkflowItemHarness(page, 'Deploy');
    await expect(deploy.run(2)).toHaveAttribute('aria-current', 'true');

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await expect(menu.option(/Re-run all jobs/u)).toHaveCount(0);
    await expect(menu.option(/Cancel run/u)).toContainText('#2');
    await page.keyboard.press('Escape');
    await menu.run('Cancel run');
    await expect
        .poll(() => github.restCalls.filter(call => call.url.pathname.endsWith('/actions/runs/2/cancel')).length)
        .toBe(1);

    await page.keyboard.press('j');
    await expect(deploy.run(1)).toHaveAttribute('aria-current', 'true');
    await menu.open();
    await expect(menu.option(/Cancel run/u)).toHaveCount(0);
    await expect(menu.option(/Re-run all jobs/u)).toContainText('#1');
});
