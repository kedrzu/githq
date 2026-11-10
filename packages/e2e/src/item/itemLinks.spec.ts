import type { Locator } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

const LINKING = 'Explain how tokens expire';
const LINKED = 'Tokens expire an hour early';
/**
 * More than an opened item reads at once (the first 2 and the newest 50), so the comments between are read only on
 * demand, and its thread folds its middle.
 */
const COMMENTS = 60;
/** Where in the thread the comment linked to is: among those read, folded away. */
const FOLDED = 30;
/** Where the comment is that the item does not read at once. */
const UNREAD = 5;
/** Where the test leaves an item scrolled: neither its top, where a new one opens, nor its linked comment. */
const SCROLLED = 40;

/**
 * The sample with an issue (#31) of {@link COMMENTS} comments, whose description links to #30, and #30, whose
 * description links to a comment on #31 as GitHub renders a reference to one: the {@link FOLDED}th, read with the
 * item but folded away in its thread.
 */
function createWorldWithLink() {
    const { world } = createSampleMyWork();
    const linked = world.issue({
        repository: 'acme/web',
        number: 31,
        title: LINKED,
        foundBy: ['assigned'],
        minutesAgo: 50,
        bodyHtml: '<p>Found while writing <a href="https://github.com/acme/web/issues/30">#30</a>.</p>',
    });
    const comment = (position: number) =>
        `issuecomment-${world.comment(linked, { author: 'monalisa', body: `Remark ${position}`, minutesAgo: COMMENTS - position })}`;
    const anchors = Array.from({ length: COMMENTS }, (_, index) => comment(index + 1));
    const folded = anchors[FOLDED - 1]!;
    const unread = anchors[UNREAD - 1]!;
    world.issue({
        repository: 'acme/web',
        number: 30,
        title: LINKING,
        foundBy: ['assigned'],
        minutesAgo: 40,
        bodyHtml: `<p>Caused by <a href="https://github.com/acme/web/issues/31#${folded}">#31</a>.</p>`,
    });
    return { world, anchors, folded, unread };
}

test("on its own page, a link in an item's description to another issue opens it in githq, in no new tab", async ({
    page,
    github,
}) => {
    const { world, folded } = createWorldWithLink();
    await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);
    await page.goto('/acme/web/issues/30');
    await expect(item.title).toHaveText(LINKING);

    await item.root.getByRole('link', { name: '#31' }).click();
    // The comment it points to stays in the address.
    await expect(page).toHaveURL(`/acme/web/issues/31#${folded}`);
    await expect(item.title).toHaveText(LINKED);
    expect(page.context().pages()).toHaveLength(1);
});

test("opened over a list, a link in an item's description to another issue opens it over the same list", async ({
    page,
    github,
}) => {
    const { world, folded } = createWorldWithLink();
    const { myWork } = await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);
    await myWork.row(LINKING).click();
    await expect(item.title).toHaveText(LINKING);

    await item.root.getByRole('link', { name: '#31' }).click();
    await expect(page).toHaveURL(`/?pane=issue&issue=acme%7Cweb%7C31#${folded}`);
    await expect(item.title).toHaveText(LINKED);
    expect(page.context().pages()).toHaveLength(1);
});

test('an address naming a comment folded away in the thread unfolds it, shows it in view and marks it, each comment by its own anchor', async ({
    page,
    github,
}) => {
    const { world, anchors, folded } = createWorldWithLink();
    await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);

    await page.goto(`/acme/web/issues/31#${folded}`);
    await expect(item.title).toHaveText(LINKED);
    await expect(item.linkedComment).toHaveCount(1);
    await expect(item.linkedComment).toHaveId(folded);
    await expect(item.linkedComment).toBeInViewport();
    // The middle read and shown: every comment carries the anchor GitHub gives it.
    await expect(item.comments).toHaveCount(COMMENTS);
    expect(await getIds(item.comments)).toEqual(anchors);
});

test('a link to a comment opens the item over the list with the comment in view and marked, until the address no longer names it', async ({
    page,
    github,
}) => {
    const { world, folded } = createWorldWithLink();
    const { myWork } = await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);
    await myWork.row(LINKING).click();
    await expect(item.title).toHaveText(LINKING);

    await item.root.getByRole('link', { name: '#31' }).click();
    await expect(item.title).toHaveText(LINKED);
    await expect(item.linkedComment).toHaveId(folded);
    await expect(item.linkedComment).toBeInViewport();

    // The same item, at an address without the fragment.
    await myWork.row(LINKED).click();
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C31');
    await expect(item.root.locator(`#${folded}`)).toBeAttached();
    await expect(item.linkedComment).toHaveCount(0);
});

test('a comment the item did not read is read from GitHub with the middle, then shown in view', async ({
    page,
    github,
}) => {
    const { world, unread } = createWorldWithLink();
    await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);

    await page.goto(`/acme/web/issues/31#${unread}`);
    await expect(item.linkedComment).toHaveId(unread);
    await expect(item.linkedComment).toBeInViewport();
    expect(github.graphqlCalls.map(call => call.name)).toContain('ThreadMiddle');
});

test('Back to an address naming a comment returns to where the item was scrolled, not to the comment', async ({
    page,
    github,
}) => {
    const { world, folded } = createWorldWithLink();
    await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);
    await page.goto(`/acme/web/issues/31#${folded}`);
    await expect(item.linkedComment).toBeInViewport();

    // Near the top, the description's link still in full view, so clicking it scrolls nothing.
    await item.content.evaluate((element, top) => {
        element.scrollTop = top;
    }, SCROLLED);
    const link = item.root.getByRole('link', { name: '#30' });
    await expect(link).toBeInViewport({ ratio: 1 });
    await link.click();
    await expect(item.title).toHaveText(LINKING);
    // Another item: no comment of it is named.
    await expect(item.linkedComment).toHaveCount(0);

    await page.goBack();
    await expect(page).toHaveURL(`/acme/web/issues/31#${folded}`);
    await expect(item.title).toHaveText(LINKED);
    await expect(item.linkedComment).toBeAttached();
    await expect.poll(() => getScrollTop(item.content)).toBe(SCROLLED);
    // And no scroll to the comment after it.
    await page.evaluate(() => new Promise(requestAnimationFrame));
    expect(await getScrollTop(item.content)).toBe(SCROLLED);
});

function getIds(elements: Locator) {
    return elements.evaluateAll(nodes => nodes.map(node => node.id));
}

function getScrollTop(container: Locator) {
    return container.evaluate(element => element.scrollTop);
}
