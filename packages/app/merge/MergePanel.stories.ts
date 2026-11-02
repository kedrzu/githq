import { assertNever } from '@nzyme/utils/assertNever.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, screen, userEvent, waitFor } from 'storybook/test';
import { defineComponent, h, ref, shallowRef } from 'vue';
import type { PropType } from 'vue';

import type { EditFailureReason } from '@/edits/EditTypes.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import { samplePullRequest } from '@/testing/sampleItems.js';
import { SAMPLE_PASSED_CHECKS } from '@/testing/sampleMergeChecks.js';

import type { MergeSettings } from './getMergeMethods.js';
import MergePanel from './MergePanel.vue';
import type { MergeOptions, MergeRequest } from './MergeTypes.js';

/** When the stories happen: a running check's time is counted to it. */
const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);

const PR: PullRequestItem = {
    ...samplePullRequest('PR_477'),
    url: 'https://github.com/fitloop/api/pull/477',
    number: 477,
    title: 'Retry Stripe webhook delivery on 5xx',
    repository: { nameWithOwner: 'fitloop/api', owner: 'fitloop', isPrivate: true, viewerPermission: 'WRITE' },
    headRefName: 'retry-stripe-5xx',
    reviewDecision: 'APPROVED',
    checks: { state: 'SUCCESS', passing: 9, failing: 0, pending: 0 },
};

const ALL_METHODS: MergeSettings = {
    mergeCommitAllowed: true,
    squashMergeAllowed: true,
    rebaseMergeAllowed: true,
    viewerDefaultMergeMethod: 'SQUASH',
};

const SQUASH_ONLY: MergeSettings = { ...ALL_METHODS, mergeCommitAllowed: false, rebaseMergeAllowed: false };

/** A pull request description as long as ours are: 38 lines. */
const SQUASH_BODY = [
    'Fixes #468. Stripe retries a failed delivery for three days, but the worker',
    'answered 200 before the event was stored, so a crash lost it for good.',
    'Now it answers 500 until the event is committed, and Stripe tries again.',
    '',
    '## What changes',
    ...Array.from({ length: 33 }, (_, index) => `- Step ${index + 1} of the retry, described at length.`),
].join('\n');

const OPTIONS: MergeOptions = {
    status: PR,
    proposedTexts: {
        SQUASH: { title: 'Retry Stripe webhook delivery on 5xx (#477)', body: SQUASH_BODY },
        MERGE: {
            title: 'Merge pull request #477 from fitloop/retry-stripe-5xx',
            body: 'Retry Stripe webhook delivery on 5xx',
        },
    },
    allowedMergeMethods: null,
    requiresLinearHistory: false,
    viewerCanMergeAsAdmin: false,
    viewerCanEnableAutoMerge: false,
    isMergeQueueEnabled: false,
    checks: SAMPLE_PASSED_CHECKS,
};

/**
 * What GitHub answers the panel's merge with, in the harness: `pending` is no answer yet — the pull request drawn as
 * being merged meanwhile, as the merge's optimistic layer draws it — and `offline` none at all.
 */
type HarnessAnswer = 'accepted' | 'offline' | 'pending' | 'refused';

/**
 * The panel as the app drives it: the merges it asks for are written out under it (`sent`), GitHub answers at once
 * (`answer`: accepted closes it, refused keeps it with the reason), and with `readLater` the panel's read is on its
 * way until the hidden `arrive` button is clicked.
 */
const Harness = defineComponent({
    props: {
        pr: { type: Object as PropType<PullRequestItem>, default: () => PR },
        settings: { type: Object as PropType<MergeSettings | null>, default: () => ALL_METHODS },
        options: { type: Object as PropType<MergeOptions | null>, default: () => OPTIONS },
        readLater: { type: Boolean, default: false },
        refusal: { type: Object as PropType<EditFailureReason | null>, default: null },
        answer: { type: String as PropType<HarnessAnswer>, default: 'accepted' },
        allowed: { type: Boolean, default: true },
    },
    setup(props) {
        const open = ref(true);
        const arrived = ref(!props.readLater);
        const sent = ref('Nothing sent');
        const refusal = shallowRef<EditFailureReason | null>(props.refusal);
        const sending = ref(false);

        return () =>
            h('div', { style: { padding: '16px' } }, [
                h('p', [h('span', { tid: 'sent' }, sent.value)]),
                h(
                    'button',
                    { type: 'button', tid: 'arrive', hidden: true, onClick: () => (arrived.value = true) },
                    "The panel's read arrives",
                ),
                h(MergePanel, {
                    open: open.value,
                    'onUpdate:open': (value: boolean) => (open.value = value),
                    pr: sending.value ? { ...props.pr, merging: 'SQUASH' } : props.pr,
                    settings: props.settings,
                    options: arrived.value ? props.options : null,
                    reading: !arrived.value,
                    allowed: props.allowed,
                    sending: sending.value,
                    refusal: refusal.value,
                    now: NOW,
                    onMerge: (request: MergeRequest) => {
                        sent.value = JSON.stringify(request);
                        switch (props.answer) {
                            case 'accepted':
                                open.value = false;
                                break;
                            case 'pending':
                                sending.value = true;
                                break;
                            case 'refused':
                                refusal.value = { kind: 'refused', message: 'Repository rule violations found' };
                                break;
                            case 'offline':
                                refusal.value = { kind: 'offline' };
                                break;
                            default:
                                assertNever(props.answer);
                        }
                    },
                }),
            ]);
    },
});

