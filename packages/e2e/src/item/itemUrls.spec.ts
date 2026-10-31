import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

// The sample's list, top to bottom: #52, #48, #17, #7, then #12 with #15 nested under it, #9, and #3 — 8 items.
const ISSUE = 'Sign-in loops after the token expires';

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

test('switched to a modal and back, the address stays the same; a reload reopens the item in the arrangement remembered, Back returns to the list, and the next item opens in a modal too', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await myWork.row(ISSUE).click();
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C12');
    await item.arrangement('Modal').click();
    await expect(item.modal).toHaveAccessibleName(ISSUE);
    // The address does not say panel or modal: this browser remembers which.
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C12');
    await item.arrangement('Panel').click();
    await expect(item.modal).toBeHidden();
    await expect(item.title).toHaveText(ISSUE);
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C12');
    await item.arrangement('Modal').click();
    await expect(item.modal).toHaveAccessibleName(ISSUE);
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C12');

    await page.reload();
    await expect(item.modal).toHaveAccessibleName(ISSUE);
    await expect(item.title).toHaveText(ISSUE);

    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(item.root).toBeHidden();
    await expect(myWork.selectedRow).toContainText(ISSUE);

    // The arrangement used last is the one items open in.
    await page.keyboard.press('j');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C15');
    await expect(item.modal).toHaveAccessibleName('Redirect once after sign-in');
});

test("switched to a page of its own, the item is at GitHub's address of it: a reload opens it again, Back returns to the list with it selected", async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    await myWork.row(ISSUE).click();
    await item.arrangement('Full page').click();
    await expect(page).toHaveURL('/acme/web/issues/12');
    await expect(item.title).toHaveText(ISSUE);
    await expect(myWork.groups).toHaveCount(0);

    await page.reload();
    await expect(item.title).toHaveText(ISSUE);

    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(item.root).toBeHidden();
    await expect(myWork.selectedRow).toContainText(ISSUE);
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

    await item.arrangement('Full page').click();
    await expect(page).toHaveURL('/acme/api/pull/52');
    await page.keyboard.press('j');
    await expect(page).toHaveURL('/acme/api/pull/48');
    await expect(item.title).toHaveText('Cache search results');
    await expect(item.position).toHaveText('2 / 8');

    // Back from the page is the list, with the item stepped to selected.
    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(myWork.selectedRow).toContainText('Cache search results');
});
