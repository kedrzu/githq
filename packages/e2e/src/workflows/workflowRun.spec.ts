import { expect, test } from '../fixtures.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
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

test('with no history Esc goes to the repository’s Workflows section; O and ⌘K open the selected job on GitHub in a new tab, the page staying', async ({
    page,
    github,
}) => {
    const { world, runId, path } = createFailedRun();
    const [buildId] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD]);
    const jobPath = `${path}/job/${buildId}`;
    await openTrackedWork(page, github, world);
    await page.goto(path);
    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.job('build')).toBeVisible();

    github.web(jobPath, () => ({ status: 200, body: '<title>Job</title>' }));
    const popup = page.waitForEvent('popup');
    await page.keyboard.press('o');
    const opened = await popup;
    expect(opened.url()).toBe(`https://github.com${jobPath}`);
    await opened.close();

    const fromMenu = page.waitForEvent('popup');
    await new CommandMenuHarness(page).run('Open on GitHub');
    const openedFromMenu = await fromMenu;
    expect(openedFromMenu.url()).toBe(`https://github.com${jobPath}`);
    await openedFromMenu.close();
    await expect(page).toHaveURL(path);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    await expect(new RepositoryScreenHarness(page).workflow('Deploy')).toBeVisible();
});

test('the way to GitHub in what stands in for the log goes to the job', async ({ page, github }) => {
    const { world, runId, path } = createFailedRun(null);
    const [buildId] = world.runJobs(SAMPLE_REPOSITORY, runId, [{ name: 'build', conclusion: null, steps: [] }]);
    const jobPath = `${path}/job/${buildId}`;
    await openTrackedWork(page, github, world);
    await page.goto(path);
    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.message('build is still running')).toBeVisible();

    github.web(jobPath, () => ({ status: 200, body: '<title>Job</title>' }));
    const watching = page.waitForEvent('popup');
    await screen.watchOnGitHub.click();
    const watched = await watching;
    expect(watched.url()).toBe(`https://github.com${jobPath}`);
    await watched.close();
});

test('with no job to select, O opens the run on GitHub', async ({ page, github }) => {
    const { world, path } = createFailedRun();
    await openTrackedWork(page, github, world);
    await page.goto(path);
    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.message('Failed before the first job')).toBeVisible();

    github.web(path, () => ({ status: 200, body: '<title>Run</title>' }));
    const seeing = page.waitForEvent('popup');
    await page.keyboard.press('o');
    const seen = await seeing;
    expect(seen.url()).toBe(`https://github.com${path}`);
    await seen.close();
});

