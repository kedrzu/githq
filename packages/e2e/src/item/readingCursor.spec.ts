import type { Locator, Page } from '@playwright/test';

import { createSampleEditableWork } from '../edits/sampleEditableWork.js';
import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { answerReview } from '../review/answerReview.js';
import type { SampleReviewThread } from '../review/answerReview.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

// The reading cursor over an opened item's thread (D44): on its page the keys move it and act on its stop; in the panel
// beside a list they stay the list's. AC1–AC5 in the titles: the criteria of D46 in `docs/design/githq/DECISIONS.md`.

const ISSUE = 'Sign-in loops after the token expires';
const FIRST_COMMENT = 'Seen it twice today.';
const SECOND_COMMENT = 'Happens on mobile too.';

test('on its page the cursor opens on the description and ] [ step from comment to comment, staying at the last', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    sample.world.comment(sample.issue, { author: 'hubot', body: FIRST_COMMENT, minutesAgo: 4 });
    sample.world.comment(sample.issue, { author: 'monalisa', body: SECOND_COMMENT, minutesAgo: 3 });
    const { myWork } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await expect(item.title).toHaveText(ISSUE);
    await page.keyboard.press('Shift+Enter');
    await expect(item.backToPanelButton).toBeVisible();

    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', 'description');
    await page.keyboard.press(']');
    await expect(item.readingCursor).toContainText(FIRST_COMMENT);
    await page.keyboard.press(']');
    await expect(item.readingCursor).toContainText(SECOND_COMMENT);
    await page.keyboard.press(']');
    await expect(item.readingCursor).toContainText(SECOND_COMMENT);
    await page.keyboard.press('[');
    await expect(item.readingCursor).toContainText(FIRST_COMMENT);
});

test("in the panel beside a repository's list, ↓ ↑ move the list's row and ] its section, and no stop is marked", async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    const repository = new RepositoryScreenHarness(page);
    const item = new ItemViewHarness(page);
    await page.goto(`/${SAMPLE_REPOSITORY}/issues`);
    await repository.row('Crash on start').click();
    await expect(item.title).toHaveText('Crash on start');
    await expect(item.fullScreenButton).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await expect(repository.selectedRow).toContainText('Add a dark theme');
    await expect(item.title).toHaveText('Add a dark theme');
    await page.keyboard.press('ArrowUp');
    await expect(repository.selectedRow).toContainText('Crash on start');
    await expect(item.readingCursor).toHaveCount(0);

    await page.keyboard.press(']');
    await expect(page).toHaveURL(new RegExp(`/${SAMPLE_REPOSITORY}/pulls`));
    await expect(repository.section('Pull requests')).toHaveAttribute('aria-pressed', 'true');
});

const PULL_REQUEST = 'Redirect once after sign-in';
const PLAIN = 'Does the redirect keep the query?';
const QUESTION = 'What if there is no return address?';
const ANSWER = 'Home, I would say.';
const OWN = 'I will fix it today.';
const DRAFT = 'Mine, not sent yet.';
/** Far taller than the screen: the cursor reads through it in steps. */
const TALL = 'A long read. '.repeat(800).trim();
/** How fast a held arrow scrolls, in px a second. */
const HELD_SPEED = 500;
/** How long after the press a held key starts repeating. */
const KEY_DELAY_MS = 300;
/** How often a held key repeats. */
const KEY_REPEAT_MS = 50;
/** How far a held arrow's reading line travels between two repeats. */
const REPEAT_TRAVEL = (HELD_SPEED * KEY_REPEAT_MS) / 1000;
/** The shortest stretch the cursor stops at: a gap or a card's padding shorter than this belongs to the stop before it. */
const SHORT_TAIL = 40;
/** The page's own address of the sample pull request, and of the comment of its code thread answering the question. */
const PAGE_ADDRESS = '/acme/web/pull/15';
const ANSWER_ANCHOR = 'discussion_T_open_1';

