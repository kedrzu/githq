import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { D1_ITEMS, D1_MEMBERSHIP, sampleMembership, SAMPLE_NOW, sampleMyWork } from '@/testing/sampleMyWork.js';
import {
    STACK_UNDER_ISSUE_ITEMS,
    STACK_UNDER_ISSUE_MEMBERSHIP,
    STACKED_MY_WORK_ITEMS,
    STACKED_MY_WORK_MEMBERSHIP,
    TWO_STACKS_UNDER_ISSUE_ITEMS,
    TWO_STACKS_UNDER_ISSUE_MEMBERSHIP,
} from '@/testing/sampleStacks.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import MyWorkView from './MyWorkView.vue';
import { MY_WORK_VIEW_DEFAULTS } from './myWorkViewOptions.js';

const meta = {
    component: MyWorkView,
    args: {
        work: sampleMyWork(D1_ITEMS, D1_MEMBERSHIP, 'all'),
        group: null,
        viewerLogin: SAMPLE_VIEWER.login,
        now: SAMPLE_NOW,
        waitingCount: 0,
        filter: 'all',
        selectedId: null,
        'onUpdate:filter': fn(),
        'onUpdate:selectedId': fn(),
    },
    // As tall as the window, like in the app.
    render: args => ({
        components: { MyWorkView },
        setup: () => ({ args }),
        template: '<div style="display: flex; height: 100vh"><MyWorkView v-bind="args" /></div>',
    }),
} satisfies Meta<typeof MyWorkView>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * D1: every group, every kind of row — a review asked, checks running, failing and sent back, approved and ready
 * ("Open on GitHub"), waiting for review, a draft; the project "Status" with "+1"; labels; a pull request nested
 * under the issue it closes, which is selected.
 */
export const AllGroups: Story = { args: { selectedId: 'I_1187' } };

/** "Needs me": reviews asked, my pull requests that need me, assigned issues; no mentions. */
export const NeedsMe: Story = { args: { filter: 'needsMe', work: sampleMyWork(D1_ITEMS, D1_MEMBERSHIP, 'needsMe') } };

/** Narrowed to one group from the sidebar. */
export const OneGroup: Story = { args: { group: 'authored' } };

/** K4: nothing on the user's plate, across the repositories they track — a good state. */
export const NothingOnYourPlate: Story = {
    args: {
        work: sampleMyWork([], sampleMembership({}), 'all'),
        trackedRepositories: ['kedrzu/githq', 'kedrzu/skills', 'skyline-labs/api', 'skyline-labs/portal'],
    },
};

/** K5: nothing needs the user, but two of their pull requests wait on others; the empty state points there. */
export const NothingNeedsYou: Story = {
    args: { filter: 'needsMe', work: sampleMyWork([], sampleMembership({}), 'needsMe'), waitingCount: 2 },
};

/** Nothing waits on others. */
export const NothingWaiting: Story = {
    args: { filter: 'waitingOnOthers', work: sampleMyWork([], sampleMembership({}), 'waitingOnOthers') },
};

/** ES12, D15: narrowed to a group in and empty: says what is shown, counts the rest and offers it. */
export const GroupEmpty: Story = {
    args: {
        group: 'mentioned',
        work: sampleMyWork(D1_ITEMS, { ...D1_MEMBERSHIP, mentioned: new Set() }, 'all'),
        onShowAll: fn(),
    },
    play: async ({ args, canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('heading', { name: /^Nothing\smentions\syou$/u })).toBeVisible();
        await expect(canvas.getByText(/Your\sother\s\d+\sitems\sare\sin\sMy\swork\.$/u)).toBeVisible();
        await expect(canvas.queryByText('Nothing here.')).toBeNull();
        await userEvent.click(canvas.getByRole('button', { name: /^Show\sall\sof\sMy\swork$/u }));
        await expect(args.onShowAll).toHaveBeenCalledOnce();
    },
};

/** The same on the board: no column standing for a group that says nothing else. */
export const GroupEmptyOnBoard: Story = {
    args: {
        ...GroupEmpty.args,
        options: { ...MY_WORK_VIEW_DEFAULTS, layout: 'board' },
    },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByRole('heading', { name: /^Nothing\smentions\syou$/u })).toBeVisible();
    },
};

/** D15 with nothing else in "my work": nothing to offer. */
export const GroupEmptyNothingElse: Story = {
    args: { group: 'assigned', work: sampleMyWork([], sampleMembership({}), 'all') },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('heading', { name: /^Nothing\sassigned\sto\syou$/u })).toBeVisible();
        await expect(canvas.queryByRole('button', { name: /^Show\sall\sof\sMy\swork$/u })).toBeNull();
    },
};

