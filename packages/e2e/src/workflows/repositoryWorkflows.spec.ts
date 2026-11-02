import { expect, test } from '../fixtures.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
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
    const failedRun = `/${SAMPLE_REPOSITORY}/actions/runs/2`;
    github.web(failedRun, () => ({ status: 200, body: '<title>Run</title>' }));
    const popup = page.waitForEvent('popup');
    await page.keyboard.press('Enter');
    expect((await popup).url()).toBe(`https://github.com${failedRun}`);
});

test('P opens the repository’s settings on Workflow alerts, and Esc there comes back to the tab', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Probe', runs: [{ conclusion: 'success', minutesAgo: 20 }] });
    await openTrackedWork(page, github, world);
    await page.goto(`/${SAMPLE_REPOSITORY}/actions`);

    const repository = new RepositoryScreenHarness(page);
    await expect(repository.group('Passing')).toContainText('Probe');
    await page.keyboard.press('p');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/settings#workflow-alerts`);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    await expect(repository.group('Passing')).toContainText('Probe');
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