test('] puts the cursor on each comment in order, the review and each comment of its code thread too, never on a commit, an event or a code thread; [ goes back; both stop at the ends', async ({
    page,
    github,
}) => {
    const { item, ids } = await openReadingThread(page, github);
    const comments = [
        'description',
        ids.plain,
        'R_hubot',
        'T_open_0',
        'T_open_1',
        ids.tall,
        ids.own,
        'draftReview',
        'T_mine_0',
    ];

    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', 'description');
    for (const key of comments.slice(1)) {
        await page.keyboard.press(']');
        await expect(item.readingCursor).toHaveAttribute('data-reading-stop', key);
        await expect(item.readingCursor).toBeInViewport();
    }

    await page.keyboard.press(']');
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', 'T_mine_0');

    for (const key of comments.toReversed().slice(1)) {
        await page.keyboard.press('[');
        await expect(item.readingCursor).toHaveAttribute('data-reading-stop', key);
        await expect(item.readingCursor).toBeInViewport();
    }

    await page.keyboard.press('[');
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', 'description');
});

test('AC1, AC2: the cursor on a comment of a code thread marks it, its thread and its review, and Reply… and Resolve thread show R and H; on the thread the thread and the review; elsewhere only its own stop, no hints', async ({
    page,
    github,
}) => {
    const { item, ids } = await openReadingThread(page, github);
    const thread = item.root.getByRole('group', { name: 'Thread by sofiab on src/auth/redirect.ts' });
    const reply = thread.getByRole('button', { name: 'Reply…' });
    const resolve = thread.getByRole('button', { name: 'Resolve thread' });

    expect(await getMarkedStops(item)).toEqual(['description']);
    await expectNoHint(reply);
    await expectNoHint(resolve);

    for (let press = 0; press < 3; press++) {
        await page.keyboard.press(']');
    }

    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', 'T_open_0');
    expect(await getMarkedStops(item)).toEqual(['R_hubot', 'thread:T_open', 'T_open_0']);
    await expectHint(reply, 'R');
    await expectHint(resolve, 'H');

    // On to the next comment, then the thread's own bands under it: the thread and its review stay marked.
    await page.keyboard.press('ArrowDown');
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', 'T_open_1');
    expect(await getMarkedStops(item)).toEqual(['R_hubot', 'thread:T_open', 'T_open_1']);
    await page.keyboard.press('ArrowDown');
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', 'thread:T_open');
    expect(await getMarkedStops(item)).toEqual(['R_hubot', 'thread:T_open']);
    await expectHint(reply, 'R');
    await expectHint(resolve, 'H');

    // A comment outside any thread: only it is marked, and the thread's buttons show no keys.
    await pointAt(page, item.root.locator(`[data-reading-stop="${ids.plain}"]`));
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', ids.plain);
    expect(await getMarkedStops(item)).toEqual([ids.plain]);
    await expectNoHint(reply);
    await expectNoHint(resolve);
});

test('AC3: opened at a comment of a code thread, the cursor starts on it, with no accent border; one ↓ or the pointer moved to another stop leaves it unmarked; in the panel it keeps the accent border', async ({
    page,
    github,
}) => {
    const { item } = await createReadingThread(page, github);
    const answer = item.root.locator(`#${ANSWER_ANCHOR}`);
    const thread = item.root.locator('[data-code-thread="T_open"]');

    // In the panel there is no cursor: the linked comment is the location, its card's border in the accent.
    await page.goto(`/?pane=issue&issue=acme%7Cweb%7C15#${ANSWER_ANCHOR}`);
    await expect(answer).toHaveAttribute('aria-current', 'location');
    await expect(thread).toHaveClass(LINKED_CLASS);
    await expect(item.readingCursor).toHaveCount(0);

    // On the page the cursor starts there, the comment marked as any stop under it, no accent border.
    await openOnPage(item, `${PAGE_ADDRESS}#${ANSWER_ANCHOR}`);
    await expect(item.readingCursor).toHaveAttribute('id', ANSWER_ANCHOR);
    expect(await getMarkedStops(item)).toEqual(['R_hubot', 'thread:T_open', 'T_open_1']);
    await expect(thread).not.toHaveClass(LINKED_CLASS);

    await page.keyboard.press('ArrowDown');
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', 'thread:T_open');
    await expect(answer).not.toHaveAttribute('aria-current');
    await expect(thread).not.toHaveClass(LINKED_CLASS);

    // Again, the pointer this time.
    await page.goto('/');
    await openOnPage(item, `${PAGE_ADDRESS}#${ANSWER_ANCHOR}`);
    await expect(item.readingCursor).toHaveAttribute('id', ANSWER_ANCHOR);
    // The review request's line under the review, in view: the page is scrolled to the thread.
    const event = item.root.locator('[data-reading-stop^="events:"]');
    await pointAt(page, event);
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', /^events:/u);
    await expect(answer).not.toHaveAttribute('aria-current');
    expect(await getMarkedStops(item)).toEqual([await event.getAttribute('data-reading-stop')]);
    await expect(thread).not.toHaveClass(LINKED_CLASS);
});