/** D15 while other groups still arrive: the rest is offered, not counted (D14). */
export const GroupEmptyOthersArriving: Story = {
    args: { group: 'mentioned', work: sampleMyWork([], { mentioned: new Set() }, 'all') },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('button', { name: /^Show\sall\sof\sMy\swork$/u })).toBeVisible();
        await expect(canvas.queryByText(/Your\sother/u)).toBeNull();
    },
};

/** ES11: the filter hides everything the narrowed group holds: it is named, and clearing it keeps the group. */
export const GroupHiddenByFilter: Story = {
    args: {
        group: 'mentioned',
        filter: 'needsMe',
        work: sampleMyWork([], sampleMembership({}), 'needsMe'),
        unfilteredCounts: { reviewRequested: 2, authored: 3, assigned: 5, mentioned: 3, total: 13 },
    },
    play: async ({ args, canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('heading', { name: /^Nothing\smatches\sthis\sfilter$/u })).toBeVisible();
        await expect(canvas.getByText(/^Needs\sme\shides\sall\s3\sitems\sin\sMentioned\.$/u)).toBeVisible();
        await userEvent.click(canvas.getByRole('button', { name: /^Clear\sfilter$/u }));
        await expect(args['onUpdate:filter']).toHaveBeenCalledWith('all');
    },
};

/** ES13: offline before anything arrived: why, instead of ghosts that would spin forever (D6). */
export const OfflineNothingArrived: Story = {
    args: { work: sampleMyWork([], {}, 'all'), cantBeRead: { kind: 'offline' } },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('heading', { name: "You're offline" })).toBeVisible();
        await expect(canvas.getByText(/your\swork\shasn't\sarrived\syet/u)).toBeVisible();
    },
};

/** D12: the allowance ran out before anything arrived: it says until when. */
export const PausedNothingArrived: Story = {
    args: { work: sampleMyWork([], {}, 'all'), cantBeRead: { kind: 'paused', until: SAMPLE_NOW + 600_000 } },
};

/** D12: GitHub fails before anything arrived: "Try again" asks at once. */
export const FailingNothingArrived: Story = {
    args: {
        work: sampleMyWork([], {}, 'all'),
        cantBeRead: { kind: 'failing', retry: fn(() => Promise.resolve()) },
    },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByRole('heading', { name: "GitHub isn't answering" })).toBeVisible();
    },
};

/** D6: with rows on screen the status bar alone tells it: what arrived stands, the rest keeps its ghosts. */
export const OfflineSomeArrived: Story = {
    args: {
        work: sampleMyWork(D1_ITEMS, { authored: D1_MEMBERSHIP.authored }, 'all'),
        cantBeRead: { kind: 'offline' },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.queryByRole('heading', { name: "You're offline" })).toBeNull();
        await expect(canvas.getByRole('region', { name: /^My\spull\srequests$/u })).toBeVisible();
    },
};

/** D6: nothing shown and offline with a group still on its way: the note, though another group is in and empty. */
export const OfflineArrivedEmpty: Story = {
    args: { work: sampleMyWork([], { authored: new Set() }, 'all'), cantBeRead: { kind: 'offline' } },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByRole('heading', { name: "You're offline" })).toBeVisible();
    },
};

/** D6: everything in, nothing there: a cause doesn't change what is known. */
export const OfflineNothingOnYourPlate: Story = {
    args: { work: sampleMyWork([], sampleMembership({}), 'all'), cantBeRead: { kind: 'offline' } },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByRole('heading', { name: /^Nothing\son\syour\splate$/u })).toBeVisible();
    },
};

/** G16: the first download is under way and no search has answered: a full screen of ghosts. */
export const StillArriving: Story = { args: { work: sampleMyWork([], {}, 'all') } };

/** G17: two searches have answered — their groups are listed and usable — and the other two show their ghosts. */
export const PartlyArrived: Story = {
    args: {
        work: sampleMyWork(
            D1_ITEMS,
            { reviewRequested: D1_MEMBERSHIP.reviewRequested, authored: D1_MEMBERSHIP.authored },
            'all',
        ),
    },
};

/** E2: three items selected together (`x`); an edit GitHub refused is said in its row for a moment. */
export const Selection: Story = {
    args: {
        selectedId: 'PR_15',
        checkedIds: ['PR_482', 'PR_1203', 'PR_15'],
        undone: new Map([['I_1187', '“regression” label undone']]),
    },
};

/** D9: my work as a board — a column per group, the pull request closing an assigned issue a smaller card under it. */
export const Board: Story = {
    args: { selectedId: 'I_1187', options: { ...MY_WORK_VIEW_DEFAULTS, layout: 'board' } },
};