test('a click on a broken workflow’s strip is a click on its row: the failed run in githq, and Esc comes back', async ({
    page,
    github,
}) => {
    const { world, runId, path } = createFailedRun();
    const [lintId] = world.runJobs(SAMPLE_REPOSITORY, runId, [LINT, BUILD]);
    await openTrackedWork(page, github, world);
    await page.goto(`/${SAMPLE_REPOSITORY}/actions`);

    await page.getByRole('main').getByTestId('run-strip').first().click();
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
    await expect(screen.jobsPlaceholder).toBeVisible();
    await expect(screen.logPlaceholder).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    github.releaseAnswers();
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
    await expect(new AppShellHarness(page).statusBar).toContainText("The log of build didn't load");

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
    await expect(new AppShellHarness(page).statusBar).toContainText(/Status checked \d+s ago/u);
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

test('W4j: with no job in the address the job shown stays when it passes, its log opening, not the next one’s wait', async ({
    page,
    github,
}) => {
    await page.clock.install();
    const { world, runId, path } = createFailedRun(null);
    const [buildId = 0] = world.runJobs(SAMPLE_REPOSITORY, runId, [
        { name: 'build', conclusion: null },
        { name: 'deploy', conclusion: null, status: 'queued' },
    ]);
    await openTrackedWork(page, github, world);
    await page.goto(path);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.message('build is still running')).toBeVisible();
    await expect(screen.job('deploy')).toContainText('waiting');

    world.finishJob(SAMPLE_REPOSITORY, runId, buildId, 'success');
    world.jobLog(SAMPLE_REPOSITORY, buildId, '2026-11-02T11:46:01.0000000Z all built');
    await page.clock.fastForward('00:31');

    await expect(screen.logTexts).toHaveText(['all built']);
    await expect(screen.jobs).toHaveText([/deploy/u, /build/u]);
    await expect(screen.job('build')).toHaveAttribute('aria-current', 'true');
    await expect(page).toHaveURL(path);
});

test('a job failing later stands first, marked, and takes nothing over: the cursor stays, the keys reach it', async ({
    page,
    github,
}) => {
    await page.clock.install();
    const { world, runId, path } = createFailedRun(null);
    const [earlierId = 0, buildId = 0] = world.runJobs(SAMPLE_REPOSITORY, runId, [
        { name: 'earlier', conclusion: null },
        BUILD,
    ]);
    world.jobLogBySteps(SAMPLE_REPOSITORY, runId, buildId, {
        2: ['first of the trace', 'second of the trace', '##[error]exit code 1'],
    });
    await openTrackedWork(page, github, world);
    await page.goto(path);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.cursorLine).toContainText('exit code 1');
    await page.keyboard.press('k');
    await expect(screen.cursorLine).toContainText('second of the trace');

    world.finishJob(SAMPLE_REPOSITORY, runId, earlierId, 'failure');
    world.jobLog(SAMPLE_REPOSITORY, earlierId, '2026-11-02T11:46:01.0000000Z it broke');
    await page.clock.fastForward('00:31');

    await expect(screen.jobs).toHaveText([/earlier/u, /build/u]);
    await expect(screen.job('earlier')).toHaveAttribute('data-mark', 'failed');
    await expect(screen.job('build')).toHaveAttribute('aria-current', 'true');
    await expect(screen.cursorLine).toContainText('second of the trace');

    await page.keyboard.press('Alt+k');
    await expect(page).toHaveURL(`${path}/job/${earlierId}`);
    await expect(screen.logTexts).toHaveText(['it broke']);
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

test('a line’s address for a job the run no longer has opens the job shown at its own error, not at that line number', async ({
    page,
    github,
}) => {
    const { world, runId, path } = createFailedRun();
    const [buildId = 0] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD]);
    world.jobLogBySteps(SAMPLE_REPOSITORY, runId, buildId, {
        1: ['Runner image', 'Prepared'],
        2: ['##[error]exit code 1'],
    });
    await openTrackedWork(page, github, world);
    await page.goto(`${path}/job/${buildId + 1000}#step:1:2`);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.job('build')).toHaveAttribute('aria-current', 'true');
    await expect(screen.cursorLine).toContainText('exit code 1');
    await expect(screen.logStep('Set up job')).toHaveAttribute('aria-expanded', 'false');
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
    await expect(screen.logPlaceholder).toBeVisible();
    await expect(new AppShellHarness(page).statusBar).toContainText('Reading the log of build…');
    await expect(screen.message('This log was garbage-collected')).toHaveCount(0);

    world.jobLog(SAMPLE_REPOSITORY, buildId, RUN_LOG);
    await page.clock.fastForward('00:31');
    await expect(screen.logLines.filter({ hasText: 'building' })).toBeVisible();
    await expect(new AppShellHarness(page).statusBar).not.toContainText('Reading the log of build…');
});

test('a log GitHub had no answer for just after its job ended is asked for again on coming back to it', async ({
    page,
    github,
}) => {
    await page.clock.install();
    const { world } = createSampleTrackedWork();
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Deploy', runs: [] });
    const runId = world.workflowRun(SAMPLE_REPOSITORY, 'Deploy', { conclusion: 'failure', minutesAgo: 1 });
    const [buildId = 0, lintId = 0] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD, LINT]);
    world.jobLog(SAMPLE_REPOSITORY, buildId, 404);
    world.jobLog(SAMPLE_REPOSITORY, lintId, '2026-11-02T11:46:01.0000000Z all fine');
    await openTrackedWork(page, github, world);
    await page.goto(`/${SAMPLE_REPOSITORY}/actions/runs/${runId}`);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.job('build')).toBeVisible();
    await expect(screen.logPlaceholder).toBeVisible();

    // Away past the minutes a log takes to land: it lands meanwhile, with nothing asking for it.
    await page.keyboard.press('Alt+j');
    await expect(screen.logTexts).toHaveText(['all fine']);
    await page.clock.fastForward('06:00');
    world.jobLog(SAMPLE_REPOSITORY, buildId, RUN_LOG);

    await page.keyboard.press('Alt+k');
    await expect(screen.logLines.filter({ hasText: 'building' })).toBeVisible();
    await expect(screen.message('This log was garbage-collected')).toHaveCount(0);
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