test('AC4: a single ↓ goes stop by stop, the code thread’s excerpt, comments and bands each, and through the tall comment a quarter of the screen a press; ↑ comes back the same way; every press moves the cursor or scrolls until the content’s end', async ({
    page,
    github,
}) => {
    const { item, ids } = await openReadingThread(page, github);
    const scroller = await getScroller(item);
    const stops = [
        'description',
        expect.stringMatching(/^commit:/u),
        ids.plain,
        'R_hubot',
        'thread:T_open',
        'T_open_0',
        'T_open_1',
        // The thread's bands after its comments.
        'thread:T_open',
        expect.stringMatching(/^events:/u),
        ids.tall,
        ids.own,
        'draftReview',
        'thread:T_mine',
        'T_mine_0',
        // The draft's toolbar after its thread.
        'draftReview',
    ];

    const down = await pressUntilStill(page, item, 'ArrowDown');
    expect(down.at(-1)?.view.atEnd).toBe(true);
    expect(unique(['description', ...down.map(press => press.key)])).toEqual(stops);
    // A short stop takes one press.
    for (const key of [ids.plain, 'R_hubot', 'T_open_0', 'T_open_1', ids.own]) {
        expect(down.filter(press => press.key === key)).toHaveLength(1);
    }

    expectReadThrough(down, ids.tall);

    const up = await pressUntilStill(page, item, 'ArrowUp');
    expect(up.at(-1)?.view.scrollTop).toBe(0);
    expect(unique([down.at(-1)?.key, ...up.map(press => press.key)])).toEqual(stops.toReversed());
    expectReadThrough(up, ids.tall);
    expect(await scroller.evaluate(element => element.scrollTop)).toBe(0);
});

test('AC5: held ↓ scrolls at a steady pace, the cursor following a line set at its stop as the hold began, past each stop once the line has passed it, a tall comment after its whole height, and on to the last stop where the screen no longer scrolls', async ({
    page,
    github,
}) => {
    const { item, ids } = await openReadingThread(page, github);
    const scroller = await getScroller(item);
    const stops = await measureStops(scroller);
    const maxScroll = await scroller.evaluate(element => element.scrollHeight - element.clientHeight);

    const hold = await holdArrow(page, 'ArrowDown');
    // The press before the key repeats went on to the push's commit; the line starts at its top.
    const from = await getCursorKey(item);
    expect(from).toMatch(/^commit:/u);
    const start = await scroller.evaluate(element => element.scrollTop);
    const line = getBox(stops, from).top;

    const visited = [from];
    let last = { key: from, line };
    // Until the draft review's toolbar after its thread, the last stop.
    for (let repeat = 1; repeat < 200 && visited.at(-2) !== 'T_mine_0'; repeat++) {
        await hold.repeat();
        const travelled = repeat * REPEAT_TRAVEL;
        // The screen goes as far as the line, till the content's end.
        expect(await scroller.evaluate(element => element.scrollTop)).toBeCloseTo(
            Math.min(start + travelled, maxScroll),
            0,
        );
        const key = await getCursorKey(item);
        if (key === last.key) {
            last = { key, line: line + travelled };
            continue;
        }

        // Onto the next stop just as the line crossed into it: not before (no fixed line on the screen), and no more
        // than a repeat and a short tail after.
        const boundary = getBoundary(stops, last.key, key);
        expect(line + travelled).toBeGreaterThanOrEqual(boundary - 1);
        expect(last.line).toBeLessThan(boundary + SHORT_TAIL);
        visited.push(key);
        last = { key, line: line + travelled };
    }

    await page.keyboard.up('ArrowDown');
    expect(visited).toEqual([
        from,
        ids.plain,
        'R_hubot',
        'thread:T_open',
        'T_open_0',
        'T_open_1',
        'thread:T_open',
        expect.stringMatching(/^events:/u),
        ids.tall,
        ids.own,
        'draftReview',
        'thread:T_mine',
        'T_mine_0',
        'draftReview',
    ]);
    expect(await scroller.evaluate(element => element.scrollTop)).toBe(maxScroll);
});

