import type { Locator } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

const LINKING = 'Explain how tokens expire';
const LINKED = 'Tokens expire an hour early';
/** More than an opened item reads at once (the newest 50), so its oldest comments are read only on demand. */
const COMMENTS = 60;
/** Where the test leaves an item scrolled: neither its top, where a new one opens, nor its linked comment. */
const SCROLLED = 40;

/**
 * The sample with an issue (#31) of {@link COMMENTS} comments, whose description links to #30, and #30, whose
 * description links to a comment on #31 as GitHub renders a reference to one: the fifth newest, read with the
 * item but hidden behind "Show all".
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
    const comments = (from: number, to: number) =>
        Array.from({ length: to - from + 1 }, (_, index) => comment(from + index));
    const oldest = comment(1);
    const older = comments(2, COMMENTS - 5);
    const hidden = comment(COMMENTS - 4);
    const anchors = [oldest, ...older, hidden, ...comments(COMMENTS - 3, COMMENTS)];
    world.issue({
        repository: 'acme/web',
        number: 30,
        title: LINKING,
        foundBy: ['assigned'],
        minutesAgo: 40,
        bodyHtml: `<p>Caused by <a href="https://github.com/acme/web/issues/31#${hidden}">#31</a>.</p>`,
    });
    return { world, anchors, hidden, oldest };
}

test("on its own page, a link in an item's description to another issue opens it in githq, in no new tab", async ({
    page,
    github,
}) => {
    const { world, hidden } = createWorldWithLink();
    await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);
    await page.goto('/acme/web/issues/30');
    await expect(item.title).toHaveText(LINKING);

    await item.root.getByRole('link', { name: '#31' }).click();
    // The comment it points to stays in the address.
    await expect(page).toHaveURL(`/acme/web/issues/31#${hidden}`);
    await expect(item.title).toHaveText(LINKED);
    expect(page.context().pages()).toHaveLength(1);
});

test("opened over a list, a link in an item's description to another issue opens it over the same list", async ({
    page,
    github,
}) => {
    const { world, hidden } = createWorldWithLink();
    const { myWork } = await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);
    await myWork.row(LINKING).click();
    await expect(item.title).toHaveText(LINKING);

    await item.root.getByRole('link', { name: '#31' }).click();
    await expect(page).toHaveURL(`/?pane=issue&issue=acme%7Cweb%7C31#${hidden}`);
    await expect(item.title).toHaveText(LINKED);
    expect(page.context().pages()).toHaveLength(1);
});

test('an address naming a comment behind "Show all" shows it in view and marks it, each comment by its own anchor', async ({
    page,
    github,
}) => {
    const { world, anchors, hidden } = createWorldWithLink();
    await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);

    await page.goto(`/acme/web/issues/31#${hidden}`);
    await expect(item.title).toHaveText(LINKED);
    await expect(item.linkedComment).toHaveCount(1);
    await expect(item.linkedComment).toHaveId(hidden);
    await expect(item.linkedComment).toBeInViewport();
    // Every comment read — the newest 50 — carries the anchor GitHub gives it.
    expect(await getIds(item.comments)).toEqual(anchors.slice(-50));
});

test('a link to a comment opens the item over the list with the comment in view and marked, until the address no longer names it', async ({
    page,
    github,
}) => {
    const { world, hidden } = createWorldWithLink();
    const { myWork } = await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);
    await myWork.row(LINKING).click();
    await expect(item.title).toHaveText(LINKING);

    await item.root.getByRole('link', { name: '#31' }).click();
    await expect(item.title).toHaveText(LINKED);
    await expect(item.linkedComment).toHaveId(hidden);
    await expect(item.linkedComment).toBeInViewport();

    // The same item, at an address without the fragment.
    await myWork.row(LINKED).click();
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C31');
    await expect(item.root.locator(`#${hidden}`)).toBeAttached();
    await expect(item.linkedComment).toHaveCount(0);
});

test('a comment older than those read with the item is read from GitHub, then shown in view', async ({
    page,
    github,
}) => {
    const { world, oldest } = createWorldWithLink();
    await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);

    await page.goto(`/acme/web/issues/31#${oldest}`);
    await expect(item.linkedComment).toHaveId(oldest);
    await expect(item.linkedComment).toBeInViewport();
    expect(github.graphqlCalls.map(call => call.name)).toContain('MoreComments');
});

test('Back to an address naming a comment returns to where the item was scrolled, not to the comment', async ({
    page,
    github,
}) => {
    const { world, hidden } = createWorldWithLink();
    await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);
    await page.goto(`/acme/web/issues/31#${hidden}`);
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
    await expect(page).toHaveURL(`/acme/web/issues/31#${hidden}`);
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
