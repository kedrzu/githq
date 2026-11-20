import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { expect, test } from '../fixtures.js';
import { TrackedListScreenHarness } from '../harnesses/TrackedListScreen.harness.js';
import { TrackedSettingsScreenHarness } from '../harnesses/TrackedSettingsScreen.harness.js';
import { TrackingScreenHarness } from '../harnesses/TrackingScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import {
    createSampleTrackedWork,
    SAMPLE_PROJECT,
    SAMPLE_PROJECT_PATH,
    SAMPLE_REPOSITORY,
} from '../tracking/sampleTrackedWork.js';
import { escapeRegExp } from '../utils/escapeRegExp.js';

const LOGIN = SAMPLE_VIEWER.viewer.login;
const DOCS = `${LOGIN}/docs`;

test("Repositories lists what is tracked, each row its owner before its name; ⌫ untracks the selected row and the toast's Undo brings it back", async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/settings');

    const list = new TrackedListScreenHarness(page);
    await expect(list.heading).toHaveText(/^1\stracked\srepository$/u);
    await expect(list.rows).toHaveText([startsWith(SAMPLE_REPOSITORY)]);
    const row = list.row(SAMPLE_REPOSITORY);
    await expect(row).toHaveText(/\d+\sopen/u);

    await page.keyboard.press('j');
    await expect(list.selectedRow).toHaveText(startsWith(SAMPLE_REPOSITORY));
    await page.keyboard.press('Backspace');

    await expect(row).toHaveCount(0);
    // ES24: the note in the head's place, its button the way on.
    await expect(list.nothingTracked).toHaveText('No repositories tracked yet');
    await expect(list.root.getByRole('button', { name: 'Track repositories' })).toBeVisible();
    const toast = shell.toasts.filter({ hasText: `Stopped tracking ${SAMPLE_REPOSITORY}` });
    await expect(toast).toBeVisible();

    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(row).toBeVisible();
    await expect(list.heading).toHaveText(/^1\stracked\srepository$/u);
});

test('A opens the picker, tracking a repository there adds its row after the others, and the row opens its settings', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    await openTrackedWork(page, github, world);
    // Created after the first sign-in chose what to track: not tracked.
    world.repository(DOCS);
    await page.goto('/settings');

    const list = new TrackedListScreenHarness(page);
    await expect(list.rows).toHaveText([startsWith(SAMPLE_REPOSITORY)]);
    await page.keyboard.press('a');

    const picker = new TrackingScreenHarness(page);
    await expect(picker.dialog).toBeVisible();
    await picker.track(DOCS);

    await expect(list.rows).toHaveText([startsWith(SAMPLE_REPOSITORY), startsWith(DOCS)]);
    await expect(list.heading).toHaveText(/^2\stracked\srepositories$/u);

    await list.row(DOCS).click();
    await expect(page).toHaveURL(`/${DOCS}/settings`);
    await expect(new TrackedSettingsScreenHarness(page).heading(DOCS)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/settings');
});

test('⌥↓ and ⌥↑ move the selected repository a place, in Settings and in the sidebar alike', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.repository(DOCS);
    const shell = await openTrackedWork(page, github, world);
    await page.goto('/settings');

    const list = new TrackedListScreenHarness(page);
    const sidebar = shell.trackedRows('Repositories');
    await expect(list.rows).toHaveText([startsWith(SAMPLE_REPOSITORY), startsWith(DOCS)]);

    await page.keyboard.press('j');
    await page.keyboard.press('Alt+ArrowDown');
    await expect(list.rows).toHaveText([startsWith(DOCS), startsWith(SAMPLE_REPOSITORY)]);
    await expect(sidebar).toHaveText([startsWith(DOCS), startsWith(SAMPLE_REPOSITORY)]);
    // The selection goes along; at the end, nothing moves.
    await expect(list.selectedRow).toHaveText(startsWith(SAMPLE_REPOSITORY));
    await page.keyboard.press('Alt+ArrowDown');
    await expect(list.rows).toHaveText([startsWith(DOCS), startsWith(SAMPLE_REPOSITORY)]);

    await page.keyboard.press('Alt+ArrowUp');
    await expect(list.rows).toHaveText([startsWith(SAMPLE_REPOSITORY), startsWith(DOCS)]);
    await expect(sidebar).toHaveText([startsWith(SAMPLE_REPOSITORY), startsWith(DOCS)]);
});

test("Projects says where a project's items come from and how many it holds; Enter opens its settings", async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.goto('/settings?tab=projects');

    const list = new TrackedListScreenHarness(page);
    await expect(list.heading).toHaveText(/^1\stracked\sproject$/u);
    // Its own repository's issue, three of the untracked acme/web's and a draft; the archived one left out.
    await expect(list.rows).toHaveText([
        new RegExp(
            `^${escapeRegExp(`${LOGIN} / ${SAMPLE_PROJECT}`)}\\s*#1\\s*from\\s2\\srepositories,\\s1\\stracked\\s*5\\sitems`,
            'u',
        ),
    ]);

    await page.keyboard.press('j');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${SAMPLE_PROJECT_PATH}/settings`);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/settings?tab=projects');
});

function startsWith(name: string) {
    return new RegExp(`^${escapeRegExp(name)}`, 'u');
}
