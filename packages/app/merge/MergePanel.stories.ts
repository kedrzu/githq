import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, ref, shallowRef } from 'vue';
import type { PropType } from 'vue';

import type { EditFailureReason } from '@/edits/EditTypes.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import { samplePullRequest } from '@/testing/sampleItems.js';

import type { MergeSettings } from './getMergeMethods.js';
import MergePanel from './MergePanel.vue';
import type { MergeCheck, MergeOptions, MergeRequest } from './MergeTypes.js';

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

const REQUIRED = ['ci / test (node 20)', 'ci / lint', 'ci / typecheck', 'ci / build', 'ci / e2e (chromium)'];
const OTHERS = ['CircleCI / nightly-smoke', 'CodeQL', 'Vercel / preview', 'codecov/patch'];

const PASSED: readonly MergeCheck[] = [
    ...REQUIRED.map(name => sampleCheck(name, { isRequired: true })),
    ...OTHERS.map(name => sampleCheck(name, {})),
];

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
    checks: PASSED,
    checkCount: PASSED.length,
};

/** What GitHub answers the panel's merge with, in the harness. */
type HarnessAnswer = 'accepted' | 'refused';

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
                    pr: props.pr,
                    settings: props.settings,
                    options: arrived.value ? props.options : null,
                    reading: !arrived.value,
                    allowed: props.allowed,
                    sending: false,
                    refusal: refusal.value,
                    now: NOW,
                    onMerge: (request: MergeRequest) => {
                        sent.value = JSON.stringify(request);
                        if (props.answer === 'refused') {
                            refusal.value = { kind: 'refused', message: 'Repository rule violations found' };
                        } else {
                            open.value = false;
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
            checks: PASSED.map((check, index) =>
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
            checks: PASSED.map(check => {
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
            checks: PASSED.map(check => {
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

function sampleCheck(fullName: string, overrides: Partial<MergeCheck>): MergeCheck {
    const [workflow, name] = fullName.includes(' / ') ? fullName.split(' / ') : [null, fullName];
    return {
        id: `CR_${fullName}`,
        kind: 'checkRun',
        name: name ?? fullName,
        workflow: workflow ?? null,
        state: 'passing',
        url: `https://github.com/fitloop/api/actions/runs/1/${encodeURIComponent(fullName)}`,
        startedAt: '2026-11-02T11:50:00Z',
        completedAt: '2026-11-02T11:51:40Z',
        isRequired: false,
        appSlug: 'github-actions',
        workflowRunId: 1,
        ...overrides,
    };
}