test('AC5: a short hold over a tall comment scrolls it and keeps the cursor on it; released, nothing moves', async ({
    page,
    github,
}) => {
    const { item, ids } = await openReadingThread(page, github);
    const scroller = await getScroller(item);
    const scrollTop = () => scroller.evaluate(element => element.scrollTop);
    for (let press = 0; press < 5; press++) {
        await page.keyboard.press(']');
    }

    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', ids.tall);

    // The press before the repeats scrolls a step through it, the cursor staying.
    const hold = await holdArrow(page, 'ArrowDown');
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', ids.tall);
    const start = await scrollTop();
    for (let repeat = 1; repeat <= 20; repeat++) {
        await hold.repeat();
        expect(await scrollTop()).toBe(start + repeat * REPEAT_TRAVEL);
        expect(await getCursorKey(item)).toBe(ids.tall);
    }

    await page.keyboard.up('ArrowDown');
    const released = await scrollTop();
    await hold.wait(1000);
    expect(await scrollTop()).toBe(released);
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', ids.tall);
});

test('the pointer moving over a stop puts the cursor on it; content scrolling under a still pointer moves nothing; a scroll taking its stop off the top puts it on the stop at the top edge', async ({
    page,
    github,
}) => {
    const { item, ids } = await openReadingThread(page, github);
    const scroller = await getScroller(item);
    const plain = item.root.locator(`[data-reading-stop="${ids.plain}"]`);

    await pointAt(page, plain);
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', ids.plain);

    // A little, the pointer still: other content comes under it, the cursor stays on its stop, still on screen.
    await page.mouse.wheel(0, 60);
    await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await nextFrames(page);
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', ids.plain);

    // On until its stop is gone off the top: the cursor comes to the stop at the top edge.
    await page.mouse.wheel(0, 400);
    await expect(plain).not.toBeInViewport();
    await nextFrames(page);
    await expect.poll(async () => (await getCursorKey(item)) === (await getStopAtTop(scroller))).toBe(true);
    expect(await getCursorKey(item)).not.toBe(ids.plain);
});

test("on a code thread R opens its reply box and H resolves and unresolves it; on a comment R goes to the composer, . opens its menu with W and Q, Q quotes it and W edits the viewer's own", async ({
    page,
    github,
}) => {
    const { item, ids, writes } = await openReadingThread(page, github);
    const thread = item.root.getByRole('group', { name: 'Thread by sofiab on src/auth/redirect.ts' });

    for (let press = 0; press < 4; press++) {
        await page.keyboard.press(']');
    }

    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', 'T_open_1');
    await page.keyboard.press('r');
    const reply = thread.getByRole('textbox', { name: 'Reply' });
    await expect(reply).toBeFocused();
    await expect(item.commentBox).not.toBeFocused();
    await page.keyboard.press('Escape');
    await expect(reply).toBeHidden();

    await page.keyboard.press('h');
    const review = item.entry('One thing before it goes in.');
    await expect(review).toContainText('1 thread · 1 resolved');
    await expect(review).not.toContainText(ANSWER);
    await page.keyboard.press('h');
    await expect(thread.getByRole('button', { name: 'Resolve thread' })).toBeVisible();
    expect(writes).toEqual(['ResolveReviewThread', 'UnresolveReviewThread']);

    // A plain comment: R goes to the composer.
    await item.root.getByText(PLAIN).click();
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', ids.plain);
    await page.keyboard.press('r');
    await expect(item.commentBox).toBeFocused();

    // Its menu shows the keys that act on it; Escape closes it, and Q quotes it.
    await item.root.getByText(PLAIN).click();
    await page.keyboard.press('.');
    const menu = page.getByRole('menu', { name: 'Comment actions' });
    await expect(menu.getByRole('menuitem', { name: 'Edit' })).toHaveAttribute('aria-keyshortcuts', 'W');
    await expect(menu.getByRole('menuitem', { name: 'Quote reply' })).toHaveAttribute('aria-keyshortcuts', 'Q');
    await expect(menu.getByRole('menuitem', { name: 'Copy link' })).not.toHaveAttribute('aria-keyshortcuts');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    // Its ⋯ has the focus back first: a key pressed before that has its focus taken back by the closing menu.
    await expect(item.entry(PLAIN).getByRole('button', { name: 'Comment actions' })).toBeFocused();
    await page.keyboard.press('q');
    await expect(item.commentBox).toHaveValue(`> ${PLAIN}\n\n`);
    await expect(item.commentBox).toBeFocused();

    // The viewer's own comment: W opens its editor in place.
    await item.root.getByText(OWN).click();
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', ids.own);
    await page.keyboard.press('w');
    await expect(item.root.getByRole('textbox', { name: 'Edit comment' })).toHaveValue(OWN);
});

