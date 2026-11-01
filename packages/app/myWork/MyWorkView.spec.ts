import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h, ref, shallowRef } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { ItemSort } from '@/lists/ItemSort.js';
import type { ListViewOptions } from '@/lists/ListTypes.js';
import type { MyWorkMembership } from '@/store/ItemStoreTypes.js';
import type { Item } from '@/store/ItemTypes.js';
import { D1_ITEMS, D1_MEMBERSHIP, SAMPLE_NOW, sampleMembership, sampleMyWork } from '@/testing/sampleMyWork.js';
import {
    STACK_UNDER_ISSUE_ITEMS,
    STACK_UNDER_ISSUE_MEMBERSHIP,
    STACKED_MY_WORK_ITEMS,
    STACKED_MY_WORK_MEMBERSHIP,
    TWO_STACKS_UNDER_ISSUE_ITEMS,
    TWO_STACKS_UNDER_ISSUE_MEMBERSHIP,
} from '@/testing/sampleStacks.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import type { MyWorkFilter } from './buildMyWork.js';
import { MY_WORK_VIEW_DEFAULTS } from './myWorkViewOptions.js';
import type { MyWorkGrouping } from './myWorkViewOptions.js';
import MyWorkView from './MyWorkView.vue';

// Mounted by hand rather than from a story: these tests change the list under the component, as a sync does.

test('K4: nothing on the plate names what was checked: the tracked repositories, or GitHub as a whole without any', async () => {
    const view = mount([], sampleMembership({}));
    const detail = page.getByText('No review requests, open pull requests', { exact: false });
    await expect.element(detail).toHaveTextContent(/anywhere on GitHub\.$/);

    view.trackedRepositories.value = ['kedrzu/githq', 'kedrzu/skills', 'skyline-labs/api', 'skyline-labs/portal'];
    await expect.element(detail).toHaveTextContent(/across your 4 tracked repositories\.$/);
});

test('j/k move the selection; a sync that reorders the list keeps it on its item, one that removes the item moves it to the neighbour', async () => {
    const view = mount(D1_ITEMS);

    // Review requested: #482, #1203; my pull requests: #15, …
    await userEvent.keyboard('jjj');
    await expect.poll(selectedTitle).toBe('IndexedDB store for issues and pull requests');
    await userEvent.keyboard('k');
    await expect.poll(selectedTitle).toBe('Migrate booking calendar to new date picker');

    // A sync: #1203 was updated (it moves to the top of its group) and a new review request arrives above it.
    view.sync(
        ['PR_new', 'PR_482', 'PR_1203'],
        [
            ...D1_ITEMS.map(item => (item.id === 'PR_1203' ? { ...item, updatedAt: '2026-10-30T11:59:00Z' } : item)),
            { ...findItem('PR_482'), id: 'PR_new', title: 'A new review request', updatedAt: '2026-10-30T11:59:30Z' },
        ],
    );
    await expect.poll(selectedTitle).toBe('Migrate booking calendar to new date picker');

    // The next sync: #1203 is gone. The selection goes to the row after it, not to the top.
    view.sync(['PR_new', 'PR_482']);
    await expect.poll(selectedTitle).toBe('Add rate-limit backoff to webhook worker');
});

test('the last row leaving hands the selection to the row before it', async () => {
    const view = mount(D1_ITEMS);

    // Past the end: the selection stops on the last row of "Mentioned".
    await userEvent.keyboard('j'.repeat(D1_ITEMS.length + 3));
    await expect.poll(selectedTitle).toBe('Offline queue for booking edits');

    view.sync(['PR_482', 'PR_1203'], view.items.value, { mentioned: ['I_463'] });
    await expect.poll(selectedTitle).toBe('Webhook signatures fail behind the new proxy');
});

test('collapsing the group of the selected row moves the selection to the next visible row', async () => {
    mount(D1_ITEMS);
    await userEvent.keyboard('jjj');
    await expect.poll(selectedTitle).toBe('IndexedDB store for issues and pull requests');

    await userEvent.click(page.getByRole('button', { name: 'My pull requests' }));
    await expect
        .element(page.getByRole('button', { name: 'My pull requests' }))
        .toHaveAttribute('aria-expanded', 'false');
    await expect.poll(selectedTitle).toBe('Calendar shows wrong timezone for recurring bookings');
});

