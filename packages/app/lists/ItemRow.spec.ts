import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { assertValue } from '@nzyme/utils/assert.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { MergeContext } from '@/merge/MergeContext.js';
import type { MergeRecord, SentMerge } from '@/merge/MergeTypes.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import { createFixedPhoneLayout } from '@/testing/createFixedPhoneLayout.js';
import { D1_ITEMS, SAMPLE_NOW, sampleUser } from '@/testing/sampleMyWork.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import { ITEM_PROPERTIES } from './ItemProperty.js';
import type { ItemProperty } from './ItemProperty.js';
import ItemRow from './ItemRow.vue';

/** Approved, every check passed: "approved · ready to merge". */
const READY = findPullRequest('PR_477');
/** Green checks, no review decision and nothing asked, with GitHub not yet saying it would merge. */
const HELD: PullRequestItem = { ...READY, reviewDecision: null, mergeStateStatus: 'BLOCKED', reviewRequests: [] };
/** GitHub would merge it with no review decision and no review asked: "ready to merge". */
const NO_REVIEW: PullRequestItem = { ...HELD, mergeStateStatus: 'CLEAN' };
const ASKED: PullRequestItem['reviewRequests'] = [{ kind: 'user', login: 'sapphi-red' }];
const MAY_MERGE: MergeContext = {
    canOpen: () => true,
    open: () => undefined,
    getRecord: () => null,
    getCommands: () => [],
    run: () => undefined,
};
/** A merge sent from the panel, with GitHub's text, naming the head the row shows. */
const SENT: SentMerge = { request: { method: 'SQUASH' }, edited: null, head: READY.headRefOid };
const DRAFT = { id: 'PRR_1', commentCount: 3, createdAt: '2026-11-01T10:00:00Z' };

