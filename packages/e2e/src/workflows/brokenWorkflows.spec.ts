import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { expect, test } from '../fixtures.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
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

test('a release failing on a tag lights nothing by default; with "v*" in the repository’s settings it is broken on the pattern, beside a pass on the default branch', async ({
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
    await new CommandMenuHarness(page).run('Broken workflows');
    const screen = new BrokenWorkflowsScreenHarness(page);
    await expect(screen.allGreen).toBeVisible();

    // The repository's settings entry takes the patterns (actions D14); no screen writes them yet.
    const key = `githq.settings.${SAMPLE_VIEWER.viewer.login}`;
    const kept = await page.evaluate(slot => localStorage.getItem(slot) ?? '', key);
    const withPatterns = JSON.stringify(
        JSON.parse(kept, (_, value: unknown) =>
            isPlainObject(value) && value.nameWithOwner === SAMPLE_REPOSITORY
                ? { ...value, workflows: { defaultBranch: true, refs: ['v*'] } }
                : value,
        ),
    );
    await page.evaluate(([slot, value]) => localStorage.setItem(slot, value), [key, withPatterns] as const);
    await page.reload();

    await expect(shell.brokenWorkflowsCount).toHaveText('1');
    await expect(screen.group('New')).toContainText('Release');
    await expect(screen.group('New')).toContainText('v*');
});