test('searching a job’s log: from memory, folded steps included, next and only the matches; another job keeps the query; Esc returns, a second goes back', async ({
    page,
    github,
}) => {
    const { world, runId, path } = createFailedRun();
    const [buildId, lintId] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD, LINT]);
    world.jobLogBySteps(SAMPLE_REPOSITORY, runId, buildId ?? 0, {
        1: ['installing <b>resolve</b> first'],
        2: [
            ...Array.from({ length: 30 }, (_, index) => `building ${index}`),
            'could not resolve the module',
            '##[error]Process completed with exit code 1.',
        ],
    });
    world.jobLogBySteps(SAMPLE_REPOSITORY, runId, lintId ?? 0, { 1: ['nothing to resolve here'] });
    await openTrackedWork(page, github, world);
    await page.goto(path);
    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.cursorLine).toContainText('Process completed');
    const before = await screen.cursorLine.textContent();
    await expect(screen.logStep('Set up job')).toHaveAttribute('aria-expanded', 'false');
    const calls = github.restCalls.length;

    await page.keyboard.press('/');
    await expect(screen.searchField).toBeFocused();
    await page.keyboard.type('resolve');
    await expect(screen.searchPosition).toHaveText('1 of 2');
    await expect(screen.jobMatches).toContainText('2');
    await expect(screen.stepMatches).toHaveCount(2);
    // The cursor was past both: the first from there wraps around, into the folded step.
    await expect(screen.logStep('Set up job')).toHaveAttribute('aria-expanded', 'true');
    await expect(screen.cursorLine).toContainText('<b>resolve</b>');
    await expect(screen.cursorLine.locator('mark')).toHaveText('resolve');
    await page.keyboard.press('Enter');
    await expect(screen.searchPosition).toHaveText('2 of 2');
    await expect(screen.cursorLine).toContainText('could not resolve');
    expect(github.restCalls.length).toBe(calls);

    // Only the matches: the numbers kept, gaps counted.
    await page.keyboard.press('Tab');
    await expect(screen.searchPosition).toHaveText('2 lines');
    await expect(screen.logGaps.first()).toBeVisible();
    await expect(screen.logLines).toHaveCount(2);
    await page.keyboard.press('Tab');
    await expect(screen.searchPosition).toHaveText('2 of 2');
    await expect(screen.logGaps).toHaveCount(0);

    // Another job: the query kept, that job searched, no read of this one's log again.
    await page.keyboard.press('Alt+j');
    await expect(screen.job('lint')).toHaveAttribute('aria-current', 'true');
    await expect(screen.searchField).toHaveValue('resolve');
    await expect(screen.searchPosition).toHaveText('1 of 1');
    await expect(screen.jobMatches).toContainText('1');
    await page.keyboard.press('Alt+k');
    await expect(screen.job('build')).toHaveAttribute('aria-current', 'true');
    await expect(screen.searchPosition).toHaveText('1 of 2');

    // Esc: closed, and where the log opened; again: back.
    await page.keyboard.press('Escape');
    await expect(screen.search).toHaveCount(0);
    await expect(screen.cursorLine).toHaveText(before ?? '');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);

    // The query didn't stay for the next time the page opens.
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(path);
    await expect(screen.cursorLine).toContainText('Process completed');
    await expect(screen.search).toHaveCount(0);
});

