import { expect, test } from '../fixtures.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import {
    createSampleTrackedWork,
    SAMPLE_PROJECT,
    SAMPLE_PROJECT_PATH,
    SAMPLE_REPOSITORY,
} from '../tracking/sampleTrackedWork.js';

/** A second tracked repository of the viewer's, with nothing in it. */
const DOCS = `${SAMPLE_VIEWER.viewer.login}/docs`;

// A phone in portrait (mobile D5: the phone layout below 640 px of window width).
const PHONE = { width: 390, height: 844 };

test("the open repository's sections are under its row with their counts, the shown one current — also with an item open — and opening another moves them", async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.repository(DOCS);
    const shell = await openTrackedWork(page, github, world);
    await expect(shell.placeRows(SAMPLE_REPOSITORY)).toHaveCount(0);

    await shell.tracked(SAMPLE_REPOSITORY).click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/issues`);
    await expect(shell.placeRows(SAMPLE_REPOSITORY)).toHaveText([
        /^Issues\s*3$/u,
        /^Pull requests\s*1$/u,
        /^Commits$/u,
        /^Workflows/u,
    ]);
    await expect(shell.placeRow(SAMPLE_REPOSITORY, 'Issues')).toHaveAttribute('aria-current', 'page');
    await expect(shell.tracked(SAMPLE_REPOSITORY)).not.toHaveAttribute('aria-current');
    await expect(shell.placeRows(DOCS)).toHaveCount(0);

    await shell.placeRow(SAMPLE_REPOSITORY, 'Pull requests').click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/pulls`);
    await new RepositoryScreenHarness(page).row('Fix the crash on start').click();
    await expect(page).toHaveURL(/[?&]pane=issue/u);
    await expect(shell.placeRow(SAMPLE_REPOSITORY, 'Pull requests')).toHaveAttribute('aria-current', 'page');
    await expect(shell.sidebar.locator('[aria-current="page"]')).toHaveCount(1);

    await shell.tracked(DOCS).click();
    await expect(page).toHaveURL(`/${DOCS}/issues`);
    await expect(shell.placeRows(SAMPLE_REPOSITORY)).toHaveCount(0);
    await expect(shell.placeRows(DOCS)).toHaveText([
        /^Issues\s*0$/u,
        /^Pull requests\s*0$/u,
        /^Commits$/u,
        /^Workflows/u,
    ]);
    await expect(shell.placeRow(DOCS, 'Issues')).toHaveAttribute('aria-current', 'page');
});

test("the open project's saved views are under its row, the shown one current, and its row goes back to that view", async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);

    await shell.tracked(SAMPLE_PROJECT).click();
    await expect(shell.placeRows(SAMPLE_PROJECT)).toHaveText([
        /^Backlog/u,
        /^Board/u,
        /^Sidebar work/u,
        /^Shipped bugs/u,
    ]);

    await shell.placeRow(SAMPLE_PROJECT, 'Board').click();
    await expect(page).toHaveURL(`${SAMPLE_PROJECT_PATH}/views/2`);
    await expect(shell.placeRow(SAMPLE_PROJECT, 'Board')).toHaveAttribute('aria-current', 'page');
    await expect(shell.sidebar.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(shell.tracked(SAMPLE_PROJECT)).toHaveAttribute('href', `${SAMPLE_PROJECT_PATH}/views/2`);
});

test('on a phone, tapping a repository in the places panel shows its sections with the panel open; Pull requests opens that list and closes it', async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.setViewportSize(PHONE);

    await page.getByRole('button', { name: 'Open places' }).click();
    const places = page.getByRole('dialog', { name: 'Places' });
    await shell.tracked(SAMPLE_REPOSITORY).click();

    await expect(places).toBeVisible();
    await expect(page).toHaveURL('/');
    await expect(shell.tracked(SAMPLE_REPOSITORY)).toHaveAttribute('aria-expanded', 'true');
    // Commits and Workflows are github.com's on a phone (mobile D21).
    await expect(shell.placeRow(SAMPLE_REPOSITORY, 'Commits')).toHaveAttribute(
        'href',
        `https://github.com/${SAMPLE_REPOSITORY}/commits`,
    );
    await expect(shell.placeRow(SAMPLE_REPOSITORY, 'Workflows')).toHaveAttribute(
        'href',
        `https://github.com/${SAMPLE_REPOSITORY}/actions`,
    );

    await shell.placeRow(SAMPLE_REPOSITORY, 'Pull requests').click();
    await expect(places).toHaveCount(0);
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/pulls`);
});
