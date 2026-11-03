import { expect, test } from '../fixtures.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { WorkflowRunScreenHarness } from '../harnesses/WorkflowRunScreen.harness.js';
import { TrackedSettingsScreenHarness } from '../harnesses/TrackedSettingsScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

test("a repository's Workflows tab lists every workflow — runs on any ref read as it opens —, counts the broken one, and Enter opens its failed run", async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.tag(SAMPLE_REPOSITORY, 'v1.0-rc.1');
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Deploy',
        runs: [
            { conclusion: 'success', minutesAgo: 600 },
            { conclusion: 'failure', minutesAgo: 30 },
        ],
    });
    // Only pull requests run it, and only a tag runs Release: the default branch's reads see neither.
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'CLA',
        runs: [{ conclusion: 'failure', minutesAgo: 40, branch: 'feature', event: 'pull_request_target' }],
    });
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Release',
        runs: [{ conclusion: 'failure', minutesAgo: 50, branch: 'v1.0-rc.1' }],
    });
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Probe', runs: [{ conclusion: 'success', minutesAgo: 20 }] });
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Backup',
        state: 'disabled_manually',
        runs: [{ conclusion: 'success', minutesAgo: 900 }],
    });
    const shell = await openTrackedWork(page, github, world);
    await expect(shell.workflowMarker(SAMPLE_REPOSITORY)).toHaveAttribute('data-marker', 'new');

    // The repository's menu leads there, after Pull requests.
    const menu = await shell.openTrackedMenu(SAMPLE_REPOSITORY);
    await expect(menu.getByRole('menuitem')).toContainText(['Open', 'Issues', 'Pull requests', 'Workflows']);
    await menu.getByRole('menuitem', { name: 'Workflows' }).click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);

    const repository = new RepositoryScreenHarness(page);
    await expect(repository.kind('Workflows')).toHaveAttribute('aria-pressed', 'true');
    await expect(repository.kind('Workflows')).toHaveText(/^Workflows\s*1$/u);
    await expect(repository.alertsBar).toContainText(/Alerts on\s*main/u);
    await expect(repository.group('Broken')).toContainText('Deploy');
    await expect(repository.group('Pull requests only')).toContainText('CLA');
    await expect(repository.group('No alerts')).toContainText(/Release.*a\stag\swithout\salerts/u);
    await expect(repository.group('Passing')).toContainText('Probe');
    await expect(repository.group('Disabled')).toContainText('Backup');
    // Workflows never appear among the repository's items (actions D6).
    await repository.kind('All').click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}`);
    await expect(repository.workflow('Deploy')).toHaveCount(0);

    await repository.kind('Workflows').click();
    // The tab takes the keys as it opens, on its first row.
    await expect(repository.workflow('Deploy')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions/runs/2`);
    await expect(new WorkflowRunScreenHarness(page).root).toBeVisible();

    // Back in the tab, on the same row.
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    await expect(repository.workflow('Deploy')).toHaveAttribute('aria-current', 'true');
});

