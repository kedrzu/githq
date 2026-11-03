import { expect, test } from '../fixtures.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { WorkflowRunScreenHarness } from '../harnesses/WorkflowRunScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

const RUN_LOG = [
    '2026-11-02T11:46:01.0000000Z ##[group]Run bun run build',
    '2026-11-02T11:46:02.0000000Z building <b>the</b> bundle',
    '2026-11-02T11:46:03.0000000Z ##[error]Process completed with exit code 1.',
].join('\n');

const BUILD = {
    name: 'build',
    conclusion: 'failure',
    steps: [
        { name: 'Set up job', conclusion: 'success' },
        { name: 'Run bun run build', conclusion: 'failure' },
    ],
};
const LINT = { name: 'lint', conclusion: 'success', steps: [{ name: 'Run lint', conclusion: 'success' }] };

/** A world with a repository whose workflow Deploy has one run failed 30 minutes ago; returns its id. */
function createFailedRun(conclusion: string | null = 'failure') {
    const { world } = createSampleTrackedWork();
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Deploy', runs: [] });
    const runId = world.workflowRun(SAMPLE_REPOSITORY, 'Deploy', { conclusion, minutesAgo: 30 });
    return { world, runId, path: `/${SAMPLE_REPOSITORY}/actions/runs/${runId}` };
}

test('a failed run at its address: what is known, failed jobs first with the failed step marked, the log as text; ⌥J/⌥K replace the address', async ({
    page,
    github,
}) => {
    const { world, runId, path } = createFailedRun();
    const [lintId, buildId] = world.runJobs(SAMPLE_REPOSITORY, runId, [LINT, BUILD]);
    world.jobLog(SAMPLE_REPOSITORY, buildId ?? 0, RUN_LOG);
    world.jobLog(SAMPLE_REPOSITORY, lintId ?? 0, '2026-11-02T11:46:01.0000000Z all fine');
    await openTrackedWork(page, github, world);
    // Nothing of a run is read until its page asks.
    expect(github.restCalls.filter(call => /\/actions\/(runs\/\d+|jobs\/)/u.test(call.url.pathname))).toEqual([]);
    await page.goto(path);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.heading(`Deploy #${runId}`)).toBeVisible();
    await expect(screen.summary).toContainText('Failed');
    await expect(screen.summary).toContainText('main');
    await expect(screen.summary).toContainText('push');
    await expect(screen.jobs).toHaveText([/build/u, /lint/u]);
    await expect(screen.job('build')).toHaveAttribute('aria-current', 'true');
    await expect(screen.steps).toHaveCount(2);
    await expect(screen.steps.nth(1)).toHaveAttribute('data-mark', 'failed');
    await expect(screen.logLines.filter({ hasText: 'building <b>the</b> bundle' })).toBeVisible();
    await expect(page).toHaveURL(path);

    await page.keyboard.press('Alt+j');
    await expect(page).toHaveURL(`${path}/job/${lintId}`);
    await expect(screen.job('lint')).toHaveAttribute('aria-current', 'true');
    await expect(screen.logLines).toHaveText(['all fine']);
    await page.keyboard.press('Alt+k');
    await expect(page).toHaveURL(`${path}/job/${buildId}`);

    // Opening at a job selects it.
    await page.goto(`${path}/job/${lintId}`);
    await expect(screen.job('lint')).toHaveAttribute('aria-current', 'true');
    await expect(screen.logLines).toHaveText(['all fine']);
});

test('with no history Esc goes to the repository’s Workflows tab; O and ⌘K open the run on GitHub in a new tab, the page staying', async ({
    page,
    github,
}) => {
    const { world, runId, path } = createFailedRun();
    world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD]);
    await openTrackedWork(page, github, world);
    await page.goto(path);
    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.job('build')).toBeVisible();

    github.web(path, () => ({ status: 200, body: '<title>Run</title>' }));
    const popup = page.waitForEvent('popup');
    await page.keyboard.press('o');
    const opened = await popup;
    expect(opened.url()).toBe(`https://github.com${path}`);
    await opened.close();

    const fromMenu = page.waitForEvent('popup');
    await new CommandMenuHarness(page).run('Open on GitHub');
    const openedFromMenu = await fromMenu;
    expect(openedFromMenu.url()).toBe(`https://github.com${path}`);
    await openedFromMenu.close();
    await expect(page).toHaveURL(path);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    await expect(new RepositoryScreenHarness(page).workflow('Deploy')).toBeVisible();
});

