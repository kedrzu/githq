import { expect, test } from '../fixtures.js';
import { BrokenWorkflowsScreenHarness } from '../harnesses/BrokenWorkflowsScreen.harness.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

test('a workflow failing on the default branch: the sidebar counts it and marks the repository; its screen lists it under New, Enter opens the failed run on GitHub', async ({
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
    const failedRun = `/${SAMPLE_REPOSITORY}/actions/runs/2`;
    github.web(failedRun, () => ({ status: 200, body: '<title>Run</title>' }));
    const popup = page.waitForEvent('popup');
    await page.keyboard.press('Enter');
    expect((await popup).url()).toBe(`https://github.com${failedRun}`);
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
