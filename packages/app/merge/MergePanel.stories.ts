import { assertNever } from '@nzyme/utils/assertNever.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, screen, userEvent, waitFor } from 'storybook/test';
import { defineComponent, h, ref, shallowRef } from 'vue';
import type { PropType } from 'vue';

import type { PullRequestItem } from '@/store/ItemTypes.js';
import { samplePullRequest } from '@/testing/sampleItems.js';
import { SAMPLE_PASSED_CHECKS } from '@/testing/sampleMergeChecks.js';

import type { MergeSettings } from './getMergeMethods.js';
import MergePanel from './MergePanel.vue';
import type { MergeOptions, MergeRecord, MergeStep, MergeSubmission, SentMerge } from './MergeTypes.js';

/** When the stories happen: a running check's time is counted to it. */
const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);

const PR: PullRequestItem = {
    ...samplePullRequest('PR_477'),
    url: 'https://github.com/fitloop/api/pull/477',
    number: 477,
    title: 'Retry Stripe webhook delivery on 5xx',
    repository: { nameWithOwner: 'fitloop/api', owner: 'fitloop', isPrivate: true, viewerPermission: 'WRITE' },
    headRefName: 'retry-stripe-5xx',
    headRefOid: 'a91d03b7e2c4f6a8b0d1e3f5a7c9b2d4e6f8a0c1',
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
    headCommit: { oid: PR.headRefOid, headline: 'Retry Stripe webhook delivery on 5xx', author: 'kedrzu' },
};

/** GitHub's reason for the refusal in PM25: a title line, and the rule's own words under it. */
const RULE_VIOLATION = [
    'Repository rule violations found',
    '',
    'At least 2 approving reviews are required by reviewers with write access.',
].join('\n');

/** A merge sent with the squash title edited. */
const SENT_EDITED: SentMerge = {
    request: { method: 'SQUASH', title: 'Retry Stripe webhook delivery on 5xx, with a dead letter table (#477)' },
    edited: { title: 'Retry Stripe webhook delivery on 5xx, with a dead letter table (#477)', body: SQUASH_BODY },
    head: PR.headRefOid,
};

/** The commit a merge landed as. */
const MERGE_SHA = '6dcb09b5b57875f334f61aebed695e2e4193db5e';

/** The head after dkim pushed: checks running on it again. */
const NEW_HEAD = '4f1c9e2a7d3b5c6e8f9a0b1c2d3e4f5a6b7c8d9e';
const PUSHED: PullRequestItem = {
    ...PR,
    headRefOid: NEW_HEAD,
    checks: { state: 'PENDING', passing: 2, failing: 0, pending: 7 },
};

/**
 * What GitHub answers the panel's merge with, in the harness: `pending` is no answer yet — the pull request drawn as
 * being merged meanwhile, as the merge's optimistic layer draws it — `offline` none at all, and `merged` merged at
 * once, as GitHub answers for a pull request merged already (PM30).
 */
type HarnessAnswer = 'accepted' | 'merged' | 'offline' | 'pending' | 'refused';

/** What the panel's read finds when it reads again after a refusal. */
interface HarnessReread {
    readonly pr: PullRequestItem;
    readonly options: MergeOptions;
}

/**
 * The panel as the app drives it: the merges and steps it asks for are written out under it (`sent`), GitHub answers
 * a merge at once (`answer`: accepted closes it, refused keeps it with the reason, which the panel tells apart by what
 * the read finds again — `reread`, the pull request and its options as they are now), and with `readLater` the panel's
 * read is on its way until the hidden `arrive` button is clicked. A step is on its way until the hidden `stepped`
 * button is clicked: GitHub answered and the read came back with the pull request as `stepped` holds it.
 */