test('a tick of the strip is a link to the run in githq, and Esc comes back', async ({ page, github }) => {
    const { world, runId, path } = createFailedRun();
    const [lintId] = world.runJobs(SAMPLE_REPOSITORY, runId, [LINT, BUILD]);
    await openTrackedWork(page, github, world);
    await page.goto(`/${SAMPLE_REPOSITORY}/actions`);

    const tick = page.getByRole('main').locator(`a[href="${path}"]`);
    await expect(tick).toHaveCount(1);
    await tick.click({ force: true });
    await expect(page).toHaveURL(path);

    await expect(new WorkflowRunScreenHarness(page).job('build')).toBeVisible();
    // A job selected leaves no history entry: Esc still comes back in one step.
    await page.keyboard.press('Alt+j');
    await expect(page).toHaveURL(`${path}/job/${lintId}`);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
});

test('W4e: nothing but the log waits, Esc and O work while it loads', async ({ page, github }) => {
    const { world, runId, path } = createFailedRun();
    const [buildId] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD]);
    world.jobLog(SAMPLE_REPOSITORY, buildId ?? 0, RUN_LOG);
    await openTrackedWork(page, github, world);

    // Through the app, so what the sync stored shows; GitHub holds every answer.
    await page.goto(`/${SAMPLE_REPOSITORY}/actions`);
    const repository = new RepositoryScreenHarness(page);
    await expect(repository.workflow('Deploy')).toHaveAttribute('aria-current', 'true');
    github.holdAnswers();
    await page.keyboard.press('Enter');

    const screen = new WorkflowRunScreenHarness(page);
    await expect(page).toHaveURL(path);
    await expect(screen.heading(`Deploy #${runId}`)).toBeVisible();
    await expect(screen.summary).toContainText('Failed');
    await expect(page.getByTestId('workflow-jobs-placeholder')).toBeVisible();
    await expect(page.getByTestId('workflow-log-placeholder')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    github.releaseAnswers();
});

test('W4f: a failed run with no jobs is a page of its own', async ({ page, github }) => {
    const { world, path } = createFailedRun();
    await openTrackedWork(page, github, world);
    await page.goto(path);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.message('Failed before the first job')).toBeVisible();
    await expect(screen.root).toContainText('invalid workflow file');
    await expect(screen.jobs).toHaveCount(0);
});

test('W4g: a log past retention says so, the jobs and steps still there', async ({ page, github }) => {
    const { world, runId, path } = createFailedRun();
    const [buildId] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD]);
    world.jobLog(SAMPLE_REPOSITORY, buildId ?? 0, 410);
    await openTrackedWork(page, github, world);
    await page.goto(path);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.message('This log was garbage-collected')).toBeVisible();
    await expect(screen.root).toContainText('It failed at Run bun run build.');
    await expect(screen.steps).toHaveCount(2);
});

test('W4i: one job’s log failing leaves the rest working, with GitHub’s status; Enter tries again', async ({
    page,
    github,
}) => {
    const { world, runId, path } = createFailedRun();
    const [lintId, buildId] = world.runJobs(SAMPLE_REPOSITORY, runId, [LINT, BUILD]);
    world.jobLog(SAMPLE_REPOSITORY, buildId ?? 0, 502);
    world.jobLog(SAMPLE_REPOSITORY, lintId ?? 0, '2026-11-02T11:46:01.0000000Z all fine');
    await openTrackedWork(page, github, world);
    await page.goto(path);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.message("The log of build didn't load")).toBeVisible();
    await expect(screen.root).toContainText(`GET …/jobs/${buildId}/logs → 502`);

    await page.keyboard.press('Alt+j');
    await expect(screen.logLines).toHaveText(['all fine']);
    await page.keyboard.press('Alt+k');
    await expect(screen.message("The log of build didn't load")).toBeVisible();

    world.jobLog(SAMPLE_REPOSITORY, buildId ?? 0, RUN_LOG);
    await page.keyboard.press('Enter');
    await expect(screen.logLines.filter({ hasText: 'building' })).toBeVisible();
});