/** D6: grouped by repository — the tracked ones in the sidebar's order, rows named by number, then the others. */
export const ByRepository: Story = {
    args: {
        selectedId: 'I_1187',
        trackedRepositories: ['kedrzu/githq', 'kedrzu/skills', 'skyline-labs/portal', 'skyline-labs/api'],
        options: { ...MY_WORK_VIEW_DEFAULTS, grouping: 'repository' },
    },
};

/**
 * SP1: stacks, each one entry in the first reason any of its pull requests has — someone else's asking the user's review
 * on two of its four ("Your review on 2 of 4"), the user's own with its third failing.
 */
export const Stacks: Story = {
    args: { work: sampleMyWork(STACKED_MY_WORK_ITEMS, STACKED_MY_WORK_MEMBERSHIP, 'all') },
};

/** SP26 in my work: each stack one card, whole, in the first reason any of its pull requests has (D3). */
export const StacksOnBoard: Story = {
    args: {
        work: sampleMyWork(STACKED_MY_WORK_ITEMS, STACKED_MY_WORK_MEMBERSHIP, 'all'),
        options: { ...MY_WORK_VIEW_DEFAULTS, layout: 'board' },
    },
};

/** Stacks grouped by repository: each entry whole in its repository's group. */
export const StacksByRepository: Story = {
    args: {
        work: sampleMyWork(STACKED_MY_WORK_ITEMS, STACKED_MY_WORK_MEMBERSHIP, 'all'),
        trackedRepositories: ['fitloop/webapp', 'fitloop/api'],
        options: { ...MY_WORK_VIEW_DEFAULTS, grouping: 'repository' },
    },
};

/**
 * SP21: the user's stack closing an assigned issue sits under it, whole, folded — the issue reads as any other with the
 * stack's chevron, pips and state added (stacked PRs D12). Enter on it opens the issue.
 */
export const StackUnderIssueFolded: Story = {
    args: { selectedId: 'I_12', work: sampleMyWork(STACK_UNDER_ISSUE_ITEMS, STACK_UNDER_ISSUE_MEMBERSHIP, 'all') },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(canvas.getByText('Background sync with conditional requests')).toBeVisible();
        await expect(canvas.getByRole('button', { name: 'Expand the stack' })).toBeVisible();
        await expect(canvas.queryByText('Sync: move the loop into a worker')).toBeNull();
    },
};

/** SP20: the same, expanded — the stack's pull requests are the issue's rows, on a rail; there is no third level. */
export const StackUnderIssue: Story = {
    args: StackUnderIssueFolded.args,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.click(canvas.getByRole('button', { name: 'Expand the stack' }));
        await expect(canvas.getByText('Sync: move the loop into a worker')).toBeVisible();
        await expect(canvas.getByText('Sync: pause when the allowance runs out')).toBeVisible();
    },
};

/**
 * SP22: two stacks under one issue — each gets a header of its own one step in, its rows on a rail below it; the first
 * expanded, the second folded (D23).
 */
export const TwoStacksUnderIssue: Story = {
    args: {
        selectedId: 'I_12',
        work: sampleMyWork(TWO_STACKS_UNDER_ISSUE_ITEMS, TWO_STACKS_UNDER_ISSUE_MEMBERSHIP, 'all'),
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const [first] = canvas.getAllByRole('button', { name: 'Expand the stack' });
        await userEvent.click(first ?? canvasElement);
        await expect(canvas.getByText('Sync: read conditional requests first')).toBeVisible();
        await expect(canvas.getByText('Fail over to the second provider')).toBeVisible();
        await expect(canvas.queryByText('Part 2 of S_failover')).toBeNull();
    },
};

/** D12 on the board: the stack's card a smaller card under the issue's, as a pull request closing it. */
export const StackUnderIssueOnBoard: Story = {
    args: {
        selectedId: 'I_12',
        work: sampleMyWork(STACK_UNDER_ISSUE_ITEMS, STACK_UNDER_ISSUE_MEMBERSHIP, 'all'),
        options: { ...MY_WORK_VIEW_DEFAULTS, layout: 'board' },
    },
};

/** CR33: the viewer's draft review in the row's second line, in place of its other state. */
export const DraftReview: Story = {
    args: {
        work: sampleMyWork(
            D1_ITEMS.map(item =>
                item.kind === 'pullRequest' && item.id === 'PR_477'
                    ? { ...item, pendingReview: { id: 'PRR_1', commentCount: 3, createdAt: '2026-11-01T10:00:00Z' } }
                    : item,
            ),
            D1_MEMBERSHIP,
            'all',
        ),
    },
};
