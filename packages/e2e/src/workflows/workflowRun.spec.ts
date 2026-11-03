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
    await expect(screen.logTexts).toHaveText(['all fine']);
    await page.keyboard.press('Alt+k');
    await expect(page).toHaveURL(`${path}/job/${buildId}`);

    // Opening at a job selects it.
    await page.goto(`${path}/job/${lintId}`);
    await expect(screen.job('lint')).toHaveAttribute('aria-current', 'true');
    await expect(screen.logTexts).toHaveText(['all fine']);
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
    await expect(screen.logTexts).toHaveText(['all fine']);
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

test('W4a: the log opens at the failed step’s error, passed steps folded; the keys move through it, opening what they move into', async ({
    page,
    github,
}) => {
    const { world, runId, path } = createFailedRun();
    const [buildId = 0] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD]);
    world.jobLogBySteps(SAMPLE_REPOSITORY, runId, buildId, {
        1: ['Runner image'],
        2: ['building', '##[error]Process completed with exit code 1.', 'after it'],
    });
    await openTrackedWork(page, github, world);
    await page.goto(path);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.cursorLine).toContainText('Error: Process completed with exit code 1.');
    await expect(screen.logErrors).toHaveText(/Error\s1\sof\s1/u);
    await expect(screen.logStep('Set up job')).toHaveAttribute('aria-expanded', 'false');
    await expect(screen.logStep('Run bun run build')).toHaveAttribute('aria-expanded', 'true');
    await expect(screen.logLines.filter({ hasText: 'Runner image' })).toHaveCount(0);

    await page.keyboard.press('k');
    await expect(screen.cursorLine).toContainText('building');
    await page.keyboard.press('Shift+K');
    await expect(screen.cursorLine).toContainText('Runner image');
    await expect(screen.logStep('Set up job')).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Space');
    await expect(screen.logStep('Set up job')).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('e');
    await expect(screen.cursorLine).toContainText('Process completed');

    // The help lists the log's keys.
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog')).toContainText('Copy a link to the line');
    await page.keyboard.press('Escape');
});

test('Y copies the line’s address, in GitHub’s form; opening that address lands on the line, its step opened', async ({
    page,
    github,
    context,
}) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const { world, runId, path } = createFailedRun();
    const [buildId = 0] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD]);
    world.jobLogBySteps(SAMPLE_REPOSITORY, runId, buildId, {
        1: ['Runner image', 'Prepared'],
        2: ['##[error]exit code 1'],
    });
    await openTrackedWork(page, github, world);
    await page.goto(path);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.cursorLine).toContainText('exit code 1');
    await page.keyboard.press('Shift+K');
    await page.keyboard.press('j');
    await expect(screen.cursorLine).toContainText('Prepared');
    await page.keyboard.press('y');
    await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe(`https://github.com${path}/job/${buildId}#step:1:2`);

    await page.goto(`${path}/job/${buildId}#step:1:2`);
    await expect(screen.cursorLine).toContainText('Prepared');
    await expect(screen.logStep('Set up job')).toHaveAttribute('aria-expanded', 'true');
});

test('W4h: no error marker: opens at the end, saying so', async ({ page, github }) => {
    const { world, runId, path } = createFailedRun();
    const [buildId = 0] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD]);
    world.jobLogBySteps(SAMPLE_REPOSITORY, runId, buildId, { 2: ['first', 'the very last'] });
    await openTrackedWork(page, github, world);
    await page.goto(path);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.cursorLine).toContainText('the very last');
    await expect(screen.logErrors).toHaveText('No error marker');
    await expect(page.getByTestId('workflow-log-end')).toContainText('The job failed without an error marker');
});