test.each<{ name: string; item: Item; parent?: Item; lineOne: RegExp; lineTwo: RegExp }>([
    {
        name: 'a pull request: its number on line one, its repository alone on line two',
        item: READY,
        lineOne: /^Retry Stripe webhook delivery on 5xx\s*#477\s*\S+$/,
        lineTwo: /^skyline-labs\/api(?!.*#477)/,
    },
    {
        name: 'a pull request under an issue of its repository: line two starts with its status',
        item: findPullRequest('PR_1205'),
        parent: findItem('I_1187'),
        lineOne: /^Fix timezone offset for recurring bookings\s*#1205/,
        lineTwo: /^(?!.*skyline-labs)(?!.*#1205)checks running/,
    },
    {
        name: 'an issue: its reference stays on line two',
        item: findItem('I_1187'),
        lineOne: /^Calendar shows wrong timezone for recurring bookings(?!.*#)/,
        lineTwo: /^skyline-labs\/portal#1187/,
    },
])('$name', ({ item, parent, lineOne, lineTwo }) => {
    mount(item, null, { parent });

    const [one, two] = readLines();
    expect(one).toMatch(lineOne);
    expect(two).toMatch(lineTwo);
});

test('on a wide row the number, the people and the age follow the title 8px apart, none of them pushed to the far edge', () => {
    const host = mount({ ...READY, author: sampleUser('olam', '#7fb3d5') }, null);
    host.style.width = '1200px';

    const line = assertValue(document.querySelector('[class*="itemRow_line"]'));
    const parts = [...line.children].map(part => part.getBoundingClientRect());
    expect(parts).toHaveLength(4);
    for (const [index, part] of parts.slice(1).entries()) {
        expect(part.left - assertValue(parts[index]).right).toBeCloseTo(8, 0);
    }

    expect(assertValue(parts.at(-1)).right).toBeLessThan(line.getBoundingClientRect().right - 400);
});

test('beside an opened item (440px) the title gives way; the number, the people and the age stay whole', async () => {
    const title = 'Retry Stripe webhook delivery on 5xx with exponential backoff and a dead-letter queue for the rest';
    const host = mount({ ...READY, title, author: sampleUser('olam', '#7fb3d5') }, null);
    host.style.width = '440px';

    const titleElement = assertValue(document.querySelector('[class*="itemRow_title"]'));
    expect(titleElement.scrollWidth).toBeGreaterThan(titleElement.clientWidth);
    const lineRight = assertValue(document.querySelector('[class*="itemRow_line"]')).getBoundingClientRect().right;
    for (const shown of [
        page.getByText('#477', { exact: true }),
        page.getByRole('img', { name: 'olam' }),
        page.getByText('3h', { exact: true }),
    ]) {
        await expect.element(shown).toBeVisible();
        const element = shown.element();
        expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(lineRight);
        expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth);
    }
});

test('nested under its issue, a pull request is indented with a smaller icon, its title set as any other', () => {
    mount(READY, null);
    mount(findPullRequest('PR_1205'), null, { parent: findItem('I_1187') });

    const [top, nested] = document.querySelectorAll('[class*="itemRow_title"]');
    const [topStyle, nestedStyle] = [assertValue(top), assertValue(nested)].map(title => getComputedStyle(title));
    expect(pickTitleStyle(assertValue(nestedStyle))).toEqual(pickTitleStyle(assertValue(topStyle)));

    const [topIcon, nestedIcon] = page.getByRole('img', { name: 'Open pull request' }).elements();
    expect(assertValue(nestedIcon).getBoundingClientRect().width).toBeLessThan(
        assertValue(topIcon).getBoundingClientRect().width,
    );
    expect(assertValue(nestedIcon).getBoundingClientRect().left).toBeGreaterThan(
        assertValue(topIcon).getBoundingClientRect().left,
    );
});

const READY_ROWS = [
    { name: 'approved', ready: READY },
    { name: 'no review needed', ready: NO_REVIEW },
];

test.each(READY_ROWS)(
    'ready to merge ($name), a pull request the viewer may merge is followed by "Merge ⇧M", which opens the merge panel',
    async ({ ready }) => {
        const opened: string[] = [];
        mount(ready, {
            canOpen: id => id === ready.id,
            open: id => opened.push(id),
            getRecord: () => null,
            getCommands: () => [],
            run: () => undefined,
        });

        const merge = page.getByRole('button', { name: /^Merge/ });
        await expect.element(merge).toHaveAttribute('aria-keyshortcuts', 'Shift+M');
        await expect.element(page.getByRole('link', { name: /Open on GitHub/ })).not.toBeInTheDocument();
        await userEvent.click(merge);
        expect(opened).toEqual([ready.id]);
    },
);

test.each(READY_ROWS)(
    'ready to merge ($name) on a merge queue\'s branch, the row says what it does: "Add to queue ⇧M"',
    async ({ ready }) => {
        const queueBranch = { ...ready, isMergeQueueEnabled: true };
        mount(queueBranch, {
            canOpen: id => id === ready.id,
            open: () => undefined,
            getRecord: () => null,
            getCommands: () => [],
            run: () => undefined,
        });

        await expect.element(page.getByRole('button', { name: /^Add to queue/ })).toBeVisible();
    },
);

test.each(READY_ROWS)(
    'ready to merge ($name), one the viewer may not merge is followed by "Open on GitHub O"',
    async ({ ready }) => {
        mount(ready, {
            canOpen: () => false,
            open: () => undefined,
            getRecord: () => null,
            getCommands: () => [],
            run: () => undefined,
        });

        await expect
            .element(page.getByRole('link', { name: /Open on GitHub/ }))
            .toHaveAttribute('aria-keyshortcuts', 'O');
        await expect.element(page.getByRole('button', { name: /^Merge/ })).not.toBeInTheDocument();
    },
);

const RUNNING = { state: 'PENDING', passing: 1, failing: 0, pending: 1 } as const;
const FAILING = { state: 'FAILURE', passing: 1, failing: 2, pending: 0 } as const;
const AUTO_MERGE = { mergeMethod: 'SQUASH', enabledAt: null, enabledBy: 'mlaine', commitHeadline: null } as const;
const QUEUE_ENTRY = {
    position: 3,
    state: 'AWAITING_CHECKS',
    estimatedTimeToMerge: null,
    enqueuedAt: new Date(SAMPLE_NOW).toISOString(),
    enqueuer: 'mlaine',
} as const;

test.each<{ name: string; pr: PullRequestItem; reviewRequested?: boolean; says: readonly string[] }>([
    { name: 'being merged', pr: { ...READY, merging: 'SQUASH' }, says: ['Being merged · not merged yet'] },
    { name: 'in a merge queue', pr: { ...READY, mergeQueueEntry: QUEUE_ENTRY }, says: ['in queue · 3rd'] },
    { name: 'auto-merge on', pr: { ...READY, autoMerge: AUTO_MERGE }, says: ['auto-merge on · squash'] },
    { name: 'closed', pr: { ...READY, state: 'CLOSED' }, says: [] },
    { name: 'merged', pr: { ...READY, merged: true, state: 'MERGED', closedAt: null }, says: ['Merged'] },
    { name: 'failing checks', pr: { ...NO_REVIEW, checks: FAILING }, says: ['2 checks failing'] },
    { name: 'checks running, GitHub would merge', pr: { ...NO_REVIEW, checks: RUNNING }, says: ['checks running'] },
    {
        name: 'green, changes requested',
        pr: { ...HELD, reviewDecision: 'CHANGES_REQUESTED' },
        says: ['checks passed', 'changes requested'],
    },
    {
        name: 'green, approved with conflicts',
        pr: { ...READY, mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' },
        says: ['checks passed', 'conflicts'],
    },
    { name: 'approved, GitHub would merge', pr: READY, says: ['approved · ready to merge'] },
    { name: 'no review, green, GitHub would merge', pr: NO_REVIEW, says: ['ready to merge'] },
    { name: 'no review, no checks, GitHub would merge', pr: { ...NO_REVIEW, checks: null }, says: ['ready to merge'] },
    {
        name: 'approved, held, green',
        pr: { ...READY, mergeStateStatus: 'BLOCKED' },
        says: ['approved · checks passed'],
    },
    {
        name: 'approved, held, no checks',
        pr: { ...READY, mergeStateStatus: 'BLOCKED', checks: null },
        says: ['approved'],
    },
    {
        name: 'green, your review asked',
        pr: NO_REVIEW,
        reviewRequested: true,
        says: ['checks passed', 'your review requested'],
    },
    {
        name: 'green, a review asked with none required',
        pr: { ...NO_REVIEW, reviewRequests: ASKED },
        says: ['checks passed', 'waiting for review'],
    },
    {
        name: 'green, review required',
        pr: { ...HELD, reviewDecision: 'REVIEW_REQUIRED' },
        says: ['checks passed', 'waiting for review'],
    },
    { name: 'green, draft', pr: { ...NO_REVIEW, isDraft: true }, says: ['checks passed', 'draft'] },
    { name: 'green, blocked', pr: HELD, says: ['checks passed'] },
    { name: 'green, behind', pr: { ...HELD, mergeStateStatus: 'BEHIND' }, says: ['checks passed'] },
    { name: 'green, not known yet', pr: { ...HELD, mergeStateStatus: 'UNKNOWN' }, says: ['checks passed'] },
    {
        name: 'no checks, review required',
        pr: { ...HELD, reviewDecision: 'REVIEW_REQUIRED', checks: null },
        says: ['waiting for review'],
    },
    { name: 'no checks, blocked', pr: { ...HELD, checks: null }, says: [] },
])('line two, in order: $name', ({ pr, reviewRequested, says }) => {
    mount(pr, null, { reviewRequested });

    expect(readStatuses()).toEqual(says);
});

test('a review asked with no decision required offers no merge, although GitHub would merge it', async () => {
    mount({ ...NO_REVIEW, reviewRequests: ASKED }, MAY_MERGE);

    await expect.element(page.getByText('waiting for review')).toBeVisible();
    await expect.element(page.getByRole('button', { name: /^Merge/ })).not.toBeInTheDocument();
});

test('with the status off in Display, neither fact shows and nothing follows', async () => {
    const properties = ITEM_PROPERTIES.filter(property => property !== 'status');
    mount({ ...HELD, reviewDecision: 'REVIEW_REQUIRED' }, null, { properties });
    expect(readStatuses()).toEqual([]);

    mount(NO_REVIEW, MAY_MERGE, { properties });
    expect(readStatuses()).toEqual([]);
    await expect.element(page.getByRole('button', { name: /^Merge/ })).not.toBeInTheDocument();
});

test('with a draft review the row says so in place of its status, and stays as ready: "Merge" still follows, or "Open on GitHub"', async () => {
    mount(
        { ...READY, pendingReview: DRAFT },
        {
            canOpen: () => true,
            open: () => undefined,
            getRecord: () => null,
            getCommands: () => [],
            run: () => undefined,
        },
    );
    await expect.element(page.getByText('Your draft review · 3 comments unsent')).toBeVisible();
    await expect.element(page.getByText('approved · ready to merge')).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: /^Merge/ })).toBeVisible();
});

