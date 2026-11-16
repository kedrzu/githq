import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

// A phone in portrait (mobile D5: the phone layout below 640 px of window width).
const PHONE = { width: 390, height: 844 };

test('mobile D5, D19, D20: on a phone the places panel leads to a repository, an item fills the screen and back returns to the row', async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);

    // Narrowing the window takes the phone layout where the user is, without navigating.
    const before = page.url();
    await page.setViewportSize(PHONE);
    await expect(page.getByRole('button', { name: 'Open places' })).toBeVisible();
    expect(page.url()).toBe(before);

    // The places panel, from the top-left corner: a repository shows its sections, and choosing Issues closes it and
    // opens them.
    await page.getByRole('button', { name: 'Open places' }).click();
    const places = page.getByRole('dialog', { name: 'Places' });
    await places.getByRole('button', { name: new RegExp(`^${SAMPLE_REPOSITORY}`, 'u') }).click();
    await places.getByRole('link', { name: /^Issues/u }).click();
    await expect(places).toHaveCount(0);
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/issues`);
    // The command line names the part of the place shown.
    await expect(page.getByRole('button', { name: /Issues.*Do or find…/u })).toBeVisible();

    // An item opens on its page, the whole screen; back names the list and returns to it by the history.
    const repository = new RepositoryScreenHarness(page);
    await repository.row('Add a dark theme').click();
    const item = new ItemViewHarness(page);
    await expect(item.title).toHaveText('Add a dark theme');
    await expect(page).toHaveURL(new RegExp(`/${SAMPLE_REPOSITORY}/issues/\\d+$`, 'u'));
    await page.getByRole('button', { name: 'Back to Issues' }).click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/issues`);
    await expect(repository.row('Add a dark theme')).toBeVisible();
});

test('mobile D3, D5: on a phone a repository’s commits are github.com’s, decided when navigated to', async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.setViewportSize(PHONE);

    const commits = answerGitHubPage(github, `/${SAMPLE_REPOSITORY}/commits`);
    await page.goto(`/${SAMPLE_REPOSITORY}/commits`);
    expect((await commits).href).toBe(`https://github.com/${SAMPLE_REPOSITORY}/commits`);
    await expect(page).toHaveURL(`https://github.com/${SAMPLE_REPOSITORY}/commits`);
});

/** Answers github.com's page at `address` with its path, resolving with the address GitHub was asked for. */
function answerGitHubPage(github: GitHubMock, address: string) {
    const { pathname } = new URL(address, 'https://github.com');
    return new Promise<URL>(resolve => {
        github.web(pathname, url => {
            resolve(url);
            return { status: 200, headers: { 'content-type': 'text/html' }, body: `github.com${pathname}` };
        });
    });
}