/** The node ids of the comments {@link openReadingThread} adds. */
interface ReadingThreadIds {
    readonly plain: string;
    readonly tall: string;
    readonly own: string;
}

/** {@link createReadingThread}'s pull request opened full screen from "my work"'s panel, the cursor on its description. */
async function openReadingThread(page: Page, github: GitHubMock) {
    const { item, ids, writes, myWork } = await createReadingThread(page, github);
    await myWork.row(PULL_REQUEST).click();
    await expect(item.title).toHaveText(PULL_REQUEST);
    await page.keyboard.press('Shift+Enter');
    await expect(item.backToPanelButton).toBeVisible();
    await expect(item.root.getByText(DRAFT)).toBeVisible();
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', 'description');
    return { item, ids, writes };
}

/**
 * The sample pull request with a stop of every kind, in this order: the description, its push, hubot's comment, hubot's
 * review with sofiab's code thread of two comments, monalisa's review request, monalisa's tall comment, the viewer's own
 * comment and the viewer's draft review; signed in on "my work", the pull request not opened yet. GitHub resolves and
 * unresolves as the real one does; `writes` names each mutation.
 */
async function createReadingThread(page: Page, github: GitHubMock) {
    const sample = createSampleEditableWork();
    const { world } = sample;
    const plain = world.comment(sample.pullRequest, { author: 'hubot', body: PLAIN, minutesAgo: 18 });
    world.review(sample.pullRequest, {
        id: 'R_hubot',
        author: 'hubot',
        state: 'CHANGES_REQUESTED',
        bodyHtml: '<p>One thing before it goes in.</p>',
        minutesAgo: 16,
    });
    world.pullRequestEvent(sample.pullRequest, {
        event: {
            __typename: 'ReviewRequestedEvent',
            actor: { login: 'monalisa', avatarUrl: '' },
            requestedReviewer: { login: 'hubot', avatarUrl: '' },
        },
        minutesAgo: 12,
    });
    const tall = world.comment(sample.pullRequest, { author: 'monalisa', body: TALL, minutesAgo: 10 });
    const own = world.comment(sample.pullRequest, {
        author: SAMPLE_VIEWER.viewer.login,
        body: OWN,
        minutesAgo: 8,
    });
    world.setPendingReview(sample.pullRequest, { comments: 1, minutesAgo: 5 });
    const { myWork } = await openMyWork(page, github, world);
    const threads: SampleReviewThread[] = [
        {
            id: 'T_open',
            path: 'src/auth/redirect.ts',
            line: 2,
            comments: [`<p>${QUESTION}</p>`, `<p>${ANSWER}</p>`],
            reviewId: 'R_hubot',
        },
        {
            id: 'T_mine',
            path: 'src/auth/session.ts',
            line: 4,
            comments: [`<p>${DRAFT}</p>`],
            pending: true,
            author: SAMPLE_VIEWER.viewer.login,
        },
    ];
    answerReview(github, { repository: 'acme/web', number: 15, id: sample.pullRequest, files: [], threads });
    const writes: string[] = [];
    for (const [name, field, isResolved] of [
        ['ResolveReviewThread', 'resolveReviewThread', true],
        ['UnresolveReviewThread', 'unresolveReviewThread', false],
    ] as const) {
        github.graphqlDocument(name, ({ variables }) => {
            writes.push(name);
            const at = threads.findIndex(thread => thread.id === variables.threadId);
            const thread = threads[at];
            if (thread) {
                threads[at] = {
                    ...thread,
                    isResolved,
                    resolvedBy: isResolved ? SAMPLE_VIEWER.viewer.login : undefined,
                };
            }

            return { data: { [field]: { thread: { id: variables.threadId } } } };
        });
    }

    const item = new ItemViewHarness(page);
    const ids: ReadingThreadIds = { plain, tall, own };
    return { item, ids, writes, myWork };
}

