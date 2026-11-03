import { assertValue } from '@nzyme/utils/assert.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { defineComponent, h } from 'vue';

import { MergeContext } from '@/merge/MergeContext.js';
import type { MergeRecord, PullRequestCommand } from '@/merge/MergeTypes.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

import {
    D1_ISSUE,
    D1_ISSUE_DETAIL,
    F1_CLOSES,
    F1_PULL_REQUEST,
    F1_PULL_REQUEST_DETAIL,
    F3_PULL_REQUEST,
    F3_PULL_REQUEST_DETAIL,
} from '@/testing/sampleItemDetails.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_CONTRIBUTOR_EDITING, SAMPLE_MAINTAINER_EDITING } from '@/testing/sampleRepositories.js';
import { GLYPHS_STACK, sampleStackDescription, SYNC_ENGINE_STACK } from '@/testing/sampleStacks.js';

import ItemView from './ItemView.vue';

const meta = {
    component: ItemView,
    args: {
        item: D1_ISSUE,
        detail: D1_ISSUE_DETAIL,
        arrangement: 'panel',
        position: { index: 6, count: 13 },
        closes: [],
        now: SAMPLE_NOW,
        loadAllComments: fn(() => Promise.resolve()),
        editing: SAMPLE_MAINTAINER_EDITING,
        onEdit: fn(),
        onNeedProjects: fn(),
        onClose: fn(),
        onPrevious: fn(),
        onNext: fn(),
        onArrange: fn(),
        onOpen: fn(),
        onOpenInPlace: fn(),
        onMerge: fn(),
    },
    // As tall as the window, and as wide as the arrangement: the panel's 560px, or the window.
    render: args => ({
        components: { ItemView },
        setup: () => ({ args }),
        template: `<div :style="{ height: '100vh', width: args.arrangement === 'panel' ? '560px' : '100%' }"><ItemView v-bind="args" /></div>`,
    }),
} satisfies Meta<typeof ItemView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** D1: an issue in the panel — properties with their keys, two projects with every field, the body, the latest comments. */
export const IssueInPanel: Story = {};

/** D2/D3: the same issue with a column at the side, as a modal and a page show it. */
export const IssueSplit: Story = { args: { arrangement: 'page' } };

/** F1: a pull request that can't merge yet — two checks failing, changes requested; the issue it closes. */
export const PullRequestFailing: Story = {
    args: {
        item: F1_PULL_REQUEST,
        detail: F1_PULL_REQUEST_DETAIL,
        closes: F1_CLOSES,
        position: { index: 3, count: 13 },
        // Read from the merge options: both failing checks are required (JKPLA).
        mergeChecks: F1_PULL_REQUEST_DETAIL.checks.map(check => ({
            ...check,
            isRequired: check.id === 'ci/test (node 20)' || check.id === 'ci/e2e (chromium)',
            appSlug: 'github-actions',
            workflowRunId: 1,
        })),
    },
};

/** F2: the same pull request on a page of its own: reviews at the top of the side column. */
export const PullRequestFailingPage: Story = {
    args: { ...PullRequestFailing.args, arrangement: 'page' },
};

/** F3: approved and ready — "Merge…" is the one prominent action. */
export const PullRequestReady: Story = {
    args: { item: F3_PULL_REQUEST, detail: F3_PULL_REQUEST_DETAIL, position: { index: 4, count: 13 } },
};

/** PM33: the same pull request being merged — GitHub accepted it, it reads open until GitHub says it is merged. */
export const PullRequestBeingMerged: Story = {
    args: {
        ...PullRequestReady.args,
        item: { ...F3_PULL_REQUEST, merging: 'SQUASH' },
        editing: {
            ...SAMPLE_MAINTAINER_EDITING,
            permissions: { ...SAMPLE_MAINTAINER_EDITING.permissions, merge: false },
        },
    },
};

/** PM38: in the merge queue — the verdict the panel says, "Queue…" opening the panel. */
export const PullRequestInQueue: Story = {
    args: {
        ...PullRequestReady.args,
        item: {
            ...F3_PULL_REQUEST,
            isMergeQueueEnabled: true,
            mergeQueueEntry: {
                position: 3,
                state: 'AWAITING_CHECKS',
                estimatedTimeToMerge: 12 * 60,
                enqueuedAt: '2026-11-03T00:00:00Z',
                enqueuer: 'mlaine',
            },
        },
    },
};

/** PM38: ready on a queue's branch — "Queue…" leads to adding it. */
export const PullRequestQueueReady: Story = {
    args: { ...PullRequestReady.args, item: { ...F3_PULL_REQUEST, isMergeQueueEnabled: true } },
};