/** A failed run whose failed job has a log, one passed job beside it, and a pass before the run. */
function createRerunnableRun() {
    const { world } = createSampleTrackedWork();
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Deploy', runs: [] });
    world.workflowRun(SAMPLE_REPOSITORY, 'Deploy', { conclusion: 'success', minutesAgo: 60 });
    const runId = world.workflowRun(SAMPLE_REPOSITORY, 'Deploy', { conclusion: 'failure', minutesAgo: 30 });
    const [buildId = 0] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD, LINT]);
    world.jobLog(SAMPLE_REPOSITORY, buildId, RUN_LOG);
    return { world, runId, buildId, path: `/${SAMPLE_REPOSITORY}/actions/runs/${runId}` };
}

const rerunCalls = (github: { restCalls: readonly { url: URL }[] }) =>
    github.restCalls.filter(call => call.url.pathname.endsWith('/rerun-failed-jobs')).length;

test('W4k: searching the log from ⌘K ends with the cursor in the field, the menu closing around it', async ({
    page,
    github,
}) => {
    const { world, runId, path } = createFailedRun();
    const [buildId] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD]);
    world.jobLog(SAMPLE_REPOSITORY, buildId ?? 0, RUN_LOG);
    await openTrackedWork(page, github, world);
    await page.goto(path);
    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.cursorLine).toContainText('Process completed');

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await page.keyboard.type('search log');
    await expect(menu.option(/Search/u).first()).toContainText('/');
    await page.keyboard.press('Enter');

    await expect(menu.root).toHaveCount(0);
    await expect(screen.searchField).toBeFocused();
    // The menu hands the focus back as it goes: what is typed next must still land here.
    await page.keyboard.type('<b>');
    await expect(screen.searchField).toHaveValue('<b>');
    await expect(screen.searchPosition).toHaveText('1 of 1');
});

test('W4k, W4j: first in ⌘K, no key, no question: the page goes running at once, follows the run, opens the log itself, and the workflow stays broken', async ({
    page,
    github,
}) => {
    await page.clock.install();
    const { world, runId, buildId, path } = createRerunnableRun();
    await openTrackedWork(page, github, world);
    await page.goto(path);
    const screen = new WorkflowRunScreenHarness(page);
    const shell = new AppShellHarness(page);
    await expect(screen.logLines.filter({ hasText: 'building' })).toBeVisible();

    const menu = new CommandMenuHarness(page);
    await menu.open();
    const first = menu.root.getByRole('option').first();
    await expect(first).toContainText('Re-run failed jobs');
    await expect(first).toContainText('1 job: build');
    await expect(first.locator('kbd')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).not.toContainText('Re-run failed jobs');
    await page.keyboard.press('Escape');
    expect(rerunCalls(github)).toBe(0);

    await menu.open();
    await page.keyboard.press('Enter');

    await expect(screen.summary).toContainText('Running');
    await expect(screen.summary).toContainText('attempt 2');
    await expect(screen.message('build is still running')).toBeVisible();
    await expect(shell.statusBar).toContainText('Status checked');
    await expect.poll(() => rerunCalls(github)).toBe(1);

    // Going, the command is gone.
    await menu.open();
    await expect(menu.option(/Re-run failed jobs/u)).toHaveCount(0);
    await page.keyboard.press('Escape');

    // The workflow stays broken, as read now by the Workflows section, though a pass stands before the run re-run.
    await page.goto(`/${SAMPLE_REPOSITORY}/actions`);
    const repository = new RepositoryScreenHarness(page);
    await expect(repository.workflow('Deploy')).toBeVisible();
    await expect(repository.root.locator('[data-kind="running"]')).toBeVisible();
    await expect(shell.brokenWorkflowsCount).toHaveText('1');
    await page.goto(path);
    await expect(screen.summary).toContainText('Running');

    world.finishRun(SAMPLE_REPOSITORY, runId, 'failure');
    world.finishJob(SAMPLE_REPOSITORY, runId, buildId, 'failure');
    world.jobLog(SAMPLE_REPOSITORY, buildId, '2026-11-02T11:46:02.0000000Z the second log');
    await page.clock.fastForward('00:31');

    await expect(screen.logTexts.filter({ hasText: 'the second log' })).toBeVisible();
    await expect(screen.summary).toContainText('Failed');
});

