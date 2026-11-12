import { expect, test } from '../fixtures.js';
import { CommitGraphHarness } from '../harnesses/CommitGraph.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';
import { getScrollTop } from '../utils/getScrollTop.js';
import { scrollDown } from '../utils/scrollDown.js';

// An item opens in the panel; Enter on its row again, "Open full screen" or ⇧Enter expand it to its page, and Escape,
// "Back to the panel" or ⇧Enter step back to the panel (`OpenedItem.vue`).

const ISSUE = 'Sign-in loops after the token expires';
const PANEL = '/?pane=issue&issue=acme%7Cweb%7C12';
const PAGE = '/acme/web/issues/12';

test('Enter on the open row expands the item to its page; Escape goes back to the panel, scrolled where it was', async ({
    page,
    github,
}) => {
    // Short enough for the item to scroll.
    await page.setViewportSize({ width: 1280, height: 360 });
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await myWork.row(ISSUE).click();
    await expect(page).toHaveURL(PANEL);
    const top = await scrollDown(item.content);

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(PAGE);
    await expect(item.backToPanelButton).toBeVisible();
    // The page of a 1280px window: two columns, the thread's at its top.
    await expect.poll(() => getScrollTop(item.timeline)).toBe(0);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(PANEL);
    await expect(item.title).toHaveText(ISSUE);
    await expect.poll(() => getScrollTop(item.content)).toBe(top);
    await expect(myWork.selectedRow).toContainText(ISSUE);

    // Escape in the panel closes it.
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/');
    await expect(item.root).toBeHidden();
});

test('the open row\'s context menu "Open full screen" expands it as the header does: Escape comes back to the panel', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await myWork.row(ISSUE).click();
    await expect(page).toHaveURL(PANEL);
    await myWork.row(ISSUE).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Open full screen' }).click();
    await expect(page).toHaveURL(PAGE);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(PANEL);
    await expect(item.title).toHaveText(ISSUE);
});

test('Shift+Enter toggles the panel and the page', async ({ page, github }) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await myWork.row(ISSUE).click();
    await expect(item.fullScreenButton).toBeVisible();
    await page.keyboard.press('Shift+Enter');
    await expect(page).toHaveURL(PAGE);
    await page.keyboard.press('Shift+Enter');
    await expect(page).toHaveURL(PANEL);
    await expect(item.fullScreenButton).toBeVisible();
});

test('a reload of an expanded page keeps "Back to the panel" returning to the panel', async ({ page, github }) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await myWork.row(ISSUE).click();
    await item.fullScreenButton.click();
    await expect(page).toHaveURL(PAGE);

    await page.reload();
    await expect(item.title).toHaveText(ISSUE);
    await item.backToPanelButton.click();
    await expect(page).toHaveURL(PANEL);
    await expect(item.title).toHaveText(ISSUE);
    await expect(myWork.selectedRow).toContainText(ISSUE);
});

test('a page opened by its address: "Back to the panel" puts the item in the panel over the list, Escape closes it to the list', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await page.goto(PAGE);
    await expect(item.title).toHaveText(ISSUE);
    await item.backToPanelButton.click();
    await expect(page).toHaveURL(PANEL);
    await expect(item.title).toHaveText(ISSUE);
    await expect(myWork.selectedRow).toContainText(ISSUE);

    await page.goto(PAGE);
    await expect(item.title).toHaveText(ISSUE);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/');
    await expect(item.root).toBeHidden();
});

test("Shift+Enter over a screen with no list: a commit's pull request goes from the panel to its page and back over the commit graph", async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    sample.world.history(SAMPLE_REPOSITORY, {
        commits: [
            {
                oid: 'c1',
                headline: 'fix: export the CSV header',
                author: 'monalisa',
                minutesAgo: 60,
                pullRequest: { number: 4, state: 'MERGED', title: 'Fix the crash on start' },
            },
        ],
        branches: { main: 'c1' },
    });
    await openTrackedWork(page, github, sample.world);
    await page.goto(`/${SAMPLE_REPOSITORY}/commits`);
    const graph = new CommitGraphHarness(page, SAMPLE_REPOSITORY);
    const item = new ItemViewHarness(page);
    await expect(graph.cursorRow).toContainText('fix: export the CSV header');
    // Shift+Enter opens the pull request the details show, read after the commit: until then it has nothing to open.
    await expect(graph.details.getByRole('button', { name: /Fix the crash on start/ })).toBeVisible();

    // The commit's pull request, in the panel over the graph.
    await page.keyboard.press('Shift+Enter');
    await expect(item.title).toHaveText('Fix the crash on start');
    await expect(item.fullScreenButton).toBeVisible();
    const panel = `/${SAMPLE_REPOSITORY}/commits?pane=issue&issue=octocat%7Capp%7C4`;
    await expect(page).toHaveURL(panel);

    await page.keyboard.press('Shift+Enter');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/pull/4`);
    await expect(item.backToPanelButton).toBeVisible();

    await page.keyboard.press('Shift+Enter');
    await expect(page).toHaveURL(panel);
    await expect(item.title).toHaveText('Fix the crash on start');
    await expect(item.fullScreenButton).toBeVisible();
    await expect(graph.root).toBeVisible();
});
