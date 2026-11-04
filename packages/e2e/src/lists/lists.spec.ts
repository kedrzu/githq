import { expect, test } from '../fixtures.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { ProjectTrackingScreenHarness } from '../harnesses/ProjectTrackingScreen.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { SettingsScreenHarness } from '../harnesses/SettingsScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';
import { answerTrackingCandidates } from '../tracking/answerTracking.js';

test('my work as a board: a column per group, ←/→ between them, Enter opens; the layout stays after a reload', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);

    await myWork.layout('Board').click();
    await expect(myWork.layout('Board')).toHaveAttribute('aria-pressed', 'true');
    await expect(myWork.groups).toHaveCount(4);
    // The pull request closing an assigned issue is a card under the issue's.
    await expect(myWork.rows('Assigned to me')).toHaveText([
        /Sign-in loops after the token expires/,
        /Redirect once after sign-in/,
        /Document the keyboard shortcuts/,
    ]);

    // Away from the toggle, so the arrows are the board's.
    await myWork.group('Review requested').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('j');
    await expect(myWork.selectedRow).toContainText('Add rate limit headers to the API');
    await page.keyboard.press('ArrowRight');
    await expect(myWork.selectedRow).toContainText('Cache search results');
    await page.keyboard.press('ArrowDown');
    await expect(myWork.selectedRow).toContainText('Move the sidebar state to the store');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\?pane=issue&issue=acme%7Cweb%7C\d+$/);

    await page.goto('/');
    await expect(myWork.layout('Board')).toHaveAttribute('aria-pressed', 'true');
});

test('D32: an untracked repository holding what concerns the user lists each of its items once, with its toolbar', async ({
    page,
    github,
}) => {
    await openMyWork(page, github, createSampleMyWork().world);
    const repository = new RepositoryScreenHarness(page);

    await page.goto('/acme/web');
    await expect(repository.notTrackedChip).toBeVisible();
    await expect(repository.readCount).toHaveText('2 of 2');
    await expect(repository.root.getByRole('listitem')).toHaveCount(2);
    await expect(repository.groupingButton).toHaveText('Group: Milestone');
});

test('J4: an untracked project shows what concerns the user; Settings opens on Projects with its address, and offers it', async ({
    page,
    github,
}) => {
    const { world } = createSampleMyWork();
    const project = world.project({ title: 'Mobile launch', number: 7 });
    world.issue({
        repository: 'acme/web',
        number: 70,
        title: 'Fix tap targets on the booking screen',
        foundBy: ['mentioned'],
        minutesAgo: 30,
        projects: [{ project, status: 'Todo' }],
    });
    await openMyWork(page, github, world);

    await page.goto(`/users/${SAMPLE_VIEWER.viewer.login}/projects/7`);
    const lines = page.getByRole('region', { name: "You're not tracking Mobile launch" });
    await expect(lines).toContainText('githq only has what concerns you in Mobile launch: 1 item.');
    await expect(page.getByRole('main').getByRole('listitem').filter({ hasText: 'Fix tap targets' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Track/ })).toHaveCount(0);

    answerTrackingCandidates(github, { login: SAMPLE_VIEWER.viewer.login });
    await lines.getByRole('link', { name: 'Settings' }).click();

    const address = `https://github.com/users/${SAMPLE_VIEWER.viewer.login}/projects/7`;
    await expect(page).toHaveURL(`/settings?tab=projects&q=${encodeURIComponent(address)}`);
    const tracking = new ProjectTrackingScreenHarness(page);
    await expect(tracking.search).toHaveValue(address);
    await expect(tracking.row('Mobile launch')).not.toBeChecked();

    // Esc clears the filter, then closes the picker over the Projects section.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(tracking.dialog).toHaveCount(0);
    await expect(new SettingsScreenHarness(page).section('Projects')).toHaveAttribute('aria-pressed', 'true');
});
