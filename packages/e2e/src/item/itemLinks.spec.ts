import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

const LINKING = 'Explain how tokens expire';
const LINKED = 'Sign-in loops after the token expires';

/** The sample with an issue whose description links to a comment on #12, as GitHub renders a reference to one. */
function createWorldWithLink() {
    const sample = createSampleMyWork();
    sample.world.issue({
        repository: 'acme/web',
        number: 30,
        title: LINKING,
        foundBy: ['assigned'],
        minutesAgo: 40,
        bodyHtml: '<p>Caused by <a href="https://github.com/acme/web/issues/12#issuecomment-5">#12</a>.</p>',
    });
    return sample.world;
}

test("on its own page, a link in an item's description to another issue opens it in githq, in no new tab", async ({
    page,
    github,
}) => {
    await openMyWork(page, github, createWorldWithLink());
    const item = new ItemViewHarness(page);
    await page.goto('/acme/web/issues/30');
    await expect(item.title).toHaveText(LINKING);

    await item.root.getByRole('link', { name: '#12' }).click();
    // The comment it points to stays in the address.
    await expect(page).toHaveURL('/acme/web/issues/12#issuecomment-5');
    await expect(item.title).toHaveText(LINKED);
    expect(page.context().pages()).toHaveLength(1);
});

test("opened over a list, a link in an item's description to another issue opens it over the same list", async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createWorldWithLink());
    const item = new ItemViewHarness(page);
    await myWork.row(LINKING).click();
    await expect(item.title).toHaveText(LINKING);

    await item.root.getByRole('link', { name: '#12' }).click();
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C12#issuecomment-5');
    await expect(item.title).toHaveText(LINKED);
    expect(page.context().pages()).toHaveLength(1);
});