test('Enter unfolds a workflow in place — the kept runs at once, older ones read on demand, a pull request’s among them —, F narrows them to a ref, Enter opens one, ← folds', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    // 24 runs, more than the 20 the sync keeps: the 4 oldest are read only as the workflow unfolds.
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Probe',
        runs: Array.from({ length: 22 }, (_, index) => ({ conclusion: 'success', minutesAgo: 600 - index * 20 })),
    });
    world.workflowRun(SAMPLE_REPOSITORY, 'Probe', {
        conclusion: 'failure',
        minutesAgo: 120,
        branch: 'feature',
        event: 'pull_request',
    });
    world.workflowRun(SAMPLE_REPOSITORY, 'Probe', { conclusion: 'success', minutesAgo: 5, branch: 'feature' });
    await openTrackedWork(page, github, world);
    await page.goto(`/${SAMPLE_REPOSITORY}/actions`);

    const repository = new RepositoryScreenHarness(page);
    await expect(repository.workflow('Probe')).toHaveAttribute('aria-current', 'true');
    await expect(repository.root.getByText(/Other runs/u)).toBeVisible();
    await page.keyboard.press('Enter');
    const runs = repository.runsOf('Probe');
    await expect(repository.workflow('Probe')).toHaveAttribute('aria-expanded', 'true');
    await expect(repository.runLines('Probe')).toHaveCount(24);
    await expect(repository.runLines('Probe').last()).toContainText(/^#1\s*main\s*push/u);
    await expect(runs).toContainText(/#23\s*feature\s*pull_request/u);
    await expect(repository.root.getByText(/Open run/u)).toBeVisible();

    await page.keyboard.press('f');
    await page.keyboard.type('feat');
    await page.keyboard.press('Enter');
    await expect(runs.getByRole('button', { name: 'feature', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(repository.runLines('Probe')).toHaveCount(2);

    const run = `/${SAMPLE_REPOSITORY}/actions/runs/24`;
    await page.keyboard.press('j');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(run);

    // Back from the run, unfolded and filtered as it was; Esc shows every ref again, then folds.
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    await expect(repository.runLines('Probe')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(repository.runLines('Probe')).toHaveCount(24);
    await page.keyboard.press('ArrowLeft');
    await expect(runs).toHaveCount(0);
    await expect(repository.workflow('Probe')).toHaveAttribute('aria-current', 'true');
    await expect(repository.workflow('Probe')).toHaveAttribute('aria-expanded', 'false');
});

test('P opens the repository’s settings on Workflow alerts, and Esc there comes back to the same row, unfolded as it was', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Probe', runs: [{ conclusion: 'success', minutesAgo: 20 }] });
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Lint', runs: [{ conclusion: 'success', minutesAgo: 25 }] });
    await openTrackedWork(page, github, world);
    await page.goto(`/${SAMPLE_REPOSITORY}/actions`);

    const repository = new RepositoryScreenHarness(page);
    await expect(repository.group('Passing')).toContainText('Probe');
    await expect(repository.workflow('Probe')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('j');
    await expect(repository.workflow('Lint')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(repository.workflow('Lint')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('p');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/settings#workflow-alerts`);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    await expect(repository.workflow('Lint')).toHaveAttribute('aria-current', 'true');
    await expect(repository.workflow('Lint')).toHaveAttribute('aria-expanded', 'true');
    await expect(repository.runsOf('Lint')).toBeVisible();
});

test('an address opened directly reads the runs on any ref too: a workflow only pull requests run is placed, not left unknown', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'CLA',
        runs: [{ conclusion: 'failure', minutesAgo: 40, branch: 'feature', event: 'pull_request_target' }],
    });
    await openTrackedWork(page, github, world);

    await page.goto(`/${SAMPLE_REPOSITORY}/actions`);
    const repository = new RepositoryScreenHarness(page);
    await expect(repository.group('Pull requests only')).toContainText('CLA');
});

test('a repository’s settings opened on their own read the runs on any ref: other refs show, and a pattern says what it would alert on', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.tag(SAMPLE_REPOSITORY, 'v1.0-rc.1');
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Release',
        runs: [{ conclusion: 'failure', minutesAgo: 50, branch: 'v1.0-rc.1' }],
    });
    await openTrackedWork(page, github, world);

    await page.goto(`/${SAMPLE_REPOSITORY}/settings#workflow-alerts-add`);
    const settings = new TrackedSettingsScreenHarness(page);
    await expect(settings.workflowAlerts).toContainText(/v1\.0-rc\.1.*Release failed/u);
    await expect(settings.addPatternField).toBeFocused();
    await page.keyboard.type('v*');
    await expect(settings.workflowAlerts).toContainText('Release turns broken: it failed on v1.0-rc.1');
});

test('a repository with no workflows says so, with no count on its tab', async ({ page, github }) => {
    const { world } = createSampleTrackedWork();
    const shell = await openTrackedWork(page, github, world);
    await shell.tracked(SAMPLE_REPOSITORY).click();

    const repository = new RepositoryScreenHarness(page);
    await repository.kind('Workflows').click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    await expect(page.getByRole('heading', { name: 'No workflows here, yet' })).toBeVisible();
    await expect(repository.kind('Workflows')).toHaveText(/^Workflows$/u);
});