test('"Open on GitHub" opens the pull request in a new tab without selecting its row', async () => {
    mount(D1_ITEMS);
    const opened: string[] = [];
    // The test page stays where it is: the link is followed only on paper.
    const follow = (event: MouseEvent) => {
        if (event.target instanceof Element) {
            const link = event.target.closest('a');
            if (link) {
                event.preventDefault();
                opened.push(`${link.href} ${link.target}`);
            }
        }
    };
    window.addEventListener('click', follow, { capture: true });
    onTestFinished(() => window.removeEventListener('click', follow, { capture: true }));

    const row = page.getByRole('listitem').filter({ hasText: 'Retry Stripe webhook delivery on 5xx' });
    await userEvent.click(row.getByRole('link', { name: 'Open on GitHub' }));

    expect(opened).toEqual([`${findItem('PR_477').url} _blank`]);
    expect(selectedTitle()).toBeNull();
});

test('D12: a row shows the first project\'s "Status" and "+N" for the others; without a "Status", the marker and "+N"', async () => {
    mount(D1_ITEMS);

    const withStatus = page.getByRole('listitem').filter({ hasText: 'Calendar shows wrong timezone' });
    await expect
        .element(withStatus.getByTitle('Platform Q4: In progress'))
        .toHaveTextContent(/^\s*In progress\s*\+1\s*$/);

    const withoutStatus = page.getByRole('listitem').filter({ hasText: 'Webhook signatures fail' });
    await expect.element(withoutStatus.getByTitle('Platform Q4 and Bug triage')).toHaveTextContent(/^\s*\+1\s*$/);
});

test('on the first download the groups arrive one by one: those that answered are usable, the others still arriving', async () => {
    const view = mount(D1_ITEMS, { reviewRequested: D1_MEMBERSHIP.reviewRequested });
    const pullRequests = page.getByRole('region', { name: 'My pull requests' });
    await expect.element(pullRequests).toHaveTextContent(/Still arriving/);
    await expect.element(page.getByRole('region', { name: 'Mentioned' })).toHaveTextContent(/Still arriving/);

    await userEvent.keyboard('j');
    await expect.poll(selectedTitle).toBe('Add rate-limit backoff to webhook worker');

    view.arrive({ authored: D1_MEMBERSHIP.authored });
    await expect.element(pullRequests).not.toHaveTextContent(/Still arriving/);
    await expect.element(pullRequests).toHaveTextContent(/IndexedDB store for issues and pull requests/);
    await expect.element(page.getByRole('region', { name: 'Mentioned' })).toHaveTextContent(/Still arriving/);
});

test('Enter or a click opens the selected item; while one is open, moving the selection opens the next in its place', async () => {
    const view = mount(D1_ITEMS);

    await userEvent.keyboard('j{Enter}');
    expect(view.opened).toEqual(['PR_482']);

    // Not open yet: moving only selects.
    await userEvent.keyboard('j');
    expect(view.opened).toEqual(['PR_482']);

    view.openedId.value = 'PR_1203';
    await userEvent.keyboard('j');
    await expect.poll(selectedTitle).toBe('IndexedDB store for issues and pull requests');
    expect(view.opened).toEqual(['PR_482', 'PR_15']);

    await userEvent.click(page.getByText('Command palette: jump to issue by number'));
    expect(view.opened).toEqual(['PR_482', 'PR_15', 'I_9']);
    await expect.poll(selectedTitle).toBe('Command palette: jump to issue by number');
});

test('x adds the row to the items edited together, ⇧↓ adds the next ones, Escape empties them', async () => {
    const view = mount(D1_ITEMS);
    const selection = page.getByTestId('selection');
    await expect.element(selection).not.toBeInTheDocument();

    await userEvent.keyboard('jx');
    await expect.element(selection).toHaveTextContent('PR_482');

    await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}');
    expect(view.checkedIds.value).toEqual(['PR_482', 'PR_1203', 'PR_15']);
    await expect.poll(selectedTitle).toBe('IndexedDB store for issues and pull requests');

    // x again takes the row out.
    await userEvent.keyboard('x');
    expect(view.checkedIds.value).toEqual(['PR_482', 'PR_1203']);

    // An item that leaves the list (closed) leaves the selection.
    view.sync(['PR_482']);
    await expect.element(selection).toHaveTextContent(/^PR_482$/);

    await userEvent.keyboard('{Escape}');
    await expect.element(selection).not.toBeInTheDocument();
});