/** Opens the pull request's own page at `address`, waiting for its thread to be drawn with the cursor on it. */
async function openOnPage(item: ItemViewHarness, address: string) {
    await item.page.goto(address);
    await expect(item.title).toHaveText(PULL_REQUEST);
    await expect(item.root.getByText(DRAFT)).toBeVisible();
    await expect(item.readingCursor).toHaveCount(1);
}

/** What scrolls the thread: the two columns on a page this wide, else the one. */
async function getScroller(item: ItemViewHarness): Promise<Locator> {
    return (await item.columns.count()) > 0 ? item.columns : item.content;
}

/** The keys of the stops marked as under the cursor or around it (`aria-current="true"`), in document order. */
function getMarkedStops(item: ItemViewHarness): Promise<string[]> {
    return item.root
        .locator('[data-reading-stop][aria-current="true"]')
        .evaluateAll(stops => stops.map(stop => stop.getAttribute('data-reading-stop') ?? ''));
}

/** The key of the stop the cursor is on. */
async function getCursorKey(item: ItemViewHarness): Promise<string> {
    return (await item.readingCursor.getAttribute('data-reading-stop')) ?? '';
}

/** A code thread's card with its border in the accent, as the address's comment's (`Activity / Code thread · linked`). */
const LINKED_CLASS = /(?:^|\s)_itemThreadCodeThread_linked_/u;

/** `button` shows `key` after its label and says it as its shortcut. */
async function expectHint(button: Locator, key: string) {
    await expect(button).toHaveAttribute('aria-keyshortcuts', key);
    await expect(button.locator('kbd')).toBeVisible();
}

/** `button` shows no key. */
async function expectNoHint(button: Locator) {
    await expect(button).not.toHaveAttribute('aria-keyshortcuts');
    await expect(button.locator('kbd')).toHaveCount(0);
}

/** The scroller's height, how far it is scrolled and whether it can scroll further down. */
interface ScrollerView {
    readonly height: number;
    readonly scrollTop: number;
    readonly atEnd: boolean;
}

function getView(scroller: Locator): Promise<ScrollerView> {
    return scroller.evaluate(element => ({
        height: element.clientHeight,
        scrollTop: element.scrollTop,
        atEnd: element.scrollTop >= element.scrollHeight - element.clientHeight - 1,
    }));
}

/** A press of an arrow: the stop the cursor is on after it, and the scroller then. */
interface ArrowPress {
    readonly key: string;
    readonly view: ScrollerView;
    /** How far the press scrolled, down if positive. */
    readonly scrolled: number;
}

/**
 * Presses `arrow` until a press neither moves the cursor to another stop nor scrolls, checking that the cursor's stop
 * stays in sight after each; every press but that last one.
 */
async function pressUntilStill(
    page: Page,
    item: ItemViewHarness,
    arrow: 'ArrowDown' | 'ArrowUp',
): Promise<ArrowPress[]> {
    const scroller = await getScroller(item);
    const presses: ArrowPress[] = [];
    let key = await getCursorKey(item);
    let view = await getView(scroller);
    for (let count = 0; count < 100; count++) {
        await page.keyboard.press(arrow);
        await nextFrames(page);
        const next = await getCursorKey(item);
        const nextView = await getView(scroller);
        if (next === key && nextView.scrollTop === view.scrollTop) {
            return presses;
        }

        await expect(item.readingCursor).toBeInViewport();
        presses.push({ key: next, view: nextView, scrolled: nextView.scrollTop - view.scrollTop });
        key = next;
        view = nextView;
    }

    throw new Error(`${arrow} never came to a press that did nothing.`);
}

/**
 * The presses reading through the tall comment `key` scrolled it a quarter of what shows each, keeping the cursor on it,
 * the last of them no more than that; at least three of them.
 */
