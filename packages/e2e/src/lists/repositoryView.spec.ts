import { expect, test } from '../fixtures.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

test('a tracked repository is grouped by milestone, and as a board by issue type, a column per type', async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await shell.tracked(SAMPLE_REPOSITORY).click();
    const repository = new RepositoryScreenHarness(page);

    await expect(repository.groupingButton).toHaveText('Group: Milestone');
    await expect(repository.groups).toHaveText([/^\s*v1\.0\s*2/, /^\s*v2\.0\s*1/, /^\s*No\smilestone\s*1/]);
    await expect(repository.rows('v1.0')).toHaveText([/Crash on start/, /Fix the crash on start/]);
    await expect(repository.rows('v2.0')).toHaveText([/Add a dark theme/]);
    await expect(repository.rows('No milestone')).toHaveText([/Document the setup/]);

    await repository.layout('Board').click();
    await repository.groupingButton.click();
    await page.getByRole('menuitemradio', { name: 'Issue type' }).click();
    await expect(repository.groupingButton).toHaveText('Group: Issue type');
    await expect(repository.rows('Bug')).toHaveText([/Crash on start/]);
    await expect(repository.rows('Feature')).toHaveText([/Add a dark theme/]);
    await expect(repository.rows('No type')).toHaveText([/Document the setup/, /Fix the crash on start/]);
});

test('J3: an untracked repository holds what concerns the user; tracked from there, the rest of its items arrive in place', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    sample.world.issue({
        repository: 'hubot/tools',
        number: 31,
        title: 'Lint the release notes',
        author: 'hubot',
        foundBy: ['mentioned'],
        minutesAgo: 60,
    });
    sample.world.issue({ repository: 'hubot/tools', number: 32, title: 'Cache the build', minutesAgo: 90 });
    sample.world.pullRequest({
        repository: 'hubot/tools',
        number: 33,
        title: 'Bump the toolchain',
        author: 'hubot',
        minutesAgo: 120,
    });
    const shell = await openTrackedWork(page, github, sample.world);
    const repository = new RepositoryScreenHarness(page);

    await page.goto('/hubot/tools');
    await expect(repository.notTracked('hubot/tools')).toContainText('only has what concerns you here: 1 item');
    await expect(repository.rows('Concerns you')).toHaveText([/Lint the release notes/]);

    await repository.trackButton('hubot/tools').click();
    await expect(repository.groupingButton).toHaveText('Group: Milestone');
    await expect(repository.rows('No milestone')).toHaveText([
        /Lint the release notes/,
        /Cache the build/,
        /Bump the toolchain/,
    ]);
    await expect(shell.trackedCount('hubot/tools')).toHaveText('3');
});
