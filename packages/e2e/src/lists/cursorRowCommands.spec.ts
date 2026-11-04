import { expect, test } from '../fixtures.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';

const FIRST = 'Redirect once after sign-in';
const SECOND = 'Cache response headers';

/** The viewer's two pull requests in acme/web, #15 and #16, listed in that order. */
function createWork() {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    const pullRequest = (number: number, title: string, minutesAgo: number) =>
        world.pullRequest({ repository: 'acme/web', number, title, foundBy: ['authored'], minutesAgo });

    return { world, first: pullRequest(15, FIRST, 10), second: pullRequest(16, SECOND, 20) };
}

test('with no panel and nothing checked, the command menu names the highlighted row, and closing it closes that one', async ({
    page,
    github,
}) => {
    const work = createWork();
    const { myWork } = await openMyWork(page, github, work.world);
    await expect(myWork.root).toContainText(SECOND);
    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await expect(myWork.selectedRow).toContainText(SECOND);

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await expect(menu.chip('web#16')).toBeVisible();
    await menu.field.pressSequentially('Close pull');
    await page.keyboard.press('Enter');

    await expect.poll(() => work.world.stateOf(work.second).state).toBe('CLOSED');
    expect(work.world.stateOf(work.first).state).toBe('OPEN');
});
