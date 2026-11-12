import { expect, test } from '../fixtures.js';
import { GitHubHttpError } from '../github/GitHubMock.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

// The sample's list, top to bottom: #52, #48, #17, #7, then #12 with #15 nested under it, #9, and #3 — 8 items.
const ISSUE = 'Sign-in loops after the token expires';
const MENTION = 'Dark mode for the status bar';

test("an item opened from the list in the panel is at GitHub's project-pane address: a reload opens it again, Back returns to the list with it selected", async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await myWork.row(ISSUE).click();
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C12');
    await expect(item.title).toHaveText(ISSUE);
    await expect(item.position).toHaveText('5 / 8');

    await page.reload();
    await expect(item.title).toHaveText(ISSUE);
    await expect(myWork.selectedRow).toContainText(ISSUE);

    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(item.root).toBeHidden();
    await expect(myWork.selectedRow).toContainText(ISSUE);
});

test('an item that leaves my work while it is open stays open, and is read once more for what made it leave', async ({
    page,
    github,
}) => {
    // Time runs as usual, and the 30 seconds to the next poll can be skipped.
    await page.clock.install();
    const sample = createSampleMyWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);

    await myWork.row(MENTION).click();
    await expect(item.title).toHaveText(MENTION);

    sample.world.retitle(sample.mention, 'Dark mode everywhere');
    sample.world.leave(sample.mention, 'mentioned');
    await page.clock.fastForward('00:30');

    await expect(myWork.row(MENTION)).toHaveCount(0);
    await expect(item.title).toHaveText('Dark mode everywhere');
});

test('in a window with no room for the panel beside the list an item opens on its page; with room again, the next opens in the panel', async ({
    page,
    github,
}) => {
    // The sidebar's 236 px, the list's 400 and the panel's 400 need 1,036.
    await page.setViewportSize({ width: 1000, height: 800 });
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await myWork.row(ISSUE).click();
    await expect(page).toHaveURL('/acme/web/issues/12');
    await expect(item.title).toHaveText(ISSUE);

    await page.goBack();
    await expect(page).toHaveURL('/');
    await page.setViewportSize({ width: 1440, height: 900 });
    // Two frames: the shell has measured the window.
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.keyboard.press('j');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C15');
    await expect(item.title).toHaveText('Redirect once after sign-in');
});

test('narrowed until the panel no longer fits, the item in it moves to its page in place of the address; widened, it stays there', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C12');

    await page.setViewportSize({ width: 1000, height: 800 });
    await expect(page).toHaveURL('/acme/web/issues/12');
    await expect(item.title).toHaveText(ISSUE);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(myWork.groups).toHaveCount(0);
    await expect(page).toHaveURL('/acme/web/issues/12');

    // The panel's address was replaced: Back is the list.
    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(myWork.selectedRow).toContainText(ISSUE);
});

test("expanded to a page of its own, the item is at GitHub's address of it: a reload opens it again, Back returns to the panel over the list, the item selected", async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await myWork.row(ISSUE).click();
    await item.fullScreenButton.click();
    await expect(page).toHaveURL('/acme/web/issues/12');
    await expect(item.title).toHaveText(ISSUE);
    await expect(myWork.groups).toHaveCount(0);

    await page.reload();
    await expect(item.title).toHaveText(ISSUE);

    await page.goBack();
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C12');
    await expect(item.title).toHaveText(ISSUE);
    await expect(myWork.selectedRow).toContainText(ISSUE);
});

test("an address GitHub can't be asked about says so instead of opening for ever, and Try again asks again", async ({
    page,
    github,
}) => {
    await openMyWork(page, github, createSampleMyWork().world);
    github.graphql('ItemByNumber', new GitHubHttpError(403, 'Forbidden'));

    await page.goto('/acme/web/issues/999');
    await expect(page.getByRole('heading', { name: "Couldn't reach GitHub" })).toBeVisible();

    github.graphql('ItemByNumber', { repository: null });
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'No such issue or pull request' })).toBeVisible();
});

test('J and K step through the list the item was opened from, beside it and on its own page', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await myWork.row('Cache search results').click();
    await expect(item.position).toHaveText('2 / 8');

    await page.keyboard.press('j');
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C17');
    await expect(item.title).toHaveText('Move the sidebar state to the store');
    await expect(item.position).toHaveText('3 / 8');
    await expect(myWork.selectedRow).toContainText('Move the sidebar state to the store');

    await page.keyboard.press('k');
    await page.keyboard.press('k');
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Capi%7C52');
    await expect(item.title).toHaveText('Add rate limit headers to the API');
    await expect(item.position).toHaveText('1 / 8');
    await expect(item.previousButton).toBeDisabled();

    await item.fullScreenButton.click();
    await expect(page).toHaveURL('/acme/api/pull/52');
    await page.keyboard.press('j');
    await expect(page).toHaveURL('/acme/api/pull/48');
    await expect(item.title).toHaveText('Cache search results');
    await expect(item.position).toHaveText('2 / 8');

    // Escape from the page is Back to the panel it was expanded from, showing the item stepped to, selected.
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Capi%7C48');
    await expect(item.title).toHaveText('Cache search results');
    await expect(myWork.selectedRow).toContainText('Cache search results');
});