test('with a draft review on one the viewer may not merge, "Open on GitHub" still follows', async () => {
    mount(
        { ...READY, pendingReview: DRAFT },
        {
            canOpen: () => false,
            open: () => undefined,
            getRecord: () => null,
            getCommands: () => [],
            run: () => undefined,
        },
    );
    await expect.element(page.getByRole('link', { name: /Open on GitHub/ })).toBeVisible();
});

test('D21: a list showing no status still marks a draft review, and offers no merge; what else it would say stays hidden', async () => {
    mount({ ...READY, pendingReview: DRAFT }, null, { properties: [] });
    await expect.element(page.getByText('Your draft review · 3 comments unsent')).toBeVisible();
    await expect.element(page.getByRole('link', { name: /Open on GitHub/ })).not.toBeInTheDocument();

    mount({ ...READY, id: 'PR_other', title: 'Without a draft' }, null, { properties: [] });
    await expect.element(page.getByText('Without a draft')).toBeVisible();
    await expect.element(page.getByText('approved · ready to merge')).not.toBeInTheDocument();
});

test('PM37: being merged, the row says so where the status sits and keeps the open icon — never merged until GitHub says so', async () => {
    mount(
        { ...READY, merging: 'SQUASH' },
        {
            canOpen: () => false,
            open: () => undefined,
            getRecord: () => null,
            getCommands: () => [],
            run: () => undefined,
        },
    );

    await expect.element(page.getByText('Being merged · not merged yet')).toBeVisible();
    await expect.element(page.getByRole('img', { name: 'Open pull request' })).toBeVisible();
    await expect.element(page.getByRole('img', { name: 'Merged pull request' })).not.toBeInTheDocument();
    await expect.element(page.getByText('approved · ready to merge')).not.toBeInTheDocument();

    // Merged: purple, as a merged row reads, and since when.
    const closedAt = new Date(SAMPLE_NOW - 5 * 60_000).toISOString();
    mount({ ...READY, merged: true, state: 'MERGED', closedAt }, null);
    await expect.element(page.getByRole('img', { name: 'Merged pull request' })).toBeVisible();
    await expect.element(page.getByText('Merged · 5m')).toBeVisible();
});