/** PM38: auto-merge on — the verdict the panel says, "Auto-merge…" opening the panel. */
export const PullRequestAutoMergeOn: Story = {
    args: {
        ...PullRequestReady.args,
        item: {
            ...F3_PULL_REQUEST,
            autoMerge: {
                mergeMethod: 'SQUASH',
                enabledAt: new Date(Date.now() - 12 * 60_000).toISOString(),
                enabledBy: 'mlaine',
                commitHeadline: null,
            },
        },
    },
};

/** PM38: not met on a repository that allows auto-merge: "Auto-merge…", as the panel offers it. */
export const PullRequestAutoMergeOffered: Story = {
    args: {
        ...PullRequestReady.args,
        item: {
            ...F3_PULL_REQUEST,
            mergeStateStatus: 'BLOCKED',
            reviewDecision: 'REVIEW_REQUIRED',
            checks: { state: 'PENDING', passing: 7, failing: 0, pending: 2 },
        },
        editing: {
            ...SAMPLE_MAINTAINER_EDITING,
            metadata: SAMPLE_MAINTAINER_EDITING.metadata && {
                ...SAMPLE_MAINTAINER_EDITING.metadata,
                autoMergeAllowed: true,
            },
        },
    },
};

/**
 * PM38: approved, one check failing and one running that the base branch doesn't require — GitHub's status says the
 * requirements are met. Once the merge options are read, the standing says what the merge panel says: ready.
 */
export const PullRequestOptionalFailing: Story = {
    args: {
        ...PullRequestReady.args,
        item: {
            ...F3_PULL_REQUEST,
            mergeStateStatus: 'UNSTABLE',
            checks: { state: 'FAILURE', passing: 7, failing: 1, pending: 1 },
        },
        mergeChecks: F3_PULL_REQUEST_DETAIL.checks.map(check => ({
            ...check,
            ...(check.name === 'Vercel' ? { state: 'failing' as const } : {}),
            ...(check.name === 'docs' ? { state: 'pending' as const, completedAt: null } : {}),
            isRequired: check.name !== 'Vercel' && check.name !== 'docs',
            appSlug: 'github-actions',
            workflowRunId: 1,
        })),
    },
};