test('Board: a column per group, the pull request under the issue it closes; ←/→ move between columns, ↓ within', async () => {
    mount(D1_ITEMS, D1_MEMBERSHIP, { layout: 'board' });

    const assigned = page.getByRole('region', { name: 'Assigned to me' });
    const cards = assigned.getByRole('listitem');
    await expect.element(cards.nth(0)).toHaveTextContent('Calendar shows wrong timezone for recurring bookings');
    await expect.element(cards.nth(1)).toHaveTextContent('Fix timezone offset for recurring bookings');

    await userEvent.keyboard('jj');
    await expect.poll(selectedText).toContain('Migrate booking calendar to new date picker');
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(selectedText).toContain('Retry Stripe webhook delivery on 5xx');
    // At the same height in "Assigned to me": the nested pull request is a stop of its own.
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(selectedText).toContain('Fix timezone offset for recurring bookings');
    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(selectedText).toContain('Background sync with conditional requests');
});

test('D22: grouped by repository — the tracked ones in order, rows named by number, then the others, not tracked', async () => {
    const view = mount(D1_ITEMS, D1_MEMBERSHIP, { grouping: 'repository' });
    view.trackedRepositories.value = ['kedrzu/githq', 'skyline-labs/portal', 'skyline-labs/api'];

    const sections = page.getByRole('region');
    await expect.element(sections.nth(0)).toHaveAccessibleName('kedrzu/githq');
    await expect.element(sections.nth(1)).toHaveAccessibleName('skyline-labs/portal');
    await expect.element(sections.nth(2)).toHaveAccessibleName('skyline-labs/api');
    await expect.element(sections.nth(3)).toHaveAccessibleName('Other repositories');
    expect(sections.elements()).toHaveLength(4);

    const api = page.getByRole('region', { name: 'skyline-labs/api' });
    // Reason order inside the group: the review asked first; it still says so.
    const review = api.getByRole('listitem').nth(0);
    await expect.element(review).toHaveTextContent('Add rate-limit backoff to webhook worker');
    await expect.element(review).toHaveTextContent('#482');
    await expect.element(review).not.toHaveTextContent('skyline-labs/api#482');
    await expect.element(review).toHaveTextContent(/your review requested/i);

    // The pull request closing an assigned issue stays nested under it.
    const portal = page.getByRole('region', { name: 'skyline-labs/portal' }).getByRole('listitem');
    await expect.element(portal.nth(1)).toHaveTextContent('Calendar shows wrong timezone for recurring bookings');
    await expect.element(portal.nth(2)).toHaveTextContent('Fix timezone offset for recurring bookings');

    const others = page.getByRole('region', { name: 'Other repositories' });
    await expect.element(others).toHaveTextContent('not tracked');
    await expect.element(others).toHaveTextContent('kedrzu/skills#31');
    await expect.element(others).toHaveTextContent('vitejs/vite#18842');
});

test('grouped by repository on the first download: what arrived is in its repositories, the reasons still arriving after them', async () => {
    const view = mount(D1_ITEMS, { reviewRequested: new Set(['PR_482']) }, { grouping: 'repository' });
    view.trackedRepositories.value = ['skyline-labs/api'];

    const sections = page.getByRole('region');
    await expect.element(sections.nth(0)).toHaveAccessibleName('skyline-labs/api');
    await expect.element(sections.nth(0)).toHaveTextContent(/Add rate-limit backoff to webhook worker/);
    await expect.element(page.getByRole('region', { name: 'My pull requests' })).toHaveTextContent(/Still arriving/);
    await expect.element(page.getByRole('region', { name: 'Mentioned' })).toHaveTextContent(/Still arriving/);
});

