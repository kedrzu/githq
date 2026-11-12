import type { Locator } from '@playwright/test';

import { createSampleEditableWork } from '../edits/sampleEditableWork.js';
import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';
import { answerReview } from '../review/answerReview.js';

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

test('a link to a comment opens the item over the list with the comment in view and marked, the scroll padding above it, until the address no longer names it', async ({
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
    // Not flush against the edge: the room the content keeps at its ends.
    await expect.poll(() => getRoomAbove(item.linkedComment)).toBe(20);

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

test('a link to a comment of a pull request keeps it in view while the review threads above it arrive, until the user scrolls', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { world } = sample;
    world.review(sample.pullRequest, {
        id: 'R_hubot',
        author: 'hubot',
        state: 'CHANGES_REQUESTED',
        bodyHtml: '<p>A few things before it goes in.</p>',
        minutesAgo: 60,
    });
    const linked = `issuecomment-${world.comment(sample.pullRequest, { author: 'hubot', body: 'Linked remark', minutesAgo: 5 })}`;
    await openMyWork(page, github, world);
    const review = answerReview(github, {
        repository: 'acme/web',
        number: 15,
        files: [],
        // Tall enough, together, to push the comment under them out of view.
        threads: Array.from({ length: 8 }, (_, index) => ({
            id: `T_${index}`,
            path: `src/auth/file${index}.ts`,
            line: 2,
            diffHunk: '@@ -1,2 +1,2 @@\n const back = read()\n-go(back)\n+go(back ?? home)',
            comments: [`<p>Thread ${index}: what if there is no return address?</p>`],
            reviewId: 'R_hubot',
        })),
    });
    const release = review.holdThreads();
    const item = new ItemViewHarness(page);

    await page.goto(`/acme/web/pull/15#${linked}`);
    await expect(item.linkedComment).toHaveId(linked);
    await expect(item.linkedComment).toBeInViewport();

    release();
    await expect(item.root.getByText('Thread 7: what if')).toBeAttached();
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await expect(item.linkedComment).toBeInViewport();

    // The user scrolls: the comment lets go, and the thread stays where they put it.
    const anchored = await getScrollTop(item.timeline);
    await item.timeline.hover();
    await page.mouse.wheel(0, -400);
    await expect.poll(() => getScrollTop(item.timeline)).toBeLessThan(anchored);
    const scrolled = await getScrollTop(item.timeline);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    expect(await getScrollTop(item.timeline)).toBe(scrolled);
});

test('a link to a comment on the code opens its resolved thread once the threads are in, in view and marked; one to a review its card', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { world } = sample;
    world.review(sample.pullRequest, {
        id: 'R_hubot',
        author: 'hubot',
        state: 'CHANGES_REQUESTED',
        bodyHtml: '<p>A few things before it goes in.</p>',
        minutesAgo: 60,
    });
    world.comment(sample.pullRequest, { author: 'hubot', body: 'A remark after the review', minutesAgo: 5 });
    await openMyWork(page, github, world);
    const review = answerReview(github, {
        repository: 'acme/web',
        number: 15,
        files: [],
        // Tall enough, together, to put the last one out of view.
        threads: Array.from({ length: 8 }, (_, index) => ({
            id: `T_${index}`,
            path: `src/auth/file${index}.ts`,
            line: 2,
            diffHunk: '@@ -1,2 +1,2 @@\n const back = read()\n-go(back)\n+go(back ?? home)',
            comments: [`<p>Thread ${index}: what if there is no return address?</p>`, '<p>Fixed.</p>'],
            reviewId: 'R_hubot',
            isResolved: index === 7,
        })),
    });
    const release = review.holdThreads();
    const item = new ItemViewHarness(page);
    const linked = item.root.locator('[aria-current="location"]');

    await page.goto('/acme/web/pull/15#discussion_T_7_1');
    await expect(item.root.getByText('A remark after the review')).toBeVisible();
    release();
    await expect(linked).toHaveId('discussion_T_7_1');
    await expect(linked).toBeInViewport();

    // From another page: an address differing only in its fragment would be a navigation within the page.
    await page.goto('/');
    await page.goto('/acme/web/pull/15#pullrequestreview-R_hubot');
    await expect(linked).toHaveId('pullrequestreview-R_hubot');
    await expect(linked).toBeInViewport();
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

    // The user scrolls, which lets the comment go, up near the top: the description's link still in full view, so
    // clicking it scrolls nothing.
    await item.timeline.hover();
    await page.mouse.wheel(0, -100);
    await item.timeline.evaluate((element, top) => {
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
    await expect.poll(() => getScrollTop(item.timeline)).toBe(SCROLLED);
    // And no scroll to the comment after it.
    await page.evaluate(() => new Promise(requestAnimationFrame));
    expect(await getScrollTop(item.timeline)).toBe(SCROLLED);
});

function getIds(elements: Locator) {
    return elements.evaluateAll(nodes => nodes.map(node => node.id));
}

function getScrollTop(container: Locator) {
    return container.evaluate(element => element.scrollTop);
}

/** How far below the top of its scrolling container the element is: the one around it that scrolls in this layout. */
function getRoomAbove(element: Locator) {
    return element.evaluate(node => {
        let container = node.closest('[data-route-scroll]');
        while (container && !['auto', 'scroll'].includes(getComputedStyle(container).overflowY)) {
            container = container.parentElement?.closest('[data-route-scroll]') ?? null;
        }

        return container ? Math.round(node.getBoundingClientRect().top - container.getBoundingClientRect().top) : null;
    });
}