test('W4d: W wraps and T shows times, and both stay on for the next session; a log of 100,000 lines keeps few rows in the DOM', async ({
    page,
    github,
}) => {
    const { world, runId, path } = createFailedRun();
    const [buildId = 0] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD]);
    const long = `at ${'node_modules/rollup/dist/'.repeat(30)}`;
    world.jobLogBySteps(SAMPLE_REPOSITORY, runId, buildId, {
        2: [long, ...Array.from({ length: 100_000 }, (_, index) => `line ${index}`), '##[error]exit code 1'],
    });
    await openTrackedWork(page, github, world);
    await page.goto(path);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.cursorLine).toContainText('exit code 1');
    await expect(screen.log.getByRole('listitem').nth(0)).toBeVisible();
    expect(await screen.log.getByRole('listitem').count()).toBeLessThan(120);

    await page.keyboard.press('w');
    await page.keyboard.press('t');
    await expect(page.getByTestId('workflow-log-wrap')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('workflow-log-times')).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('g');
    await expect(screen.logLines.filter({ hasText: 'rollup' }).first()).toBeVisible();
    const box = await screen.logLines.filter({ hasText: 'rollup' }).first().boundingBox();
    expect(box?.height).toBeGreaterThan(18);
    expect(await screen.log.getByRole('listitem').count()).toBeLessThan(120);

    await page.reload();
    await expect(page.getByTestId('workflow-log-wrap')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('workflow-log-times')).toHaveAttribute('aria-pressed', 'true');
});

test('text selected with the mouse stays selected, and copies without the line numbers; a click on a line takes the cursor', async ({
    page,
    github,
}) => {
    const { world, runId, path } = createFailedRun();
    const [buildId = 0] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD]);
    world.jobLogBySteps(SAMPLE_REPOSITORY, runId, buildId, {
        2: ['first of the trace', 'second of the trace', '##[error]exit code 1'],
    });
    await openTrackedWork(page, github, world);
    await page.goto(path);

    const screen = new WorkflowRunScreenHarness(page);
    const first = screen.logLines.filter({ hasText: 'first of the trace' });
    const second = screen.logLines.filter({ hasText: 'second of the trace' });
    await expect(first).toBeVisible();

    await first.click();
    await expect(screen.cursorLine).toContainText('first of the trace');

    const from = await first.boundingBox();
    const to = await second.boundingBox();
    await page.mouse.move((from?.x ?? 0) + 66, (from?.y ?? 0) + 9);
    await page.mouse.down();
    await page.mouse.move((to?.x ?? 0) + 200, (to?.y ?? 0) + 9, { steps: 5 });
    await page.mouse.up();

    const selected = await page.evaluate(() => window.getSelection()?.toString());
    expect(selected).toContain('first of the trace');
    expect(selected).toContain('second of the trace');
    expect(selected).not.toMatch(/^\s*\d/u);
    await expect(screen.cursorLine).toContainText('first of the trace');
});

test('a just-finished job’s log GitHub has no answer for yet is not called gone: it is asked again, and the status bar says what is being read', async ({
    page,
    github,
}) => {
    await page.clock.install();
    const { world } = createSampleTrackedWork();
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Deploy', runs: [] });
    const runId = world.workflowRun(SAMPLE_REPOSITORY, 'Deploy', { conclusion: 'failure', minutesAgo: 1 });
    const [buildId = 0] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD]);
    world.jobLog(SAMPLE_REPOSITORY, buildId, 404);
    await openTrackedWork(page, github, world);
    await page.goto(`/${SAMPLE_REPOSITORY}/actions/runs/${runId}`);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.job('build')).toBeVisible();
    await expect(page.getByTestId('workflow-log-placeholder')).toBeVisible();
    await expect(page.getByText('Reading the log of build…')).toBeVisible();
    await expect(screen.message('This log was garbage-collected')).toHaveCount(0);

    world.jobLog(SAMPLE_REPOSITORY, buildId, RUN_LOG);
    await page.clock.fastForward('00:31');
    await expect(screen.logLines.filter({ hasText: 'building' })).toBeVisible();
    await expect(page.getByText('Reading the log of build…')).toHaveCount(0);
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
    await expect(screen.logTexts).toHaveText(['all fine']);
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