test('stacked PRs D3: a stack is one collapsed entry, its pull requests outside my work too', async () => {
    mount(STACKED_MY_WORK_ITEMS, STACKED_MY_WORK_MEMBERSHIP);

    const review = page.getByRole('region', { name: 'Review requested' }).getByRole('listitem');
    const entry = review.filter({ hasText: 'Retry webhooks with backoff' });
    await expect.element(entry).toHaveTextContent('Your review on 2 of 4');
    // Like my work's rows, it shows who opened its pull requests (SP1), not who they are assigned to.
    await expect.element(entry.getByRole('img', { name: 'sbrown' })).toBeInTheDocument();
    expect(review.elements()).toHaveLength(3);
    await expect.element(page.getByText('Part 4 of S_webhooks')).not.toBeInTheDocument();

    // Expanded, it shows all four — the two in no group of my work too; those asking the user's review say so.
    await userEvent.click(entry.getByRole('button', { name: 'Expand the stack' }));
    await expect.element(page.getByText('Part 4 of S_webhooks')).toBeInTheDocument();
    expect(review.elements()).toHaveLength(7);
    await expect
        .element(review.filter({ hasText: 'Part 2 of S_webhooks' }))
        .toHaveTextContent(/your review requested/i);
    await expect
        .element(review.filter({ hasText: 'Part 4 of S_webhooks' }))
        .not.toHaveTextContent(/your review requested/i);

    // The user's own stack shows no face: not theirs, nor those its pull requests are assigned to.
    const mine = page.getByRole('region', { name: 'My pull requests' });
    const own = mine.getByRole('listitem').filter({ hasText: 'Migrate class calendar to new date picker' });
    await expect.element(own).toBeInTheDocument();
    await expect.element(own.getByRole('img', { name: SAMPLE_VIEWER.login })).not.toBeInTheDocument();
    await expect.element(own.getByRole('img', { name: 'mlaine' })).not.toBeInTheDocument();
    await expect.element(mine.getByText('Part 2 of S_calendar')).not.toBeInTheDocument();
});

test('stacked PRs D3: on the board a stack is one card, whole, in the first reason any of its pull requests has; its column counts it once', async () => {
    // The fourth is found by a later group's search alone: it stays in the stack's card all the same.
    const membership = sampleMembership({
        reviewRequested: [...(STACKED_MY_WORK_MEMBERSHIP.reviewRequested ?? [])],
        authored: [...(STACKED_MY_WORK_MEMBERSHIP.authored ?? [])],
        assigned: [...(STACKED_MY_WORK_MEMBERSHIP.assigned ?? [])],
        mentioned: [...(STACKED_MY_WORK_MEMBERSHIP.mentioned ?? []), 'PR_S_webhooks_4'],
    });
    mount(STACKED_MY_WORK_ITEMS, membership, { layout: 'board' });

    const column = page.getByRole('region', { name: 'Review requested' });
    const review = column.getByRole('listitem');
    const card = review.filter({ hasText: 'Retry webhooks with backoff' });
    await expect.element(card).toHaveTextContent('Your review on 2 of 4');
    expect(review.elements()).toHaveLength(3);
    await expect.element(column.getByRole('heading')).toHaveTextContent(/3$/);
    await expect.element(page.getByText('Part 2 of S_webhooks')).not.toBeInTheDocument();

    const mentioned = page.getByRole('region', { name: 'Mentioned' });
    await expect.element(mentioned.getByText('Part 4 of S_webhooks')).not.toBeInTheDocument();

    // Expanded, the card lists all four inside it: still one card of its column.
    await userEvent.click(card.getByRole('button', { name: 'Expand the stack' }));
    await expect.element(card.getByText('Part 4 of S_webhooks')).toBeInTheDocument();
    expect(column.element().querySelectorAll('[data-entry-key]')).toHaveLength(3);
});

