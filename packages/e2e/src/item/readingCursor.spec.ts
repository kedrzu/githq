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
// beside a list they stay the list's.

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
/** How far a press of ↓ moves the cursor inside a stop: the line it stands for. */
const LINE = 40;
/** How often a held key repeats. */
const KEY_REPEAT_MS = 60;

test('AC1: ] puts the cursor on each comment in order, the review and each comment of its code thread too, never on a commit or an event; [ goes back; both stop at the ends', async ({
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

test('AC2: ↓ reaches every stop in order, commits and events too, a tall comment taking several presses; the screen scrolls only to keep the cursor out of the bottom third; held, it goes further a repeat late than early', async ({
    page,
    github,
}) => {
    const { item, ids } = await openReadingThread(page, github);
    const scroller = await getScroller(item);
    const stops = await getStops(item);
    expect(stops).toEqual([
        'description',
        expect.stringMatching(/^commit:/u),
        ids.plain,
        'R_hubot',
        'T_open_0',
        'T_open_1',
        expect.stringMatching(/^events:/u),
        ids.tall,
        ids.own,
        'draftReview',
        'T_mine_0',
    ]);

    const visited: string[] = ['description'];
    let tallPresses = 0;
    for (let press = 0; press < 200 && visited.at(-1) !== 'T_mine_0'; press++) {
        const before = await scroller.evaluate(element => element.scrollTop);
        await page.keyboard.press('ArrowDown');
        await nextFrames(page);
        const key = await getCursorKey(item);
        if (key === ids.tall) {
            tallPresses++;
        }

        // A parent's tail after its nested stops (the review's, after its code thread) holds the cursor again.
        if (visited.includes(key)) {
            continue;
        }

        visited.push(key);
        // Onto a new stop the cursor is at its top, a line tall. Unless there is no more to scroll, it never ends in the
        // bottom third, and a scroll goes only as far as keeps it out of there: one that scrolled left it at the edge.
        const view = await getView(scroller);
        const bandBottom = view.top + (view.height * 2) / 3;
        const box = await item.readingCursor.boundingBox();
        const line = (box?.y ?? Infinity) + LINE;
        if (!view.atEnd) {
            expect(line).toBeLessThanOrEqual(bandBottom + 2);
            if (view.scrollTop !== before) {
                expect(line).toBeGreaterThanOrEqual(bandBottom - 2);
            }
        }
    }

    expect(visited).toEqual(stops);
    expect(tallPresses).toBeGreaterThan(2);
    expect(await scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(0);

    // Held inside the tall comment once the screen follows it: each repeat early moves a line, late ones several.
    for (let press = 0; press < 3; press++) {
        await page.keyboard.press('[');
    }

    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', ids.tall);

    const scrollTop = () => scroller.evaluate(element => element.scrollTop);
    for (let press = 0; press < 40; press++) {
        const before = await scrollTop();
        await page.keyboard.press('ArrowDown');
        await nextFrames(page);
        if ((await scrollTop()) !== before) {
            break;
        }
    }

    // The page's time steps a key repeat's 60 ms at each one, however long the runner takes between them: a gap past the
    // app's hold window would make every repeat a new press.
    const heldFrom = Date.now();
    const travel: number[] = [];
    let last = await scrollTop();
    for (let repeat = 0; repeat < 14; repeat++) {
        await page.clock.setFixedTime(heldFrom + repeat * KEY_REPEAT_MS);
        await page.keyboard.down('ArrowDown');
        await nextFrames(page);
        const now = await scrollTop();
        travel.push(now - last);
        last = now;
    }

    await page.keyboard.up('ArrowDown');
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', ids.tall);
    const early = Math.max(...travel.slice(0, 3));
    const late = Math.max(...travel.slice(-4));
    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(early);
});

test('AC3: the pointer moving over a stop puts the cursor on it; content scrolling under a still pointer moves nothing; a scroll taking its stop off the top puts it on the stop at the top edge', async ({
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

    // On until its stop is gone off the top: the cursor comes to the first stop starting at the top edge.
    await page.mouse.wheel(0, 400);
    await expect(plain).not.toBeInViewport();
    await nextFrames(page);
    await expect.poll(async () => (await getCursorKey(item)) === (await getFirstStopAtTop(scroller))).toBe(true);
    expect(await getCursorKey(item)).not.toBe(ids.plain);
});

test("AC4: on a code thread R opens its reply box and H resolves and unresolves it; on a comment R goes to the composer, . opens its menu with W and Q, Q quotes it and W edits the viewer's own", async ({
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

/**
 * The sample pull request opened full screen with a stop of every kind, in this order: the description, its push,
 * hubot's comment, hubot's review with sofiab's code thread of two comments, monalisa's review request, monalisa's tall
 * comment, the viewer's own comment and the viewer's draft review. GitHub resolves and unresolves as the real one does;
 * `writes` names each mutation.
 */
async function openReadingThread(page: Page, github: GitHubMock) {
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
    await myWork.row(PULL_REQUEST).click();
    await expect(item.title).toHaveText(PULL_REQUEST);
    await page.keyboard.press('Shift+Enter');
    await expect(item.backToPanelButton).toBeVisible();
    await expect(item.root.getByText(DRAFT)).toBeVisible();
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', 'description');
    const ids: ReadingThreadIds = { plain, tall, own };
    return { item, ids, writes };
}

/** What scrolls the thread: the two columns on a page this wide, else the one. */
async function getScroller(item: ItemViewHarness): Promise<Locator> {
    return (await item.columns.count()) > 0 ? item.columns : item.content;
}

/** The thread's stops, by key, in document order. */
function getStops(item: ItemViewHarness): Promise<string[]> {
    return item.root
        .locator('[data-reading-stop]')
        .evaluateAll(stops => stops.map(stop => stop.getAttribute('data-reading-stop') ?? ''));
}

/** The key of the stop the cursor is on. */
async function getCursorKey(item: ItemViewHarness): Promise<string> {
    return (await item.readingCursor.getAttribute('data-reading-stop')) ?? '';
}

/** The scroller's box on the page, how far it is scrolled and whether it can scroll further down. */
interface ScrollerView {
    readonly top: number;
    readonly height: number;
    readonly scrollTop: number;
    readonly atEnd: boolean;
}

function getView(scroller: Locator): Promise<ScrollerView> {
    return scroller.evaluate(element => ({
        top: element.getBoundingClientRect().top + element.clientTop,
        height: element.clientHeight,
        scrollTop: element.scrollTop,
        atEnd: element.scrollTop >= element.scrollHeight - element.clientHeight - 1,
    }));
}

/** The first stop, in document order, starting in what the scroller shows: where a scroll down leaves the cursor. */
function getFirstStopAtTop(scroller: Locator): Promise<string | null> {
    return scroller.evaluate(element => {
        const top = element.getBoundingClientRect().top + element.clientTop;
        const bottom = top + element.clientHeight;
        for (const stop of element.querySelectorAll('[data-reading-stop]')) {
            const box = stop.getBoundingClientRect();
            if (box.height > 0 && box.top >= top && box.top < bottom) {
                return stop.getAttribute('data-reading-stop');
            }
        }

        return null;
    });
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
