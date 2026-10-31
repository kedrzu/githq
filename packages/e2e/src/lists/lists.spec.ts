import { expect, test } from '../fixtures.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';
import { answerEmptyRepositories, answerRepositoryLookup } from '../tracking/answerTracking.js';

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
    await expect(page).toHaveURL(/\?open=acme\/web\/\d+/);

    await page.goto('/');
    await expect(myWork.layout('Board')).toHaveAttribute('aria-pressed', 'true');
});

test('J3: an untracked repository shows what concerns the user and is tracked from there; its view then arrives in place', async ({
    page,
    github,
}) => {
    await openMyWork(page, github, createSampleMyWork().world);
    const repository = new RepositoryScreenHarness(page);

    await page.goto('/acme/web');
    await expect(repository.notTracked('acme/web')).toContainText('only has what concerns you here: 4 items');
    await expect(repository.group('Concerns you').getByRole('listitem')).toHaveCount(4);
    await expect(repository.groupingButton).toHaveCount(0);

    answerRepositoryLookup(github, { nameWithOwner: 'acme/web' });
    answerEmptyRepositories(github, ['acme/web']);
    await repository.trackButton('acme/web').click();

    await expect(repository.groupingButton).toHaveText('Group: Milestone');
    await expect(repository.row('Sign-in loops after the token expires')).toBeVisible();
    await expect(repository.row('Sign-in loops after the token expires')).toContainText('#');
});
