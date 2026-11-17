import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import type { GitHubWorld } from '../github/GitHubWorld.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { WorkflowItemHarness } from '../harnesses/WorkflowItem.harness.js';
import { WorkflowRunScreenHarness } from '../harnesses/WorkflowRunScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

// A workflow's run in the panel beside a repository's Workflows section (`OpenedWorkflowRun.vue`): opened from the
// workflow in the panel, Esc goes back to it, "Open full screen" moves it to its page and back, and the list's keys
// leave it the log's.

const LIST = `/${SAMPLE_REPOSITORY}/actions`;
const OWNER_AND_NAME = SAMPLE_REPOSITORY.replace('/', '|');
const DEPLOY_PAGE = `${LIST}/workflows/deploy.yml`;
const DEPLOY_PANEL = `${LIST}?pane=workflow&workflow=${encodeURIComponent(`${OWNER_AND_NAME}|deploy.yml`)}`;

test('a run clicked in the workflow in the panel opens in the panel beside the list; J moves its log, not the list; Esc goes back to the workflow, that run selected, again closes it', async ({
    page,
    github,
}) => {
    const { world, failedId } = createDeployRuns();
    await openTrackedWork(page, github, world);
    await page.goto(LIST);

    const repository = new RepositoryScreenHarness(page);
    const deploy = new WorkflowItemHarness(page, 'Deploy');
    await expect(repository.workflow('Deploy')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(DEPLOY_PANEL);
    // In the panel no run is under the cursor yet: the list keeps the keys.
    await expect(deploy.run(failedId)).not.toHaveAttribute('aria-current', 'true');

    await deploy.run(failedId).click();
    await expect(page).toHaveURL(getRunPanePath(`${failedId}`));
    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.heading(`Deploy #${failedId}`)).toBeVisible();
    await expect(repository.workflow('Probe')).toBeVisible();

    // The log's keys, not the list's: its cursor moves, the run's workflow stays the list's row.
    await expect(screen.cursorLine).toContainText('Process completed with exit code 1.');
    await page.keyboard.press('j');
    await expect(screen.cursorLine).toContainText('after it');
    await expect(repository.workflow('Deploy')).toHaveAttribute('aria-current', 'true');
    await expect(repository.workflow('Probe')).not.toHaveAttribute('aria-current', 'true');
    await expect(page).toHaveURL(getRunPanePath(`${failedId}`));

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(DEPLOY_PANEL);
    await expect(screen.heading(`Deploy #${failedId}`)).toHaveCount(0);
    // The run stays the workflow's selected one, drawn so where the workflow holds the keys: full screen.
    await page.keyboard.press('Shift+Enter');
    await expect(page).toHaveURL(DEPLOY_PAGE);
    await expect(deploy.run(failedId)).toHaveAttribute('aria-current', 'true');
    await expect(deploy.run(failedId + 1)).not.toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(DEPLOY_PANEL);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(LIST);
    await expect(deploy.root).toHaveCount(0);
});

test('⇧Enter moves the run from the panel to its page; a job selected there, Esc comes back to the run in the panel', async ({
    page,
    github,
}) => {
    const { world, failedId, lintId } = createDeployRuns();
    await openRunInPanel(page, github, world, failedId);
    const screen = new WorkflowRunScreenHarness(page);

    await page.keyboard.press('Shift+Enter');
    const path = `/${SAMPLE_REPOSITORY}/actions/runs/${failedId}`;
    await expect(page).toHaveURL(path);
    await expect(screen.heading(`Deploy #${failedId}`)).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Opened item' })).toHaveCount(0);

    await screen.job('lint').click();
    await expect(page).toHaveURL(`${path}/job/${lintId}`);
    await expect(screen.logTexts).toHaveText(['all fine']);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(getRunPanePath(`${failedId}`));
    await expect(screen.heading(`Deploy #${failedId}`)).toBeVisible();
    await expect(new RepositoryScreenHarness(page).workflow('Deploy')).toBeVisible();
});