/** PM38: conflicts with its base — "Can't merge", and "Merge…" says the panel leads to GitHub's editor. */
export const PullRequestConflicts: Story = {
    args: {
        ...PullRequestReady.args,
        item: { ...F3_PULL_REQUEST, mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' },
    },
};

/**
 * PM22, PM38: GitHub still working out whether it merges — its merge state unknown while `mergeable` still reads the
 * last answer: the conflicts line says it is not known, as the merge panel does.
 */
export const PullRequestMergeabilityUnknown: Story = {
    args: {
        ...PullRequestReady.args,
        item: { ...F3_PULL_REQUEST, mergeable: 'MERGEABLE', mergeStateStatus: 'UNKNOWN' },
    },
};

/** PM38: behind its base, which requires being up to date — "Merge…" says the panel updates the branch. */
export const PullRequestBehind: Story = {
    args: { ...PullRequestReady.args, item: { ...F3_PULL_REQUEST, mergeStateStatus: 'BEHIND' } },
};

/** PM38: a draft — the conditions fold, and "Merge…" says the panel marks it ready first. */
export const PullRequestDraft: Story = {
    args: { ...PullRequestReady.args, item: { ...F3_PULL_REQUEST, isDraft: true, mergeStateStatus: 'DRAFT' } },
};

/** What the standing's buttons of the stories below ran. */
const commandRan = fn();

/** Under a screen whose pull request takes `commands` (merging D16). */
function withCommands(commands: readonly PullRequestCommand[]): Decorator {
    return story =>
        defineComponent({
            setup() {
                provideContext(MergeContext, {
                    canOpen: () => true,
                    open: () => undefined,
                    getRecord: () => null,
                    getCommands: () => commands,
                    run: (_id, command) => commandRan(command),
                });
                return () => h(story());
            },
        });
}

/** The standing's button `name` runs `command`, on its own: no panel opens. */
async function expectButtonRuns(name: RegExp, command: PullRequestCommand) {
    commandRan.mockClear();
    await userEvent.click(await within(document.body).findByRole('button', { name }));
    await expect(commandRan).toHaveBeenCalledWith(command);
}

/** PM38: behind — "Update branch" by its own key, `U`, with no panel. */
export const PullRequestBehindUpdates: Story = {
    ...PullRequestBehind,
    decorators: [
        withCommands([
            { kind: 'updateBranch', method: 'MERGE' },
            { kind: 'updateBranch', method: 'REBASE' },
        ]),
    ],
    play: () => expectButtonRuns(/^Update branch/u, { kind: 'updateBranch', method: 'MERGE' }),
};

/** PM26, PM38: merged — "Delete branch" in place of "Merge…". */
export const PullRequestMergedDeletes: Story = {
    args: {
        ...PullRequestReady.args,
        item: { ...F3_PULL_REQUEST, state: 'MERGED', merged: true, closedAt: F3_PULL_REQUEST.updatedAt },
    },
    decorators: [withCommands([{ kind: 'deleteBranch' }, { kind: 'revert' }])],
    play: () => expectButtonRuns(/^Delete branch/u, { kind: 'deleteBranch' }),
};

/** PM26b: its branch deleted — "Restore branch", by the same key. */
export const PullRequestMergedRestores: Story = {
    ...PullRequestMergedDeletes,
    decorators: [withCommands([{ kind: 'restoreBranch' }, { kind: 'revert' }])],
    play: () => expectButtonRuns(/^Restore branch/u, { kind: 'restoreBranch' }),
};

/** Under a screen that knows how the pull request's last merge ended (merging D15). */
function withMergeRecord(record: MergeRecord): Decorator {
    return story =>
        defineComponent({
            setup() {
                provideContext(MergeContext, {
                    canOpen: () => true,
                    open: () => undefined,
                    getRecord: () => record,
                    getCommands: () => [],
                    run: () => undefined,
                });
                return () => h(story());
            },
        });
}

/** PM38: a merge GitHub refused after the user moved on — "Merge refused" with GitHub's words, "Back to the merge". */
export const PullRequestMergeRefused: Story = {
    args: PullRequestReady.args,
    decorators: [
        withMergeRecord({
            kind: 'refused',
            sent: {
                request: { method: 'SQUASH', title: 'Edited' },
                edited: { title: 'Edited', body: '' },
                head: F3_PULL_REQUEST.headRefOid,
            },
            reason: { kind: 'refused', message: 'At least 2 approving reviews are required' },
            at: 0,
        }),
    ],
};

/** PM38: no answer in time — grey "Outcome not known yet", and the next refresh settles it. */
export const PullRequestOutcomeUnknown: Story = {
    args: PullRequestReady.args,
    decorators: [
        withMergeRecord({
            kind: 'unknown',
            sent: { request: { method: 'SQUASH' }, edited: null, head: F3_PULL_REQUEST.headRefOid },
            at: 0,
            accepted: true,
        }),
    ],
};

/** K1b: the ready pull request seen by a contributor — no "Merge…", one line says they can't. */
export const PullRequestContributorView: Story = {
    args: { ...PullRequestReady.args, editing: SAMPLE_CONTRIBUTOR_EDITING },
};

/** Opened before its detail arrived: the row's properties and the project "Status" show at once, comments load. */
export const LoadingComments: Story = { args: { detail: null, position: null } };

/** K1b: a contributor sees the labels, assignees and milestone as plain values — no keys — and one line says why. */
export const ContributorView: Story = { args: { editing: SAMPLE_CONTRIBUTOR_EDITING } };

/** Only shown: nothing is offered (an item of a session that ended). */
export const ReadOnly: Story = { args: { editing: null } };

/** SP30–SP36: the pull request at `index` of a sample stack opened, with F1's detail, the list's neighbours its own. */
function openedInStack(members: readonly PullRequestItem[], index: number) {
    const item = assertValue(members[index]);
    return {
        item,
        detail: { ...F1_PULL_REQUEST_DETAIL, id: item.id, item },
        closes: [],
        stack: sampleStackDescription(members),
        neighbours: { previous: members[index - 1]?.id ?? null, next: members[index + 1]?.id ?? null },
    };
}

/** SP30: the second of a stack of two in the panel — the map's rows pinned above the content. */
export const StackOfTwoInPanel: Story = {
    args: { ...openedInStack(GLYPHS_STACK, 1), position: { index: 10, count: 23 } },
};

/** SP31, SP32: the sixth of a stack of ten in the panel — a window of six; scrolled, the map folds to one line. */
export const StackOfTenInPanel: Story = {
    args: { ...openedInStack(SYNC_ENGINE_STACK, 5), position: { index: 13, count: 31 } },
};

/** SP33: the stack of two at the top of the modal's side column. */
export const StackOfTwoInModal: Story = { args: { ...StackOfTwoInPanel.args, arrangement: 'modal' } };

/** SP34: the stack of ten in the modal, whole. */
export const StackOfTenInModal: Story = { args: { ...StackOfTenInPanel.args, arrangement: 'modal' } };

/** SP35: the stack of two on a page — a column of its own on the left. */
export const StackOfTwoOnPage: Story = { args: { ...StackOfTwoInPanel.args, arrangement: 'page' } };

/** SP36: the stack of ten on a page, whole in the left column; the main column gives up its width. */
export const StackOfTenOnPage: Story = { args: { ...StackOfTenInPanel.args, arrangement: 'page' } };
