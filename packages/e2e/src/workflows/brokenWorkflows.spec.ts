import { expect, test } from '../fixtures.js';
import { SAMPLE_TOKEN, SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { BrokenWorkflowsScreenHarness } from '../harnesses/BrokenWorkflowsScreen.harness.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { FirstSignInHarness } from '../harnesses/FirstSignIn.harness.js';
import { LandingHarness } from '../harnesses/Landing.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { TrackedSettingsScreenHarness } from '../harnesses/TrackedSettingsScreen.harness.js';
import { WorkflowRunScreenHarness } from '../harnesses/WorkflowRunScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

test('a workflow failing on the default branch: the sidebar counts it and marks the repository; its screen lists it under New, Enter opens the failed run in githq and Esc comes back to its row', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Deploy',
        runs: [
            { conclusion: 'success', minutesAgo: 600 },
            { conclusion: 'failure', minutesAgo: 30 },
        ],
    });
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Probe', runs: [{ conclusion: 'success', minutesAgo: 20 }] });
    const shell = await openTrackedWork(page, github, world);

    await expect(shell.brokenWorkflowsCount).toHaveText('1');
    await expect(shell.workflowMarker(SAMPLE_REPOSITORY)).toHaveAttribute('data-marker', 'new');

    await shell.brokenWorkflows.click();
    await expect(page).toHaveURL('/dashboard/workflows');
    const screen = new BrokenWorkflowsScreenHarness(page);
    await expect(screen.heading).toBeVisible();
    await expect(screen.group('New')).toContainText('Deploy');
    await expect(screen.group('New')).toContainText(SAMPLE_REPOSITORY);
    await expect(screen.workflow('Probe')).toHaveCount(0);

    // The world numbers runs as it records them: Deploy's failure is the second.
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions/runs/2`);
    await expect(new WorkflowRunScreenHarness(page).heading('Deploy #2')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/dashboard/workflows');
    await expect(screen.workflow('Deploy')).toHaveAttribute('aria-current', 'true');
});

test('first run and loading D6, ES23: GitHub failing before any repository is read says so instead of ghosts, and R reads them', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Probe', runs: [{ conclusion: 'success', minutesAgo: 20 }] });
    world.install(github);
    github.graphql('Viewer', SAMPLE_VIEWER);
    const workflows = `/repos/${SAMPLE_REPOSITORY}/actions/workflows`;
    github.rest('GET', workflows, () => ({ status: 502, json: { message: 'Bad gateway' } }));
    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);
    await new FirstSignInHarness(page).trackAndOpenMyWork();

    // Its sidebar's entry is drawn only with something known broken (actions W1).
    await page.goto('/dashboard/workflows');
    const screen = new BrokenWorkflowsScreenHarness(page);
    const failing = screen.root.getByRole('heading', { name: "GitHub isn't answering" });
    await expect(failing).toBeVisible();
    await expect(screen.root).toContainText(/so\sit\scan't\stell\swhat\sis\sbroken/u);

    world.install(github);
    await page.keyboard.press('r');
    await expect(screen.allGreen).toBeVisible();
    await expect(failing).toHaveCount(0);
});

test('back from a run, the row moved to is still the selected one', async ({ page, github }) => {
    const { world } = createSampleTrackedWork();
    for (const [name, minutesAgo] of [
        ['Deploy', 30],
        ['Release', 20],
    ] as const) {
        world.workflow({ repository: SAMPLE_REPOSITORY, name, runs: [{ conclusion: 'failure', minutesAgo }] });
    }

    const shell = await openTrackedWork(page, github, world);
    await shell.brokenWorkflows.click();
    const screen = new BrokenWorkflowsScreenHarness(page);
    await expect(screen.workflow('Release')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('j');
    await expect(screen.workflow('Deploy')).toHaveAttribute('aria-current', 'true');

    await page.keyboard.press('Enter');
    await expect(new WorkflowRunScreenHarness(page).heading('Deploy #1')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(screen.workflow('Deploy')).toHaveAttribute('aria-current', 'true');
});

test('with nothing broken the sidebar has no entry; ⌘K "Broken workflows" opens the screen, all green', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Deploy',
        runs: [{ conclusion: 'success', minutesAgo: 30 }],
    });
    const shell = await openTrackedWork(page, github, world);
    // Read once the first download finishes: no marker, nothing to count.
    await expect(shell.workflowMarker(SAMPLE_REPOSITORY)).toHaveCount(0);
    await expect(shell.brokenWorkflows).toHaveCount(0);

    await new CommandMenuHarness(page).run('Broken workflows');

    await expect(page).toHaveURL('/dashboard/workflows');
    const screen = new BrokenWorkflowsScreenHarness(page);
    await expect(screen.allGreen).toBeVisible();
    await expect(screen.root).toContainText('1/1 repositories · 0 broken');
    // On its own screen the entry shows, with nothing broken.
    await expect(shell.brokenWorkflowsCount).toHaveText('0');
});

test('a release failing on a tag lights nothing by default; P from its row and "v*" in the repository’s settings make it broken, beside a pass on the default branch; with the default branch off and no patterns nothing alerts', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.tag(SAMPLE_REPOSITORY, 'v1.0-rc.1');
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Release',
        runs: [
            { conclusion: 'success', minutesAgo: 600 },
            { conclusion: 'failure', minutesAgo: 30, branch: 'v1.0-rc.1' },
        ],
    });
    const shell = await openTrackedWork(page, github, world);
    await page.goto(`/${SAMPLE_REPOSITORY}/actions`);
    const repository = new RepositoryScreenHarness(page);
    await expect(repository.group('No alerts')).toContainText(/Release.*a\stag\swithout\salerts/u);
    await expect(shell.brokenWorkflows).toHaveCount(0);

    // P on a row without alerts lands on the add field: "v*" is two keys away (W13, W11).
    await expect(repository.workflow('Release')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('p');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/settings#workflow-alerts-add`);
    const settings = new TrackedSettingsScreenHarness(page);
    await expect(settings.addPatternField).toBeFocused();

    // Nothing typed, Esc goes back to the row at once; P lands on the field again.
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    await expect(repository.workflow('Release')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('p');
    await expect(settings.addPatternField).toBeFocused();

    await page.keyboard.type('v*');
    await expect(settings.workflowAlerts).toContainText('Release turns broken: it failed on v1.0-rc.1');
    await page.keyboard.press('Enter');
    await expect(settings.pattern('v*')).toContainText(/v1\.0-rc\.1.*1\stag.*1\sbroken/u);

    // The sidebar follows at once, and Esc goes back to the tab.
    await expect(shell.brokenWorkflowsCount).toHaveText('1');
    await expect(shell.workflowMarker(SAMPLE_REPOSITORY)).toHaveAttribute('data-marker', 'new');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions`);
    await expect(repository.group('Broken')).toContainText(/Release.*v\*/u);

    // Kept with the settings: the Broken workflows screen says the same after a reload.
    await page.goto('/dashboard/workflows');
    const screen = new BrokenWorkflowsScreenHarness(page);
    await expect(screen.group('New')).toContainText('Release');
    await expect(screen.group('New')).toContainText('v*');

    // ⌫ removes the pattern and Space switches the default branch off: no alerts at all (W9, W14).
    await page.goto(`/${SAMPLE_REPOSITORY}/settings#workflow-alerts`);
    await expect(settings.workflowAlerts).toBeFocused();
    await page.keyboard.press('j');
    await expect(settings.pattern('v*')).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Backspace');
    await expect(settings.pattern('v*')).toHaveCount(0);
    await page.keyboard.press('k');
    await page.keyboard.press('Space');
    await expect(settings.defaultBranchSwitch).toHaveAttribute('aria-checked', 'false');
    await expect(settings.workflowAlerts).toContainText(`No alerts from ${SAMPLE_REPOSITORY}`);

    await page.goto(`/${SAMPLE_REPOSITORY}/actions`);
    await expect(repository.alertsBar).toContainText('Nothing. Failures here never mark this repository broken.');
    await expect(repository.group('No alerts')).toContainText('Release');
    await expect(repository.section('Workflows')).toHaveText(/^Workflows$/u);
    await expect(shell.workflowMarker(SAMPLE_REPOSITORY)).toHaveCount(0);
    await expect(shell.brokenWorkflows).toHaveCount(0);
});