test('"Back to the panel" on the run\'s page expanded from the panel comes back to the run in the panel; ⇧Enter there does not', async ({
    page,
    github,
}) => {
    const { world, failedId } = createDeployRuns();
    await openRunInPanel(page, github, world, failedId);
    const screen = new WorkflowRunScreenHarness(page);

    await screen.openFullScreen.click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions/runs/${failedId}`);
    await expect(screen.backToPanel).toBeVisible();
    await page.keyboard.press('Shift+Enter');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions/runs/${failedId}`);

    await screen.backToPanel.click();
    await expect(page).toHaveURL(getRunPanePath(`${failedId}`));
    await expect(screen.heading(`Deploy #${failedId}`)).toBeVisible();
    await expect(new RepositoryScreenHarness(page).workflow('Deploy')).toBeVisible();
});

test('the panel’s address with a run and its job, loaded afresh, shows that job of the run; Esc goes up to its workflow in the panel', async ({
    page,
    github,
}) => {
    const { world, failedId, lintId } = createDeployRuns();
    await openTrackedWork(page, github, world);
    await page.goto(getRunPanePath(`${failedId}|${lintId}`));

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.heading(`Deploy #${failedId}`)).toBeVisible();
    await expect(screen.job('lint')).toHaveAttribute('aria-current', 'true');
    await expect(screen.logTexts).toHaveText(['all fine']);
    // The run's workflow known, it is where Esc goes up to.
    await expect(new RepositoryScreenHarness(page).workflow('Deploy')).toHaveAttribute('aria-current', 'true');

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(DEPLOY_PANEL);
    await expect(new WorkflowItemHarness(page, 'Deploy').runRows).toHaveCount(2);
});

/**
 * A world with Deploy's two runs — a failed one with jobs lint and build, build's log failing at its second step, and a
 * newer one passed — and Probe beside it, ran longer ago; returns the failed run's and its jobs' ids.
 */
function createDeployRuns() {
    const { world } = createSampleTrackedWork();
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Deploy', runs: [] });
    const failedId = world.workflowRun(SAMPLE_REPOSITORY, 'Deploy', { conclusion: 'failure', minutesAgo: 40 });
    world.workflowRun(SAMPLE_REPOSITORY, 'Deploy', { conclusion: 'success', minutesAgo: 20 });
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Probe', runs: [{ conclusion: 'success', minutesAgo: 90 }] });
    const [lintId = 0, buildId = 0] = world.runJobs(SAMPLE_REPOSITORY, failedId, [
        { name: 'lint', conclusion: 'success', steps: [{ name: 'Run lint', conclusion: 'success' }] },
        {
            name: 'build',
            conclusion: 'failure',
            steps: [
                { name: 'Set up job', conclusion: 'success' },
                { name: 'Run bun run build', conclusion: 'failure' },
            ],
        },
    ]);
    world.jobLogBySteps(SAMPLE_REPOSITORY, failedId, buildId, {
        2: ['building', '##[error]Process completed with exit code 1.', 'after it'],
    });
    world.jobLog(SAMPLE_REPOSITORY, lintId, '2026-11-02T11:46:01.0000000Z all fine');
    return { world, failedId, lintId };
}

/** Opens Deploy in the panel from the Workflows section, then its run `runId` in its place. */
async function openRunInPanel(page: Page, github: GitHubMock, world: GitHubWorld, runId: number) {
    await openTrackedWork(page, github, world);
    await page.goto(LIST);
    await expect(new RepositoryScreenHarness(page).workflow('Deploy')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(DEPLOY_PANEL);
    await new WorkflowItemHarness(page, 'Deploy').run(runId).click();
    await expect(page).toHaveURL(getRunPanePath(`${runId}`));
    await expect(new WorkflowRunScreenHarness(page).heading(`Deploy #${runId}`)).toBeVisible();
}

/** The repository's Workflows section with its run — `run` the pane's run part, `<id>[|<job>]` — in the panel. */
function getRunPanePath(run: string) {
    return `${LIST}?pane=run&run=${encodeURIComponent(`${OWNER_AND_NAME}|${run}`)}`;
}
