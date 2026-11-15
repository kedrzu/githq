import { expect, test } from '../fixtures.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { WorkflowRunScreenHarness } from '../harnesses/WorkflowRunScreen.harness.js';
import { TrackedSettingsScreenHarness } from '../harnesses/TrackedSettingsScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

/** Probe of the sample repository, as the panel's address names it (`owner|name|probe.yml`, encoded). */
const PROBE_PANE = encodeURIComponent(`${SAMPLE_REPOSITORY.replace('/', '|')}|probe.yml`);

test("a repository's Workflows section lists every workflow — runs on any ref read as it opens —, counts the broken one, and F opens its latest failed run", async ({
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
    await expect(repository.section('Workflows')).toHaveAttribute('aria-pressed', 'true');
    await expect(repository.section('Workflows')).toHaveText(/^Workflows\s*1$/u);
    await expect(repository.alertsBar).toContainText(/Alerts on\s*main/u);
    await expect(repository.group('Broken')).toContainText('Deploy');
    await expect(repository.group('Pull requests only')).toContainText('CLA');
    await expect(repository.group('No alerts')).toContainText(/Release.*a\stag\swithout\salerts/u);
    await expect(repository.group('Passing')).toContainText('Probe');
    await expect(repository.group('Disabled')).toContainText('Backup');
    // Workflows never appear among the repository's items (actions D6).
    await repository.section('Issues').click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/issues`);
    await expect(repository.workflow('Deploy')).toHaveCount(0);

    await repository.section('Workflows').click();
    // The tab takes the keys as it opens, on its first row.
    await expect(repository.workflow('Deploy')).toHaveAttribute('aria-current', 'true');
    // In the panel beside the section, which fits.
    await page.keyboard.press('f');
    await expect(page).toHaveURL(
        `/${SAMPLE_REPOSITORY}/actions?pane=run&run=${encodeURIComponent(`${SAMPLE_REPOSITORY.replace('/', '|')}|2`)}`,
    );
    await expect(new WorkflowRunScreenHarness(page).root).toBeVisible();

    // Back to the tab alone, on the same row.
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    await expect(repository.workflow('Deploy')).toHaveAttribute('aria-current', 'true');
});

test('Enter opens a workflow in the panel with its runs — older ones than the sync keeps too — and details; Enter on it again goes full screen, Esc back; J opens the next in its place', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    // 24 runs, more than the 20 the sync keeps: the 4 oldest are read only as the workflow opens.
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Probe',
        runs: Array.from({ length: 24 }, (_, index) => ({ conclusion: 'success', minutesAgo: 600 - index * 20 })),
    });
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Lint', runs: [{ conclusion: 'success', minutesAgo: 25 }] });
    await openTrackedWork(page, github, world);
    await page.goto(`/${SAMPLE_REPOSITORY}/actions`);

    const repository = new RepositoryScreenHarness(page);
    await expect(repository.workflow('Probe')).toHaveAttribute('aria-current', 'true');
    await expect(repository.root.getByText(/Full screen/u)).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions?pane=workflow&workflow=${PROBE_PANE}`);
    const probe = page.getByRole('article', { name: 'Probe' });
    await expect(probe.getByRole('region', { name: 'Runs' })).toContainText(/Run 1#1(?!\d)/u);
    await expect(probe.getByRole('region', { name: 'Runs' })).toContainText(/Run 24#24(?!\d)/u);

    // Enter on the open row expands it, marked: Esc comes back to the panel.
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions/workflows/probe.yml`);
    await expect(page.getByRole('article', { name: 'Probe' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions?pane=workflow&workflow=${PROBE_PANE}`);
    await expect(repository.workflow('Probe')).toHaveAttribute('aria-current', 'true');

    // The selection moving opens the next workflow in its place.
    await page.keyboard.press('j');
    await expect(page.getByRole('article', { name: 'Lint' })).toBeVisible();
    await expect(repository.workflow('Lint')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    await expect(page.getByRole('article')).toHaveCount(0);
});

test('⇧Enter opens a workflow full screen straight, ⇧J steps to the next, and Esc there comes back to the list on the one stepped to; F on a workflow that never failed does nothing', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Probe', runs: [{ conclusion: 'success', minutesAgo: 20 }] });
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Lint', runs: [{ conclusion: 'success', minutesAgo: 25 }] });
    await openTrackedWork(page, github, world);
    await page.goto(`/${SAMPLE_REPOSITORY}/actions`);

    const repository = new RepositoryScreenHarness(page);
    await expect(repository.workflow('Probe')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('j');
    await page.keyboard.press('f');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);

    await page.keyboard.press('k');
    await expect(repository.workflow('Probe')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Shift+Enter');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions/workflows/probe.yml`);
    await expect(page.getByRole('article', { name: 'Probe' })).toBeVisible();
    await page.keyboard.press('Shift+J');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions/workflows/lint.yml`);
    await expect(page.getByRole('article', { name: 'Lint' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    await expect(repository.workflow('Lint')).toHaveAttribute('aria-current', 'true');
});

test('P opens the repository’s settings on Workflow alerts, and Esc there comes back to the same row', async ({
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
    await page.keyboard.press('p');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/settings#workflow-alerts`);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    await expect(repository.workflow('Lint')).toHaveAttribute('aria-current', 'true');
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