const meta = {
    component: Harness,
    args: {},
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

/** PM5: ready, several methods — Squash, the repository's default, chosen; GitHub's text in three lines. */
export const Ready: Story = {};

/** PM4a: the only method the base branch allows, and only checks that aren't required still running. */
export const OnlyOptionalRunning: Story = {
    args: {
        settings: SQUASH_ONLY,
        options: {
            ...OPTIONS,
            checks: SAMPLE_PASSED_CHECKS.map((check, index) =>
                index >= 7 ? { ...check, state: 'pending', completedAt: null } : check,
            ),
        },
    },
};

/** PM7: rebase chosen — no commit text, the panel shrinks. */
export const Rebase: Story = { args: { settings: { ...ALL_METHODS, viewerDefaultMergeMethod: 'REBASE' } } };

/** PM8: being read — opens at once from the row; ⌘↵ already works. */
export const BeingRead: Story = { args: { readLater: true } };

/**
 * PM9: changed under the eyes — the panel starts on Merge commit, the viewer's default; the read brings a ruleset
 * on main that allows only squash and rebase.
 */
export const MethodGone: Story = {
    args: {
        readLater: true,
        settings: { ...ALL_METHODS, viewerDefaultMergeMethod: 'MERGE' },
        options: { ...OPTIONS, allowedMergeMethods: ['SQUASH', 'REBASE'] },
    },
};

/** PM4a: a required check failed — red, the required one tagged and first; the primary is off. */
export const RequiredFailed: Story = {
    args: {
        pr: { ...PR, mergeStateStatus: 'BLOCKED', checks: { state: 'FAILURE', passing: 7, failing: 2, pending: 0 } },
        options: {
            ...OPTIONS,
            checks: SAMPLE_PASSED_CHECKS.map(check => {
                switch (check.name) {
                    case 'test (node 20)':
                        return { ...check, state: 'failing' };
                    case 'preview':
                        return { ...check, state: 'failing', completedAt: '2026-11-02T11:55:48Z' };
                    default:
                        return check;
                }
            }),
        },
    },
};

/** PM4a: required checks still running — amber "Can't merge yet", how long each has run. */
export const RequiredRunning: Story = {
    args: {
        pr: { ...PR, mergeStateStatus: 'BLOCKED', checks: { state: 'PENDING', passing: 6, failing: 0, pending: 3 } },
        options: {
            ...OPTIONS,
            checks: SAMPLE_PASSED_CHECKS.map(check => {
                switch (check.name) {
                    case 'test (node 20)':
                        return { ...check, state: 'pending', startedAt: '2026-11-02T11:56:48Z', completedAt: null };
                    case 'e2e (chromium)':
                        return { ...check, state: 'pending', startedAt: null, completedAt: null };
                    case 'preview':
                        return { ...check, state: 'pending', startedAt: '2026-11-02T11:58:55Z', completedAt: null };
                    default:
                        return check;
                }
            }),
        },
    },
};

/** PM4a: the full list open (`C`) — Required, then Others, the failed one that isn't required saying so. */
export const ChecksOpen: Story = {
    args: RequiredFailed.args,
    play: async () => {
        await openPanelKey('c');
        await expect(await screen.findByText('Required · 5')).toBeVisible();
    },
};

/** PM3d: the commit text edited (`E`) — a title and the message, its long text scrolling inside the field. */
export const EditingCommit: Story = {
    play: async () => {
        await openPanelKey('e');
        await waitFor(() => expect(screen.getByRole('textbox', { name: 'Commit title' })).toHaveFocus());
    },
};

/** PM24: reopened while being merged — amber, nothing to repeat; Esc closes and the merge goes on. */
export const BeingMerged: Story = { args: { pr: { ...PR, merging: 'SQUASH' } } };

/**
 * Merged on GitHub meanwhile (the panel's read, a sync): the primary says so — the viewer, no longer offered to merge
 * it, is not told they can't merge in the repository.
 */
export const MergedMeanwhile: Story = {
    args: { pr: { ...PR, state: 'MERGED', merged: true, closedAt: '2026-11-02T11:59:00Z' }, allowed: false },
};

/** Without write access: the primary says the viewer can't merge in this repository. */
export const NotAllowed: Story = { args: { allowed: false } };

/** PM25: refused at once — GitHub's reason in place; the panel and its text stay, ⌘↵ tries again. */
export const Refused: Story = { args: { answer: 'refused' } };

/** PM32a: sent, GitHub has not answered yet — the panel stays as it was, its primary busy, claiming nothing. */
export const Sending: Story = { args: { answer: 'pending' } };

/** Sent, and no answer came back (PM29's voice): it may have reached GitHub, so nothing is said to be merged or not. */
export const NoAnswer: Story = { args: { answer: 'offline' } };

/** PM26: merged from here a moment ago — how it landed, nothing else to do. */
export const Merged: Story = {
    args: {
        pr: {
            ...PR,
            state: 'MERGED',
            merged: true,
            closedAt: '2026-11-02T11:59:40Z',
            mergedAs: { method: 'SQUASH', sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' },
        },
    },
};

/**
 * PM4a, PM38: a check that isn't required failed — the row's summary says a check fails, GitHub's status that the
 * requirements are met: ready.
 */
export const OptionalFailed: Story = {
    args: {
        pr: { ...PR, mergeStateStatus: 'UNSTABLE', checks: { state: 'FAILURE', passing: 8, failing: 1, pending: 0 } },
        options: {
            ...OPTIONS,
            checks: SAMPLE_PASSED_CHECKS.map(check =>
                check.name === 'preview' ? { ...check, state: 'failing', completedAt: '2026-11-02T11:50:48Z' } : check,
            ),
        },
    },
};

/** Presses a key of the panel once its keys work: the focus is on it. */
async function openPanelKey(key: string) {
    await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));
    await userEvent.keyboard(key);
}