function expectReadThrough(presses: readonly ArrowPress[], key: string) {
    const steps = presses
        .filter((press, index) => press.key === key && presses[index - 1]?.key === key)
        .map(press => Math.abs(press.scrolled));
    expect(steps.length).toBeGreaterThanOrEqual(3);
    const height = presses[0]?.view.height ?? 0;
    for (const step of steps.slice(0, -1)) {
        // A quarter of the scroller, less the composer where it is docked over it.
        expect(step).toBeGreaterThan(height / 5);
        expect(step).toBeLessThanOrEqual(height / 4 + 1);
    }

    expect(steps.at(-1)).toBeLessThanOrEqual(height / 4 + 1);
}

/** A stop's box, from the scroller's content top. */
interface StopBox {
    readonly key: string;
    readonly top: number;
    readonly bottom: number;
}

/** Every stop of the thread, in document order. */
function measureStops(scroller: Locator): Promise<StopBox[]> {
    return scroller.evaluate(element => {
        const origin = element.getBoundingClientRect().top + element.clientTop - element.scrollTop;
        return [...element.querySelectorAll('[data-reading-stop]')].map(stop => {
            const box = stop.getBoundingClientRect();
            return {
                key: stop.getAttribute('data-reading-stop') ?? '',
                top: box.top - origin,
                bottom: box.bottom - origin,
            };
        });
    });
}

function getBox(stops: readonly StopBox[], key: string): StopBox {
    const box = stops.find(stop => stop.key === key);
    if (!box) {
        throw new Error(`No stop ${key}.`);
    }

    return box;
}

/**
 * Where the cursor going down hands over from stop `from` to stop `to`: the end of `from` when `to` holds it (the tail
 * of a card after the stops nested in it), else the start of `to`.
 */
function getBoundary(stops: readonly StopBox[], from: string, to: string): number {
    const was = getBox(stops, from);
    const next = getBox(stops, to);
    return next.top <= was.top && was.bottom <= next.bottom ? was.bottom : next.top;
}

/**
 * The stop the cursor comes to as a scroll down takes its own off the top: the innermost holding the top edge of what
 * shows, else the last starting above it.
 */
function getStopAtTop(scroller: Locator): Promise<string | null> {
    return scroller.evaluate(element => {
        const top = element.getBoundingClientRect().top + element.clientTop;
        let found: string | null = null;
        for (const stop of element.querySelectorAll('[data-reading-stop]')) {
            const box = stop.getBoundingClientRect();
            if (box.height > 0 && box.top <= top && (top < box.bottom || found === null)) {
                found = stop.getAttribute('data-reading-stop');
            }
        }

        return found;
    });
}

/** An arrow {@link holdArrow} holds down. */
interface HeldArrow {
    /** The key's next repeat, {@link KEY_REPEAT_MS} of the page's time after the last, drawn. */
    repeat(): Promise<void>;
    /** Lets `ms` of the page's time pass with no repeat, drawn. */
    wait(ms: number): Promise<void>;
}

/**
 * Holds `arrow` down as a keyboard does: a press, its first repeat {@link KEY_DELAY_MS} later, then one each
 * {@link KEY_REPEAT_MS} by `repeat`. The page's time is fixed and stepped by as much at each, however long the runner
 * takes between them, so the app sees a steady hold and scrolls by the time it measures, not the runner's.
 */
async function holdArrow(page: Page, arrow: 'ArrowDown' | 'ArrowUp'): Promise<HeldArrow> {
    let now = Date.now();
    await page.clock.setFixedTime(now);
    await page.keyboard.down(arrow);
    await nextFrames(page);
    await step(KEY_DELAY_MS);
    return {
        repeat: () => step(KEY_REPEAT_MS),
        wait: async ms => {
            now += ms;
            await page.clock.setFixedTime(now);
            await nextFrames(page);
        },
    };

    async function step(ms: number) {
        now += ms;
        await page.clock.setFixedTime(now);
        await page.keyboard.down(arrow);
        await nextFrames(page);
    }
}

/** Moves the pointer onto `target`'s middle, from off it, as a reader's hand does. */
async function pointAt(page: Page, target: Locator) {
    const box = await target.boundingBox();
    if (!box) {
        throw new Error('The stop is not on screen');
    }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
}

/** Two frames: what a key moved has been drawn and measured. */
function nextFrames(page: Page): Promise<unknown> {
    return page.evaluate(
        () =>
            new Promise(resolve => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            }),
    );
}

/** `values` with each run of the same value as one. */
function unique<T>(values: readonly T[]): T[] {
    return values.filter((value, index) => value !== values[index - 1]);
}
