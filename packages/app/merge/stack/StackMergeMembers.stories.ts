import { assertValue } from '@nzyme/utils/assert.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';

import type { PullRequestItem } from '@/store/ItemTypes.js';
import type { StackPullRequestPipKind } from '@/store/stacks/describeStack.js';
import { sampleStack } from '@/testing/sampleStacks.js';

import StackMergeMembers from './StackMergeMembers.vue';
import type { StackMergeRow, StackMergeRowState } from './StackMergeTypes.js';

const STACK = sampleStack({
    id: 'S_calendar',
    number: 1203,
    members: [
        { title: 'Swap the date picker component' },
        { title: 'Move recurring rules to the new picker' },
        { title: 'Timezones in the picker' },
    ],
});

const QUEUE_ENTRY = {
    position: 2,
    state: 'AWAITING_CHECKS',
    estimatedTimeToMerge: 12 * 60,
    enqueuedAt: '2026-11-03T00:00:00Z',
    enqueuer: 'mlaine',
} as const;
const FAILING = { state: 'FAILURE', passing: 3, failing: 2, pending: 0 } as const;
const RUNNING = { state: 'PENDING', passing: 3, failing: 0, pending: 1 } as const;

const meta = {
    component: StackMergeMembers,
    args: { rows: [], line: null },
} satisfies Meta<typeof StackMergeMembers>;

export default meta;

type Story = StoryObj<typeof meta>;

/** SP40: every one going, ready, the mark of landing on each. */
export const Going: Story = {
    args: { rows: [going(0, ownState('ready')), going(1, ownState('ready')), going(2, ownState('ready'))] },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getAllByText('lands')).toHaveLength(3);
    },
};

/** Each pull request's own state, in the words of a stack's map. */
export const OwnStates: Story = {
    args: {
        rows: [
            own('ready'),
            own('merged', { state: 'MERGED', merged: true }),
            own('closed', { state: 'CLOSED' }),
            own('draft', { isDraft: true }),
            own('broken', { checks: FAILING }),
            own('broken', { reviewDecision: 'CHANGES_REQUESTED' }),
            own('broken', { mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' }),
            own('moving', { checks: RUNNING }),
            own('moving'),
            own('waiting', { reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BLOCKED' }),
            own('waiting', { mergeStateStatus: 'BLOCKED' }),
        ],
    },
};

/** SP41: the line put after the first, those below it dimmed, staying open. */
export const StaysOpen: Story = {
    args: {
        line: 'stops',
        rows: [going(0, ownState('ready')), below(1, { kind: 'staysOpen' }), below(2, { kind: 'staysOpen' })],
    },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('Stops here')).toBeVisible();
    },
};

/** SP45: the line at the last that can land, the one holding the rest failing, those after it blocked. */
export const Blocked: Story = {
    args: {
        line: 'held',
        rows: [
            going(0, ownState('ready')),
            below(1, ownState('broken'), { checks: FAILING }),
            below(2, { kind: 'blocked' }),
        ],
    },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('Can go up to here')).toBeVisible();
    },
};

/** SP48: green itself, held by an earlier one. */
export const HeldBy: Story = {
    args: {
        line: 'held',
        rows: [
            going(0, ownState('ready')),
            below(1, ownState('closed'), { state: 'CLOSED' }),
            below(2, { kind: 'heldBy', number: 1204 }),
        ],
    },
};

/** SP58: the first landed, GitHub checking those left. */
export const FreshChecks: Story = {
    args: {
        rows: [
            own('merged', { state: 'MERGED', merged: true }),
            going(1, { kind: 'freshChecks' }),
            going(2, { kind: 'freshChecks' }),
        ],
    },
};

/** SP56: every one going is being merged, the spinning icon saying it. */
export const BeingMerged: Story = {
    args: { rows: [going(0, { kind: 'merging' }), going(1, { kind: 'merging' }), going(2, { kind: 'merging' })] },
};

/** SP50: places the copy does not hold yet, one row each run. */
export const Missing: Story = {
    args: { rows: [own('waiting'), { kind: 'missing', count: 2 }] },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('2 more not in githq yet')).toBeVisible();
    },
};

/** SP54: in the merge queue, each with a position of its own, as GitHub holds it. */
export const Queued: Story = {
    args: {
        rows: [
            going(0, { kind: 'queued', entry: QUEUE_ENTRY }),
            going(1, { kind: 'queued', entry: { ...QUEUE_ENTRY, position: 3 } }),
        ],
    },
    play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText('2nd · waiting for checks · about 12 min')).toBeVisible();
        await expect(within(canvasElement).getByText('3rd · waiting for checks · about 12 min')).toBeVisible();
    },
};

function ownState(pip: StackPullRequestPipKind): StackMergeRowState {
    return { kind: 'own', pip };
}

/** The first pull request in its own state, with what it differs in: it says that, nothing else. */
function own(pip: StackPullRequestPipKind, changes: Partial<PullRequestItem> = {}): StackMergeRow {
    return {
        kind: 'pullRequest',
        pullRequest: pullRequest(0, changes),
        state: ownState(pip),
        going: false,
        dimmed: false,
    };
}

/** The pull request at `index`, landing with the merge. */
function going(index: number, state: StackMergeRowState): StackMergeRow {
    return { kind: 'pullRequest', pullRequest: pullRequest(index), state, going: true, dimmed: false };
}

/** The pull request at `index` below the line, dimmed. */
function below(index: number, state: StackMergeRowState, changes: Partial<PullRequestItem> = {}): StackMergeRow {
    return { kind: 'pullRequest', pullRequest: pullRequest(index, changes), state, going: false, dimmed: true };
}

function pullRequest(index: number, changes: Partial<PullRequestItem> = {}): PullRequestItem {
    return { ...assertValue(STACK[index]), ...changes };
}