test('PM37: a merge refused says so on line two, followed by "Back to the merge ⇧M" for the row\'s own pull request', async () => {
    const opened: string[] = [];
    const reason = { kind: 'refused', message: 'Rules.' } as const;
    const record: MergeRecord = { kind: 'refused', sent: SENT, reason, at: SAMPLE_NOW };
    mount(READY, {
        canOpen: () => true,
        open: id => opened.push(id),
        getRecord: () => record,
        getCommands: () => [],
        run: () => undefined,
    });

    await expect.element(page.getByText('Merge refused')).toBeVisible();
    expect(readStatuses()).toEqual(['Merge refused']);
    const back = page.getByRole('button', { name: /^Back to the merge/ });
    await expect.element(back).toHaveAttribute('aria-keyshortcuts', 'Shift+M');
    await userEvent.click(back);
    expect(opened).toEqual([READY.id]);
});

test('PM37: refused, with its head no longer the one the merge named, the row says nothing merged and a new commit', async () => {
    const reason = { kind: 'refused', message: 'Pull request head branch was modified.' } as const;
    const record: MergeRecord = { kind: 'refused', sent: SENT, reason, at: SAMPLE_NOW };
    mount(
        { ...READY, headRefOid: 'new-head' },
        {
            canOpen: () => true,
            open: () => undefined,
            getRecord: () => record,
            getCommands: () => [],
            run: () => undefined,
        },
    );

    await expect.element(page.getByText('Not merged · new commit')).toBeVisible();
    await expect.element(page.getByText('Merge refused')).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: /^Back to the merge/ })).toBeVisible();
});

