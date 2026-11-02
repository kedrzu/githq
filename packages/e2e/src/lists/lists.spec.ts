import { expect, test } from '../fixtures.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';
import { TrackingScreenHarness } from '../harnesses/TrackingScreen.harness.js';
import { answerRepositoryLookup, answerTrackingCandidates } from '../tracking/answerTracking.js';

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

test('J3: an untracked repository shows what concerns the user; Settings opens with its name searched', async ({
    page,
    github,
}) => {
    await openMyWork(page, github, createSampleMyWork().world);
    const repository = new RepositoryScreenHarness(page);

    await page.goto('/acme/web');
    await expect(repository.notTracked('acme/web')).toContainText(
        'githq only has what concerns you in acme/web: 2 issues and 2 pull requests.',
    );
    await expect(repository.group('Concerns you').getByRole('listitem')).toHaveCount(4);
    await expect(repository.groupingButton).toHaveCount(0);

    answerTrackingCandidates(github, { login: SAMPLE_VIEWER.viewer.login });
    answerRepositoryLookup(github, { nameWithOwner: 'acme/web' });
    await repository.notTracked('acme/web').getByRole('link', { name: 'Settings' }).click();

    await expect(page).toHaveURL('/settings?q=acme%2Fweb');
    await expect(new TrackingScreenHarness(page).search).toHaveValue('acme/web');
});

test('J4: an untracked project shows what concerns the user; Settings opens on Projects with its title searched', async ({
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

    await expect(page).toHaveURL(/\/settings\?tab=projects&q=Mobile(\+|%20)launch$/);
    await expect(new TrackingScreenHarness(page).search).toHaveValue('Mobile launch');
});