test('W4k: without permission to re-run the command is not there', async ({ page, github }) => {
    const { world, path } = createRerunnableRun();
    world.repository(SAMPLE_REPOSITORY, { viewerPermission: 'READ' });
    await openTrackedWork(page, github, world);
    await page.goto(path);
    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.logLines.filter({ hasText: 'building' })).toBeVisible();

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await expect(menu.option(/Open on GitHub/u).first()).toBeVisible();
    await expect(menu.option(/Re-run failed jobs/u)).toHaveCount(0);
});

test('W4l: “Must have admin rights to Repository.” is one toast in its own words, the segment red until dismissed, the run as it was', async ({
    page,
    github,
}) => {
    const { world, path } = createRerunnableRun();
    world.refuseRerun(SAMPLE_REPOSITORY, 403, 'Must have admin rights to Repository.');
    await openTrackedWork(page, github, world);
    await page.goto(path);
    const screen = new WorkflowRunScreenHarness(page);
    const shell = new AppShellHarness(page);
    await expect(screen.logLines.filter({ hasText: 'building' })).toBeVisible();

    await new CommandMenuHarness(page).run('Re-run failed');

    await expect(shell.toasts).toHaveCount(1);
    await expect(shell.toasts).toContainText(/wasn['’]t\sre-run:\sno\spermission/u);
    await expect(shell.toasts.getByRole('link', { name: /Open on GitHub/u })).toHaveCount(1);
    await expect(screen.summary).toContainText('Failed');
    await expect(screen.logLines.filter({ hasText: 'building' })).toBeVisible();
    await expect(shell.failedRerun).toHaveText(/Re-run\srefused\sby\sGitHub/u);

    await page.keyboard.press('Escape');
    await expect(shell.toasts).toHaveCount(0);
    await expect(shell.failedRerun).toHaveCount(0);
    await expect(page).toHaveURL(path);
});

test('W4l: a 5xx and no answer say so, as no refusal; a toast that timed out comes back from the status bar', async ({
    page,
    github,
}) => {
    await page.clock.install();
    const { world, path } = createRerunnableRun();
    world.refuseRerun(SAMPLE_REPOSITORY, 502, 'Bad gateway');
    await openTrackedWork(page, github, world);
    await page.goto(path);
    const screen = new WorkflowRunScreenHarness(page);
    const shell = new AppShellHarness(page);
    await expect(screen.logLines.filter({ hasText: 'building' })).toBeVisible();

    await new CommandMenuHarness(page).run('Re-run failed');
    await expect(shell.toasts).toContainText(/GitHub\sanswered\s502/u);
    await expect(shell.failedRerun).toHaveText(/GitHub answered 502/u);

    await page.clock.fastForward('00:13');
    await expect(shell.toasts).toHaveCount(0);
    await shell.failedRerun.click();
    await expect(shell.toasts).toContainText(/GitHub\sanswered\s502/u);
    await page.keyboard.press('Escape');
    await expect(shell.failedRerun).toHaveCount(0);

    await page.route('**/rerun-failed-jobs', route => route.abort('failed'));
    await new CommandMenuHarness(page).run('Re-run failed');
    await expect(shell.toasts).toContainText(/couldn['’]t\sreach\sGitHub/u);
    await expect(shell.failedRerun).toHaveText(/GitHub unreachable/u);
    await expect(screen.summary).toContainText('Failed');
});

test('W4l: an answer after leaving the page still shows, wherever the user went', async ({ page, github }) => {
    const { world, path } = createRerunnableRun();
    world.refuseRerun(SAMPLE_REPOSITORY, 403, 'This workflow is already running');
    await openTrackedWork(page, github, world);
    await page.goto(path);
    const screen = new WorkflowRunScreenHarness(page);
    const shell = new AppShellHarness(page);
    await expect(screen.logLines.filter({ hasText: 'building' })).toBeVisible();

    const held = Promise.withResolvers<void>();
    await page.route('**/rerun-failed-jobs', async route => {
        await held.promise;
        await route.fallback();
    });
    await new CommandMenuHarness(page).run('Re-run failed');
    await expect(screen.summary).toContainText('Running');

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    held.resolve();

    await expect(shell.toasts).toContainText(/already\srunning/u);
});