test('PM36, PM37: no answer in time, the row is grey — neither merged nor refused — with nothing to send again', async () => {
    const record: MergeRecord = { kind: 'unknown', sent: SENT, at: SAMPLE_NOW, accepted: true };
    mount(READY, {
        canOpen: () => true,
        open: () => undefined,
        getRecord: () => record,
        getCommands: () => [],
        run: () => undefined,
    });

    await expect.element(page.getByText('Merge sent · outcome not known yet')).toBeVisible();
    await expect.element(page.getByRole('img', { name: 'Open pull request' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: /merge/i })).not.toBeInTheDocument();
});

/** The row of `item`, every property shown, under the screen's merging (none for `null`). */
test('PM37: in a merge queue, the row says where and how long, and offers no merge', async () => {
    const mergeQueueEntry = {
        position: 3,
        state: 'AWAITING_CHECKS',
        estimatedTimeToMerge: 12 * 60,
        enqueuedAt: new Date(SAMPLE_NOW).toISOString(),
        enqueuer: 'mlaine',
    } as const;
    mount(
        { ...READY, mergeQueueEntry },
        {
            canOpen: () => true,
            open: () => undefined,
            getRecord: () => null,
            getCommands: () => [],
            run: () => undefined,
        },
    );

    await expect.element(page.getByText('in queue · 3rd · about 12 min')).toBeVisible();
    await expect.element(page.getByRole('button', { name: /^Merge/ })).not.toBeInTheDocument();
});

test("PM37: in a merge queue GitHub says won't merge, the row says so", async () => {
    const mergeQueueEntry = {
        position: 2,
        state: 'UNMERGEABLE',
        estimatedTimeToMerge: null,
        enqueuedAt: new Date(SAMPLE_NOW).toISOString(),
        enqueuer: 'mlaine',
    } as const;
    mount({ ...READY, mergeQueueEntry }, null);

    await expect.element(page.getByText("in queue, won't merge · 2nd")).toBeVisible();
});

test('PM37: under auto-merge, the row says how and what it waits for, and offers no merge', async () => {
    const autoMerge = { mergeMethod: 'SQUASH', enabledAt: null, enabledBy: 'mlaine', commitHeadline: null } as const;
    const running = { state: 'PENDING', passing: 1, failing: 0, pending: 1 } as const;
    mount(
        { ...READY, autoMerge, checks: running },
        {
            canOpen: () => true,
            open: () => undefined,
            getRecord: () => null,
            getCommands: () => [],
            run: () => undefined,
        },
    );

    await expect.element(page.getByText('auto-merge on · squash · waiting for checks')).toBeVisible();
    await expect.element(page.getByRole('button', { name: /^Merge/ })).not.toBeInTheDocument();
});

/** What the lines of the rows say, top to bottom, normalised as {@link readStatuses}. */
function readLines() {
    return Array.from(document.querySelectorAll('[class*="itemRow_line"]'), line =>
        line.textContent.replaceAll(/\s+/g, ' ').trim(),
    );
}

/** What makes a title look as it does. */
function pickTitleStyle(style: CSSStyleDeclaration) {
    return { fontSize: style.fontSize, fontWeight: style.fontWeight, color: style.color };
}

/** What line two of the rows says, in order. */
function readStatuses() {
    return Array.from(document.querySelectorAll('[class*="itemStatus_text"]'), status =>
        // Normalised as `getByText` does: the translations glue short words with no-break spaces.
        status.textContent.replaceAll(/\s+/g, ' '),
    );
}

function mount(
    item: Item,
    merging: MergeContext | null,
    props: { reviewRequested?: boolean; properties?: readonly ItemProperty[]; parent?: Item } = {},
) {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    // The frame is narrower than a phone; these are the desktop's rows.
    container.set(PhoneLayout, createFixedPhoneLayout(false));
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({
        setup: () => {
            if (merging) {
                provideContext(MergeContext, merging);
            }

            return () =>
                h(ItemRow, {
                    item,
                    properties: ITEM_PROPERTIES,
                    viewerLogin: SAMPLE_VIEWER.login,
                    now: SAMPLE_NOW,
                    ...props,
                });
        },
    });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });
    return host;
}

function findPullRequest(id: string): PullRequestItem {
    const item = findItem(id);
    if (item.kind !== 'pullRequest') {
        throw new Error(`${id} is not a pull request`);
    }

    return item;
}

function findItem(id: string): Item {
    return assertValue(D1_ITEMS.find(candidate => candidate.id === id));
}