test('stacked PRs D12: my stack closing an assigned issue sits under it, whole; the issue takes its chevron, pips and state', async () => {
    const view = mount(STACK_UNDER_ISSUE_ITEMS, STACK_UNDER_ISSUE_MEMBERSHIP);

    const assigned = page.getByRole('region', { name: 'Assigned to me' });
    const issue = assigned.getByRole('listitem').filter({ hasText: 'Background sync with conditional requests' });
    await expect.element(issue).toHaveTextContent('2 of 3 ready, #31 blocks');
    // Nowhere else, and collapsed: "My pull requests" keeps its three rows, the issue none of the stack's.
    await expect.element(page.getByText('Sync: move the loop into a worker')).not.toBeInTheDocument();
    expect(page.getByRole('region', { name: 'My pull requests' }).getByRole('listitem').elements()).toHaveLength(3);
    await expect.element(assigned.getByRole('heading')).toHaveTextContent(/4$/);

    // → on the issue expands it; its rows are the stack's pull requests, number alone.
    view.selectedId.value = 'I_12';
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(issue.getByRole('button', { name: 'Collapse the stack' })).toBeInTheDocument();
    const member = assigned.getByRole('listitem').filter({ hasText: 'Sync: read conditional requests first' });
    await expect.element(member).toHaveTextContent('#30');
    expect(assigned.getByRole('listitem').elements()).toHaveLength(8);

    // Enter on the issue opens the issue, not a pull request.
    await userEvent.keyboard('{Enter}');
    expect(view.opened).toEqual(['I_12']);

    // ← on one of its rows collapses it and selects the issue.
    await userEvent.keyboard('j');
    await expect.poll(selectedTitle).toBe('Sync: move the loop into a worker');
    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(page.getByText('Sync: move the loop into a worker')).not.toBeInTheDocument();
    await expect.poll(selectedTitle).toBe('Background sync with conditional requests');
});

test('stacked PRs D23: with an item open, j walks from the issue into its folded stack one by one, k back into it at its last', async () => {
    const view = mount(STACK_UNDER_ISSUE_ITEMS, STACK_UNDER_ISSUE_MEMBERSHIP);
    view.selectedId.value = 'I_12';
    view.openedId.value = 'I_12';
    await expect.poll(selectedTitle).toBe('Background sync with conditional requests');

    await userEvent.keyboard('j');
    expect(view.opened).toEqual(['PR_S_sync_1']);
    view.openedId.value = 'PR_S_sync_1';
    await userEvent.keyboard('j');
    view.openedId.value = 'PR_S_sync_2';
    await userEvent.keyboard('j');
    view.openedId.value = 'PR_S_sync_3';
    expect(view.opened).toEqual(['PR_S_sync_1', 'PR_S_sync_2', 'PR_S_sync_3']);
    // The issue stays selected while its folded stack is walked.
    await expect.poll(selectedTitle).toBe('Background sync with conditional requests');

    await userEvent.keyboard('j');
    await expect.poll(selectedTitle).toBe('Command palette: jump to issue by number');
    view.openedId.value = 'I_9';
    await userEvent.keyboard('k');
    view.openedId.value = 'PR_S_sync_3';
    await userEvent.keyboard('k');
    view.openedId.value = 'PR_S_sync_2';
    await userEvent.keyboard('kk');
    expect(view.opened.slice(3)).toEqual(['I_9', 'PR_S_sync_3', 'PR_S_sync_2', 'PR_S_sync_1', 'I_12']);
});

test('stacked PRs D23: two stacks under one issue each get a header one step in, expanded on their own; Enter opens the stack', async () => {
    const view = mount(TWO_STACKS_UNDER_ISSUE_ITEMS, TWO_STACKS_UNDER_ISSUE_MEMBERSHIP);

    const assigned = page.getByRole('region', { name: 'Assigned to me' });
    const rows = assigned.getByRole('listitem');
    const issue = rows.filter({ hasText: 'Background sync with conditional requests' });
    await expect.element(issue.getByRole('button', { name: 'Expand the stack' })).not.toBeInTheDocument();
    await expect.element(issue).not.toHaveTextContent('ready');
    const sync = rows.filter({ hasText: 'Sync: move the loop into a worker' });
    const failover = rows.filter({ hasText: 'Fail over to the second provider' });
    await expect.element(sync).toHaveTextContent('2 of 3 ready, #31 blocks');
    await expect.element(failover).toBeInTheDocument();
    // The issue, its two headers, the other issues and the nested pull request of the first.
    expect(rows.elements()).toHaveLength(7);

    // → on a header expands its stack alone.
    view.selectedId.value = 'PR_S_sync_1';
    await expect.poll(selectedText).toContain('#31 blocks');
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(page.getByText('Sync: read conditional requests first')).toBeInTheDocument();
    await expect.element(page.getByText('Part 2 of S_failover')).not.toBeInTheDocument();
    expect(rows.elements()).toHaveLength(10);

    view.selectedId.value = 'PR_S_failover_1';
    await expect.poll(selectedText).toContain('Fail over to the second provider');
    await userEvent.keyboard('{Enter}');
    expect(view.opened).toEqual(['PR_S_failover_1']);
});

