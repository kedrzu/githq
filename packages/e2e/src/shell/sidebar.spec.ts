import { expect, test } from '../fixtures.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { signIn } from '../session.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';
import { escapeRegExp } from '../utils/escapeRegExp.js';

const DOCS = `${SAMPLE_VIEWER.viewer.login}/docs`;
const SITE = `${SAMPLE_VIEWER.viewer.login}/site`;

test('the sidebar collapses to the rail with its button and with ⌘B, and stays so across reloads', async ({
    page,
    github,
}) => {
    const shell = await signIn(page, github);

    await shell.collapseButton.click();
    await expect(shell.expandButton).toBeVisible();
    await expect(shell.collapseButton).toBeHidden();
    // The rail keeps the account (the avatar alone) and the allowance in short.
    await expect(shell.account(SAMPLE_VIEWER.viewer.login)).toBeVisible();
    await expect(shell.statusBar).toContainText('4.8k');

    await page.reload();
    await expect(shell.expandButton).toBeVisible();

    await page.keyboard.press('ControlOrMeta+B');
    await expect(shell.collapseButton).toBeVisible();
    await expect(shell.expandButton).toBeHidden();

    await page.reload();
    await expect(shell.collapseButton).toBeVisible();

    await page.keyboard.press('ControlOrMeta+B');
    await expect(shell.expandButton).toBeVisible();
});

test('a tracked repository dragged to another place among the repositories stays there, across reloads; a second drag lands where dropped', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.repository(DOCS);
    world.repository(SITE);
    const shell = await openTrackedWork(page, github, world);
    const rows = shell.trackedRows('Repositories');
    await expect(rows).toHaveText([startsWith(SAMPLE_REPOSITORY), startsWith(DOCS), startsWith(SITE)]);

    await shell.dragTracked(SITE, SAMPLE_REPOSITORY);
    await expect(rows).toHaveText([startsWith(SITE), startsWith(SAMPLE_REPOSITORY), startsWith(DOCS)]);
    // Right after, in the same page: told against the order the first drag made.
    await shell.dragTracked(SAMPLE_REPOSITORY, DOCS);
    await expect(rows).toHaveText([startsWith(SITE), startsWith(DOCS), startsWith(SAMPLE_REPOSITORY)]);
    // A drag is not a click: it opens nothing.
    await expect(page).toHaveURL('/');

    await page.reload();
    await expect(rows).toHaveText([startsWith(SITE), startsWith(DOCS), startsWith(SAMPLE_REPOSITORY)]);
});

function startsWith(name: string) {
    return new RegExp(`^${escapeRegExp(name)}`, 'u');
}