test('W4j: a running job reads no log; its log opens by itself once it finishes, the run’s state following, and the asking stops', async ({
    page,
    github,
}) => {
    await page.clock.install();
    const { world, runId, path } = createFailedRun(null);
    const [buildId] = world.runJobs(SAMPLE_REPOSITORY, runId, [{ name: 'build', conclusion: null, steps: [] }]);
    const logPath = `/repos/${SAMPLE_REPOSITORY}/actions/jobs/${buildId}/logs`;
    world.jobLog(SAMPLE_REPOSITORY, buildId ?? 0, RUN_LOG);
    await openTrackedWork(page, github, world);
    await page.goto(path);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.message('build is still running')).toBeVisible();
    await expect(screen.summary).toContainText('Running');
    expect(github.restCalls.filter(call => call.url.pathname === logPath)).toHaveLength(0);

    // Still running at the next ask.
    await page.clock.fastForward('00:31');
    await expect(screen.message('build is still running')).toBeVisible();
    expect(github.restCalls.filter(call => call.url.pathname === logPath)).toHaveLength(0);

    world.finishRun(SAMPLE_REPOSITORY, runId, 'failure');
    // A world's `runJobs` numbers jobs anew: the log belongs to the new id.
    const [finishedId] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD]);
    world.jobLog(SAMPLE_REPOSITORY, finishedId ?? 0, RUN_LOG);
    await page.clock.fastForward('00:31');

    await expect(screen.logLines.filter({ hasText: 'building' })).toBeVisible();
    await expect(screen.summary).toContainText('Failed');

    const runCalls = () => github.restCalls.filter(call => call.url.pathname.endsWith(`/actions/runs/${runId}`)).length;
    const after = runCalls();
    await page.clock.fastForward('01:01');
    await expect.poll(runCalls).toBe(after);
});

test('a run GitHub won’t show says so, with a way to GitHub', async ({ page, github }) => {
    const { world } = createFailedRun();
    await openTrackedWork(page, github, world);
    await page.goto(`/${SAMPLE_REPOSITORY}/actions/runs/999`);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.message('GitHub shows no such run')).toBeVisible();
    await expect(screen.root.getByRole('button', { name: /Open on GitHub/u })).toBeVisible();
});

test('a passed run’s page works: its first job selected, no error', async ({ page, github }) => {
    const { world, runId, path } = createFailedRun('success');
    const [lintId] = world.runJobs(SAMPLE_REPOSITORY, runId, [LINT]);
    world.jobLog(SAMPLE_REPOSITORY, lintId ?? 0, '2026-11-02T11:46:01.0000000Z all fine');
    await openTrackedWork(page, github, world);
    await page.goto(path);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.job('lint')).toHaveAttribute('aria-current', 'true');
    await expect(screen.summary).toContainText('Passed');
    await expect(screen.logLines).toHaveText(['all fine']);
});

test('under `actions/` of a tracked repository everything but a run and its job is GitHub’s page', async ({
    page,
    github,
}) => {
    const { world, runId } = createFailedRun();
    await openTrackedWork(page, github, world);

    for (const address of [
        `/${SAMPLE_REPOSITORY}/actions/runs/${runId}/usage`,
        `/${SAMPLE_REPOSITORY}/actions/runs/${runId}/attempts/1`,
        `/${SAMPLE_REPOSITORY}/actions/workflows/deploy.yml`,
    ]) {
        github.web(address, () => ({ status: 200, body: address }));
        await page.goto(address);
        await expect(page).toHaveURL(`https://github.com${address}`);
    }
});