test('stacked PRs D12: on the board the stack is a card under the issue it closes', async () => {
    mount(STACK_UNDER_ISSUE_ITEMS, STACK_UNDER_ISSUE_MEMBERSHIP, { layout: 'board' });

    const column = page.getByRole('region', { name: 'Assigned to me' });
    const cards = column.getByRole('listitem');
    await expect.element(cards.nth(2)).toHaveTextContent('Background sync with conditional requests');
    await expect.element(cards.nth(3)).toHaveTextContent('2 of 3 ready, #31 blocks');
    await expect.element(column.getByRole('heading')).toHaveTextContent(/4$/);
});

/**
 * Mounts the view over `initial` and the groups of `arrived` (all of D1 by default), holding its filter and
 * selection like the page does.
 */
function mount(
    initial: readonly Item[],
    arrived: MyWorkMembership = D1_MEMBERSHIP,
    display: Partial<ListViewOptions<MyWorkGrouping, ItemSort>> = {},
) {
    const items = shallowRef<readonly Item[]>(initial);
    const membership = shallowRef(arrived);
    const filter = ref<MyWorkFilter>('all');
    const selectedId = ref<string | null>(null);
    const checkedIds = ref<readonly string[]>([]);
    const openedId = ref<string | null>(null);
    const trackedRepositories = shallowRef<readonly string[]>([]);
    const opened: string[] = [];

    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    const host = document.createElement('div');
    host.style.height = '100vh';
    host.style.display = 'flex';
    document.body.append(host);

    const app = createApp({
        setup: () => () =>
            h(
                MyWorkView,
                {
                    work: sampleMyWork(items.value, membership.value, filter.value),
                    viewerLogin: SAMPLE_VIEWER.login,
                    now: SAMPLE_NOW,
                    waitingCount: 0,
                    trackedRepositories: trackedRepositories.value,
                    filter: filter.value,
                    'onUpdate:filter': (value: MyWorkFilter) => {
                        filter.value = value;
                    },
                    selectedId: selectedId.value,
                    'onUpdate:selectedId': (value: string | null) => {
                        selectedId.value = value;
                    },
                    checkedIds: checkedIds.value,
                    'onUpdate:checkedIds': (value: readonly string[]) => {
                        checkedIds.value = value;
                    },
                    openedId: openedId.value,
                    options: { ...MY_WORK_VIEW_DEFAULTS, ...display },
                    onOpen: (id: string) => opened.push(id),
                },
                {
                    selection: ({ ids }: { ids: readonly string[] }) => h('p', { tid: 'selection' }, ids.join(' ')),
                },
            ),
    });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return {
        items,
        /** The selected item, as the page holds it. */
        selectedId,
        /** The items selected together. */
        checkedIds,
        /** The item opened over the list, as the page passes it. */
        openedId,
        /** The repositories the user tracks, in the sidebar's order. */
        trackedRepositories,
        /** The ids the view asked to open, in order. */
        opened,
        /** More groups' searches answer. */
        arrive(groups: MyWorkMembership) {
            membership.value = { ...membership.value, ...groups };
        },
        /** A sync: the review requests it found, the local copy after it, and what other groups it changed. */
        sync(reviewRequested: readonly string[], copy: readonly Item[] = items.value, others: SyncedGroups = {}) {
            items.value = copy;
            membership.value = {
                ...membership.value,
                reviewRequested: new Set(reviewRequested),
                ...(others.mentioned ? { mentioned: new Set(others.mentioned) } : {}),
            };
        },
    };
}

interface SyncedGroups {
    readonly mentioned?: readonly string[];
}

function findItem(id: string): Item {
    const item = D1_ITEMS.find(candidate => candidate.id === id);
    if (!item) {
        throw new Error(`No sample item ${id}`);
    }

    return item;
}

/** The title of the selected row, or `null`. */
function selectedTitle() {
    const row = document.querySelector('[aria-current="true"]');
    return row?.querySelector('span')?.textContent?.trim() ?? null;
}

/** The text of the selected row or card, or `null`. */
function selectedText() {
    return document.querySelector('[aria-current="true"]')?.textContent ?? null;
}