const Harness = defineComponent({
    props: {
        pr: { type: Object as PropType<PullRequestItem>, default: () => PR },
        settings: { type: Object as PropType<MergeSettings | null>, default: () => ALL_METHODS },
        options: { type: Object as PropType<MergeOptions | null>, default: () => OPTIONS },
        readLater: { type: Boolean, default: false },
        /** What the session knows of its last merge as the panel opens. */
        record: { type: Object as PropType<MergeRecord | null>, default: null },
        /** The method and text its last merge was sent with; the record's when not given. */
        sent: { type: Object as PropType<SentMerge | null>, default: null },
        reread: { type: Object as PropType<HarnessReread | null>, default: null },
        answer: { type: String as PropType<HarnessAnswer>, default: 'accepted' },
        allowed: { type: Boolean, default: true },
        /** The pull request once the step asked for is done; `null` for it as it was. */
        stepped: { type: Object as PropType<PullRequestItem | null>, default: null },
        /** A step asked for before, still on its way. */
        advancing: { type: String as PropType<MergeStep | null>, default: null },
    },
    setup(props) {
        const open = ref(true);
        const arrived = ref(!props.readLater);
        const sent = ref('Nothing sent');
        const record = shallowRef<MergeRecord | null>(props.record);
        const alreadyMerged = ref(false);
        const options = shallowRef(props.options);
        const sending = ref(false);
        const advancing = ref<MergeStep | null>(props.advancing);
        const current = shallowRef(props.pr);

        return () =>
            h('div', { style: { padding: '16px' } }, [
                h('p', [h('span', { tid: 'sent' }, sent.value)]),
                h(
                    'button',
                    { type: 'button', tid: 'arrive', hidden: true, onClick: () => (arrived.value = true) },
                    "The panel's read arrives",
                ),
                h(
                    'button',
                    {
                        type: 'button',
                        tid: 'stepped',
                        hidden: true,
                        onClick: () => {
                            current.value = props.stepped ?? current.value;
                            advancing.value = null;
                        },
                    },
                    'The step is done',
                ),
                h(MergePanel, {
                    open: open.value,
                    'onUpdate:open': (value: boolean) => (open.value = value),
                    pr: sending.value ? { ...current.value, merging: 'SQUASH' } : current.value,
                    settings: props.settings,
                    options: arrived.value ? options.value : null,
                    reading: !arrived.value,
                    allowed: props.allowed,
                    sending: sending.value,
                    record: record.value,
                    sent: props.sent ?? props.record?.sent ?? null,
                    alreadyMerged: alreadyMerged.value,
                    advancing: advancing.value,
                    now: NOW,
                    onStep: (step: MergeStep) => {
                        sent.value = `Step: ${step}`;
                        if (step !== 'resolveConflicts') {
                            advancing.value = step;
                        }
                    },
                    onVisit: (url: string) => (sent.value = `Visit: ${url}`),
                    onMerge: (submission: MergeSubmission) => {
                        sent.value = JSON.stringify(submission.request);
                        const merge: SentMerge = { ...submission, head: current.value.headRefOid };
                        if (props.reread) {
                            current.value = props.reread.pr;
                            options.value = props.reread.options;
                        }

                        switch (props.answer) {
                            case 'accepted':
                                open.value = false;
                                break;
                            case 'pending':
                                sending.value = true;
                                break;
                            case 'merged':
                                current.value = {
                                    ...current.value,
                                    state: 'MERGED',
                                    merged: true,
                                    closedAt: new Date(NOW).toISOString(),
                                    mergedAs: { method: submission.request.method, sha: MERGE_SHA },
                                };
                                alreadyMerged.value = true;
                                break;
                            case 'refused': {
                                const reason = { kind: 'refused', message: RULE_VIOLATION } as const;
                                record.value = { kind: 'refused', sent: merge, reason, at: NOW };
                                break;
                            }
                            case 'offline':
                                record.value = { kind: 'unknown', sent: merge, at: NOW, accepted: false };
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

/** PM25, reopened (D15): refused earlier this session — the reason, and the text it was sent with, given back. */
export const RefusedReopened: Story = {
    args: {
        settings: SQUASH_ONLY,
        record: { kind: 'refused', sent: SENT_EDITED, reason: { kind: 'refused', message: RULE_VIOLATION }, at: NOW },
    },
};

/**
 * D15, after the refresh: refused earlier this session, and a copy of the pull request read since says what GitHub
 * holds — the refusal no longer speaks, but the panel still starts on the text it was sent with.
 */
export const SentReopened: Story = { args: { settings: SQUASH_ONLY, sent: SENT_EDITED } };

/**
 * PM27: someone pushed in the meantime — GitHub refuses the merge naming the old head; the read again finds the new
 * one, so nothing merged on purpose, and the primary goes by the new commit's state: checks running again.
 */
export const HeadMoved: Story = {
    args: {
        answer: 'refused',
        settings: SQUASH_ONLY,
        reread: {
            pr: PUSHED,
            options: {
                ...OPTIONS,
                status: PUSHED,
                headCommit: { oid: NEW_HEAD, headline: 'Handle empty billing response', author: 'dkim' },
            },
        },
    },
};

/**
 * PM28: a method sent before the rules arrived — the read again brings a ruleset on main allowing only squash; the
 * panel is on Squash, the edited merge commit text kept as its text, and ⌘↵ squashes.
 */
export const MethodNotAllowed: Story = {
    args: {
        answer: 'refused',
        settings: { ...ALL_METHODS, viewerDefaultMergeMethod: 'MERGE' },
        reread: { pr: PR, options: { ...OPTIONS, allowedMergeMethods: ['SQUASH'] } },
    },
};

/**
 * PM29: reopened for a pull request whose merge got no answer in time — grey, neither merged nor failed; nothing
 * offers a second merge, and GitHub is a key away.
 */
export const OutcomeUnknown: Story = {
    args: { record: { kind: 'unknown', sent: SENT_EDITED, at: NOW, accepted: true } },
};

/** PM31: refused for a permission githq may lack — one more refusal with GitHub's reason (PM25's look). */
export const RefusedForPermission: Story = {
    args: {
        record: {
            kind: 'refused',
            sent: SENT_EDITED,
            reason: {
                kind: 'refused',
                message:
                    'refusing to allow an OAuth App to create or update workflow `.github/workflows/ci.yml` without `workflow` scope',
            },
            at: NOW,
        },
    },
};

/**
 * G5: refused because the organisation restricts third-party apps and has not approved githq — GitHub reads its
 * public repositories to githq, and refuses every change there; the way out is requesting access.
 */
export const OrganizationRestricted: Story = {
    args: {
        record: {
            kind: 'refused',
            sent: SENT_EDITED,
            reason: { kind: 'organizationRestricted', organization: 'fitloop' },
            at: NOW,
        },
    },
};

/** PM32a: sent, GitHub has not answered yet — the panel stays as it was, its primary busy, claiming nothing. */
export const Sending: Story = { args: { answer: 'pending' } };

/** Sent, and no answer came back (PM29): it may have reached GitHub, so nothing is said to be merged or not. */
export const NoAnswer: Story = { args: { answer: 'offline' } };

/** PM30: sent for a pull request merged already — GitHub says merged at once; the panel stays and says so. */
export const AlreadyMerged: Story = { args: { answer: 'merged' } };

/** PM26: merged from here a moment ago — how it landed, nothing else to do. */
export const Merged: Story = {
    args: {
        pr: {
            ...PR,
            state: 'MERGED',
            merged: true,
            closedAt: '2026-11-02T11:59:40Z',
            mergedAs: { method: 'SQUASH', sha: MERGE_SHA },
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

/** Nine checks that passed but `ci / e2e (chromium)`, a required one that failed after six minutes. */
const E2E_FAILED: MergeOptions = {
    ...OPTIONS,
    checks: SAMPLE_PASSED_CHECKS.map(check =>
        check.name === 'e2e (chromium)'
            ? { ...check, state: 'failing', startedAt: '2026-11-02T11:40:00Z', completedAt: '2026-11-02T11:46:02Z' }
            : check,
    ),
};

/**
 * PM13: not met, nothing to offer — changes requested and a required check failed. The panel says why, the reviews
 * beside the checks; the primary is off.
 */
export const NothingToOffer: Story = {
    args: {
        pr: {
            ...PR,
            reviewDecision: 'CHANGES_REQUESTED',
            latestReviews: [
                { author: 'sofiab', state: 'CHANGES_REQUESTED' },
                { author: 'dkim', state: 'APPROVED' },
            ],
            mergeStateStatus: 'BLOCKED',
            checks: { state: 'FAILURE', passing: 8, failing: 1, pending: 0 },
        },
        options: E2E_FAILED,
    },
};

/** PM19: conflicts — the way forward is GitHub's editor, so ⌘↵ goes there; the primary's icon says it leaves. */
export const Conflicts: Story = {
    args: { pr: { ...PR, mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' } },
};

/** PM20: behind main, which requires being up to date — ⌘↵ updates the branch, the method and text wait meanwhile. */
export const Behind: Story = {
    args: {
        pr: { ...PR, mergeStateStatus: 'BEHIND' },
        settings: SQUASH_ONLY,
        stepped: { ...PR, headRefOid: 'updated-head-oid', mergeStateStatus: 'CLEAN' },
    },
};

/** PM20: the branch being updated — the panel stays and says so, its primary busy, until GitHub says it can merge. */
export const UpdatingBranch: Story = { args: { ...Behind.args, advancing: 'updateBranch' } };

/** PM21: a draft — one step before anything else: ⌘↵ marks it ready; the method and the text wait until then. */
export const Draft: Story = {
    args: {
        pr: {
            ...PR,
            isDraft: true,
            mergeStateStatus: 'DRAFT',
            checks: { state: 'SUCCESS', passing: 4, failing: 0, pending: 0 },
        },
        options: { ...OPTIONS, checks: SAMPLE_PASSED_CHECKS.slice(0, 4) },
        stepped: { ...PR, mergeStateStatus: 'CLEAN' },
    },
};

/**
 * PM22: GitHub is still working out whether it merges — no red and no spinner; ⌘↵ stays on, since GitHub enforces it
 * and a refusal keeps the panel (PM25).
 */
export const MergeabilityUnknown: Story = {
    args: { pr: { ...PR, mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' }, settings: SQUASH_ONLY },
};

/** Presses a key of the panel once its keys work: the focus is on it. */
async function openPanelKey(key: string) {
    await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));
    await userEvent.keyboard(key);
}
