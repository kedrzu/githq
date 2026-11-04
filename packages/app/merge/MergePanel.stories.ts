import { assertNever } from '@nzyme/utils/assertNever.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, screen, userEvent, waitFor } from 'storybook/test';
import { defineComponent, h, ref, shallowRef } from 'vue';
import type { PropType } from 'vue';

import type { PullRequestItem, PullRequestQueueEntry } from '@/store/ItemTypes.js';
import { samplePullRequest } from '@/testing/sampleItems.js';
import { SAMPLE_PASSED_CHECKS } from '@/testing/sampleMergeChecks.js';

import type { MergeSettings } from './getMergeMethods.js';
import MergePanel from './MergePanel.vue';
import type {
    MergeOptions,
    MergeRecord,
    MergeAdvancing,
    MergeStep,
    MergeSubmission,
    PullRequestCommand,
    SentMerge,
} from './MergeTypes.js';

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
    autoMergeAllowed: false,
    deleteBranchOnMerge: false,
    viewerDefaultCommitEmail: null,
    viewerPossibleCommitEmails: [],
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
    autoMergeBody: null,
    mergeQueueMethod: null,
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
 * button is clicked: GitHub answered and the read came back with the pull request as `stepped` holds it. With
 * `settingsLater` the repository's settings are on their way until the hidden `settingsArrive` button is clicked, or
 * `settingsLost`: their read ended with none.
 */
const Harness = defineComponent({
    props: {
        pr: { type: Object as PropType<PullRequestItem>, default: () => PR },
        settings: { type: Object as PropType<MergeSettings | null>, default: () => ALL_METHODS },
        options: { type: Object as PropType<MergeOptions | null>, default: () => OPTIONS },
        readLater: { type: Boolean, default: false },
        settingsLater: { type: Boolean, default: false },
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
        advancing: { type: String as PropType<MergeAdvancing | null>, default: null },
        viewerLogin: { type: String as PropType<string | null>, default: null },
        /** Its ordinary commands that apply. */
        commands: { type: Array as PropType<readonly PullRequestCommand[]>, default: () => [] },
    },
    setup(props) {
        const open = ref(true);
        const arrived = ref(!props.readLater);
        const settingsIn = ref(!props.settingsLater);
        const settingsReading = ref(props.settingsLater);
        const sent = ref('Nothing sent');
        const record = shallowRef<MergeRecord | null>(props.record);
        const alreadyMerged = ref(false);
        const options = shallowRef(props.options);
        const sending = ref(false);
        const advancing = ref<MergeAdvancing | null>(props.advancing);
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
                        tid: 'settingsArrive',
                        hidden: true,
                        onClick: () => {
                            settingsIn.value = true;
                            settingsReading.value = false;
                        },
                    },
                    "The repository's settings arrive",
                ),
                h(
                    'button',
                    {
                        type: 'button',
                        tid: 'settingsLost',
                        hidden: true,
                        onClick: () => (settingsReading.value = false),
                    },
                    "The repository's settings could not be read",
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
                h(
                    'button',
                    {
                        type: 'button',
                        tid: 'readAgain',
                        hidden: true,
                        onClick: () => {
                            current.value = props.reread?.pr ?? current.value;
                            options.value = props.reread?.options ?? options.value;
                        },
                    },
                    'The read comes back',
                ),
                h(MergePanel, {
                    open: open.value,
                    'onUpdate:open': (value: boolean) => (open.value = value),
                    pr: sending.value ? { ...current.value, merging: 'SQUASH' } : current.value,
                    settings: settingsIn.value ? props.settings : null,
                    settingsReading: settingsReading.value,
                    options: arrived.value ? options.value : null,
                    reading: !arrived.value,
                    allowed: props.allowed,
                    sending: sending.value,
                    record: record.value,
                    sent: props.sent ?? props.record?.sent ?? null,
                    alreadyMerged: alreadyMerged.value,
                    advancing: advancing.value,
                    now: NOW,
                    viewerLogin: props.viewerLogin,
                    commands: props.commands,
                    onBypass: (submission: MergeSubmission) => {
                        sent.value = `Bypass: ${JSON.stringify(submission.request)}`;
                        const merge: SentMerge = { ...submission, head: current.value.headRefOid };
                        switch (props.answer) {
                            case 'pending':
                                sending.value = true;
                                break;
                            case 'refused': {
                                const reason = { kind: 'refused', message: RULE_VIOLATION } as const;
                                record.value = { kind: 'refused', sent: merge, reason, at: NOW };
                                break;
                            }
                            default:
                                open.value = false;
                        }
                    },
                    onStep: (step: MergeStep) => {
                        sent.value = `Step: ${step}`;
                        if (step !== 'resolveConflicts') {
                            advancing.value = step;
                        }
                    },
                    onCommand: (command: PullRequestCommand) => {
                        sent.value = `Command: ${command.kind === 'updateBranch' ? `updateBranch ${command.method}` : command.kind}`;
                        advancing.value = command.kind;
                    },
                    onEnableAutoMerge: (submission: MergeSubmission) => {
                        sent.value = `Enable: ${JSON.stringify(submission.request)}`;
                        advancing.value = 'enableAutoMerge';
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

/**
 * PM8: being read — opens at once from the row; ⌘↵ already works. A loader beside the commit's title until the
 * proposal is in, then its message opens below.
 */
export const BeingRead: Story = { args: { readLater: true } };

/** PM8: the repository's settings still on their way: no method yet, and a `⌘↵` pressed now waits for one. */
export const SettingsBeingRead: Story = { args: { settingsLater: true, readLater: true } };

/** PM8: being read, GitHub's status saying only checks not required are in the way: it would merge it now (owner, 2026-11-03). */
export const BeingReadOptionalFailed: Story = {
    args: {
        readLater: true,
        pr: { ...PR, mergeStateStatus: 'UNSTABLE', checks: { state: 'FAILURE', passing: 8, failing: 1, pending: 0 } },
    },
};

/** PM8: being read, and the proposal brings no message — the loader goes and nothing opens. */
export const BeingReadNoMessage: Story = {
    args: {
        readLater: true,
        options: {
            ...OPTIONS,
            proposedTexts: {
                ...OPTIONS.proposedTexts,
                SQUASH: { title: 'Retry Stripe webhook delivery on 5xx (#477)', body: '' },
            },
        },
    },
};

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

/**
 * PM43 (D12): with a chosen address and the rules no longer met for someone who may bypass them, nothing was sent; the
 * bypass line, which commits with the default address, is the way past them.
 */
export const RulesNotConfirmed: Story = {
    args: {
        settings: SQUASH_ONLY,
        record: { kind: 'refused', sent: SENT_EDITED, reason: { kind: 'rulesNotConfirmed' }, at: NOW },
    },
};

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

/** D12: GitHub out of reach for what a chosen email's merge reads first: nothing went, so `⌘↵` tries again. */
export const NotReached: Story = {
    args: { record: { kind: 'refused', sent: SENT_EDITED, reason: { kind: 'notReached' }, at: NOW } },
};

/** PM30: sent for a pull request merged already — GitHub says merged at once; the panel stays and says so. */
export const AlreadyMerged: Story = { args: { answer: 'merged' } };

/** PM26: merged from here a moment ago — how it landed, and its follow-ups: delete its branch (`⇧D`), revert (`⇧Z`). */
export const Merged: Story = {
    args: {
        pr: {
            ...PR,
            state: 'MERGED',
            merged: true,
            closedAt: '2026-11-02T11:59:40Z',
            mergedAs: { method: 'SQUASH', sha: MERGE_SHA },
        },
        commands: [{ kind: 'deleteBranch' }, { kind: 'revert' }],
    },
};

/** PM26b: the repository deleted its branch — the same key restores it. */
export const MergedBranchDeleted: Story = {
    args: {
        pr: { ...Merged.args?.pr, ...PR, state: 'MERGED', merged: true, headRefId: null },
        settings: { ...ALL_METHODS, deleteBranchOnMerge: true },
        commands: [{ kind: 'restoreBranch' }, { kind: 'revert' }],
    },
};

/** Merged, for someone who can't push and with a fork's branch: what became of it, and nothing to take. */
export const MergedNothingToTake: Story = {
    args: { pr: { ...PR, state: 'MERGED', merged: true, headRefId: null, isCrossRepository: true } },
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
        commands: [
            { kind: 'updateBranch', method: 'MERGE' },
            { kind: 'updateBranch', method: 'REBASE' },
        ],
    },
};

/**
 * PM20: behind main with a required check failed — a pull request reads so (live, 2026-11-03). ⌘↵ stays what the verdict
 * says, nothing here; `U` and `⇧U` update all the same.
 */
export const BehindRequiredFailed: Story = {
    args: {
        ...Behind.args,
        pr: { ...PR, mergeStateStatus: 'BEHIND', checks: { state: 'FAILURE', passing: 7, failing: 2, pending: 0 } },
        options: RequiredFailed.args?.options,
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

/** Waiting for the required checks and a review, on a repository that allows auto-merge. */
const NOT_MET: PullRequestItem = {
    ...PR,
    reviewDecision: 'REVIEW_REQUIRED',
    reviewRequests: [{ kind: 'user', login: 'dkim' }],
    mergeStateStatus: 'BLOCKED',
    checks: { state: 'PENDING', passing: 7, failing: 0, pending: 2 },
};
const AUTO_MERGE_SETTINGS: MergeSettings = { ...ALL_METHODS, autoMergeAllowed: true };
const AUTO_MERGE_OPTIONS: MergeOptions = { ...OPTIONS, viewerCanEnableAutoMerge: true };

/** PM10: not met, and auto-merge may wait for it — the method and the text chosen now, ⌘↵ turns it on. */
export const AutoMergeOffered: Story = {
    args: { pr: NOT_MET, settings: AUTO_MERGE_SETTINGS, options: AUTO_MERGE_OPTIONS },
};

/** Auto-merge allowed by the repository, but not for this viewer: as with nothing to offer. */
export const AutoMergeNotForViewer: Story = {
    args: { pr: NOT_MET, settings: AUTO_MERGE_SETTINGS },
};

/** Never for a stacked pull request: GitHub refuses it, though `viewerCanEnableAutoMerge` reads true. */
export const AutoMergeInStack: Story = {
    args: {
        pr: { ...NOT_MET, stack: { id: 'S_1', number: 1, size: 2, position: 1 } },
        settings: AUTO_MERGE_SETTINGS,
        options: AUTO_MERGE_OPTIONS,
    },
};

/** PM11: auto-merge on — who enabled it and how, the text fixed; ⌘↵ turns it off. */
export const AutoMergeOn: Story = {
    args: {
        pr: {
            ...NOT_MET,
            autoMerge: {
                mergeMethod: 'SQUASH',
                enabledAt: new Date(Date.now() - 12 * 60_000).toISOString(),
                enabledBy: 'mlaine',
                commitHeadline: 'Retry Stripe webhook delivery, chosen when it went on (#477)',
            },
        },
        settings: AUTO_MERGE_SETTINGS,
        options: { ...AUTO_MERGE_OPTIONS, autoMergeBody: 'The message chosen when it went on.' },
    },
};

/** PM14: ready on a queue's branch — method and text the queue's; ⌘↵ adds it, ⇧⌘↵ jumps. */
export const QueueReady: Story = {
    args: { pr: { ...PR, isMergeQueueEnabled: true }, options: { ...OPTIONS, mergeQueueMethod: 'SQUASH' } },
};

/** PM9 doesn't speak on a queue's branch: the read says it rebases, the panel having started on squash; it was never chosen. */
export const QueueReadChangesMethod: Story = {
    args: {
        pr: { ...PR, isMergeQueueEnabled: true },
        options: { ...OPTIONS, mergeQueueMethod: 'REBASE' },
        readLater: true,
    },
};

const ENTRY: PullRequestQueueEntry = {
    position: 3,
    state: 'AWAITING_CHECKS',
    estimatedTimeToMerge: 12 * 60,
    enqueuedAt: new Date(NOW - 9 * 60_000).toISOString(),
    enqueuer: 'mlaine',
};

function inQueue(entry: Partial<PullRequestQueueEntry>): PullRequestItem {
    return { ...PR, isMergeQueueEnabled: true, mergeQueueEntry: { ...ENTRY, ...entry } };
}

/** PM15: in the queue — position, state, who added it; no primary, and leaving is here (⇧Q). */
export const InQueue: Story = { args: { pr: inQueue({}) } };

/** PM16: queued, far back. */
export const QueueQueued: Story = {
    args: { pr: inQueue({ position: 5, state: 'QUEUED', estimatedTimeToMerge: 40 * 60 }) },
};

/** PM16: no estimate when GitHub gives none. */
export const QueueNoEstimate: Story = { args: { pr: inQueue({ estimatedTimeToMerge: null }) } };

/** PM16: mergeable, first in line. */
export const QueueMergeable: Story = {
    args: { pr: inQueue({ position: 1, state: 'MERGEABLE', estimatedTimeToMerge: null }) },
};

/** PM16: locked for merging. */
export const QueueLocked: Story = {
    args: { pr: inQueue({ position: 1, state: 'LOCKED', estimatedTimeToMerge: null }) },
};

/** PM16: GitHub says it won't merge. */
export const QueueUnmergeable: Story = {
    args: { pr: inQueue({ position: 2, state: 'UNMERGEABLE', estimatedTimeToMerge: null }) },
};

/** A viewer GitHub says may merge past what isn't met, with what isn't: `ci / test (node 20)` failed, no review yet. */
const ADMIN_OPTIONS: MergeOptions = {
    ...OPTIONS,
    viewerCanMergeAsAdmin: true,
    checks: SAMPLE_PASSED_CHECKS.map(check =>
        check.name === 'test (node 20)' ? { ...check, state: 'failing' } : check,
    ),
};

const NOT_APPROVED: PullRequestItem = {
    ...PR,
    mergeStateStatus: 'BLOCKED',
    reviewDecision: 'REVIEW_REQUIRED',
    checks: { state: 'FAILURE', passing: 8, failing: 1, pending: 0 },
};

/** The viewer's addresses, as the repository's metadata brings them. */
const EMAILS = {
    viewerDefaultCommitEmail: 'm.laine@fitloop.dev',
    viewerPossibleCommitEmails: ['m.laine@fitloop.dev', 'mikko@laine.fi', 'mlaine@users.noreply.github.com'],
};

/** {@link ALL_METHODS} with {@link EMAILS}. */
const WITH_EMAILS: MergeSettings = { ...ALL_METHODS, ...EMAILS };

/** PM12a: its own line above the footer, what it skips and the email it commits with; the primary stays last. */
export const BypassBesideAutoMerge: Story = {
    args: {
        pr: NOT_APPROVED,
        settings: { ...AUTO_MERGE_SETTINGS, ...EMAILS },
        options: { ...ADMIN_OPTIONS, viewerCanEnableAutoMerge: true },
    },
};

/** PM12a over PM13: neither auto-merge nor anything else to do, the primary off and bypass the only way. */
export const BypassAlone: Story = { args: { pr: NOT_APPROVED, options: ADMIN_OPTIONS, settings: WITH_EMAILS } };

/** PM12a: a required check still running is skipped by name too, and GitHub not naming a default is said so. */
export const BypassRequiredRunning: Story = {
    args: {
        pr: { ...PR, mergeStateStatus: 'BLOCKED', checks: { state: 'PENDING', passing: 8, failing: 0, pending: 1 } },
        options: {
            ...OPTIONS,
            viewerCanMergeAsAdmin: true,
            checks: SAMPLE_PASSED_CHECKS.map(check =>
                check.name === 'lint' ? { ...check, state: 'pending', completedAt: null } : check,
            ),
        },
    },
};

/** PM12a over PM20: behind is a requirement it skips; ⌘↵ still updates the branch. */
export const BypassBehind: Story = {
    args: {
        pr: { ...PR, mergeStateStatus: 'BEHIND' },
        options: { ...OPTIONS, viewerCanMergeAsAdmin: true },
        settings: WITH_EMAILS,
    },
};

/** PM12a: GitHub says blocked, nothing the panel reads says why. */
export const BypassBlockedUnnamed: Story = {
    args: {
        pr: { ...PR, mergeStateStatus: 'BLOCKED' },
        options: { ...OPTIONS, viewerCanMergeAsAdmin: true },
    },
};

/** PM12a on a rebase: it makes no commit of its own, so no email is named. */
export const BypassRebase: Story = {
    args: {
        pr: NOT_APPROVED,
        settings: {
            ...ALL_METHODS,
            squashMergeAllowed: false,
            mergeCommitAllowed: false,
            viewerDefaultMergeMethod: 'REBASE',
            ...EMAILS,
        },
        options: ADMIN_OPTIONS,
    },
};

/** PM12a on a queue's branch: it goes outside the queue, directly, and says so. */
export const BypassOnQueueBranch: Story = {
    args: {
        pr: { ...NOT_APPROVED, isMergeQueueEnabled: true },
        options: { ...ADMIN_OPTIONS, mergeQueueMethod: 'SQUASH' },
        settings: WITH_EMAILS,
    },
};

/** PM12a, sent: its own button busy until GitHub answers, the primary as it was. */
export const BypassSending: Story = {
    args: { pr: NOT_APPROVED, options: ADMIN_OPTIONS, settings: WITH_EMAILS, answer: 'pending' },
};

/** D12: the head moved with the panel open, the read of it on its way (`stepped`) until it comes back (`readAgain`). */
export const BypassHeadMoved: Story = {
    args: {
        pr: NOT_APPROVED,
        options: ADMIN_OPTIONS,
        stepped: { ...NOT_APPROVED, headRefOid: NEW_HEAD },
        reread: {
            pr: { ...NOT_APPROVED, headRefOid: NEW_HEAD },
            options: { ...ADMIN_OPTIONS, headCommit: { oid: NEW_HEAD, headline: 'Handle a 502', author: 'dkim' } },
        },
    },
};

/** PM12a over PM20, sent: the step `⌘↵` would take stays off until GitHub answers. */
export const BypassBehindSending: Story = {
    args: {
        pr: { ...PR, mergeStateStatus: 'BEHIND' },
        options: { ...OPTIONS, viewerCanMergeAsAdmin: true },
        answer: 'pending',
    },
};

/** PM25 after bypass: a rule the viewer may not bypass comes back in GitHub's words. */
export const BypassRefused: Story = {
    args: { pr: NOT_APPROVED, options: ADMIN_OPTIONS, settings: WITH_EMAILS, answer: 'refused' },
};

/** No line: ready by itself, whoever the viewer is. */
export const AdminReady: Story = { args: { options: { ...OPTIONS, viewerCanMergeAsAdmin: true } } };

/** No line: already in the queue. */
export const AdminInQueue: Story = { args: { pr: inQueue({}), options: ADMIN_OPTIONS } };

/** No line: under auto-merge. */
export const AdminAutoMergeOn: Story = {
    args: {
        pr: {
            ...NOT_APPROVED,
            autoMerge: { mergeMethod: 'SQUASH', enabledAt: null, enabledBy: 'mlaine', commitHeadline: null },
        },
        settings: AUTO_MERGE_SETTINGS,
        options: ADMIN_OPTIONS,
    },
};

/** No line: being merged. */
export const AdminBeingMerged: Story = {
    args: { pr: { ...NOT_APPROVED, merging: 'SQUASH' }, options: ADMIN_OPTIONS },
};

/** No line: GitHub refuses a draft whoever asks; marking it ready is the way. */
export const AdminDraft: Story = { args: { pr: { ...NOT_APPROVED, isDraft: true }, options: ADMIN_OPTIONS } };

/** No line: GitHub refuses conflicts whoever asks. */
export const AdminConflicts: Story = {
    args: { pr: { ...NOT_APPROVED, mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' }, options: ADMIN_OPTIONS },
};

/** PM6: a squash by the pull request's author with several addresses: the line, on the default; `Y` moves on. */
export const EmailSquashByAuthor: Story = { args: { settings: WITH_EMAILS, viewerLogin: PR.author?.login ?? null } };

/** PM6: a merge commit takes an email from anyone with several addresses. */
export const EmailMergeCommit: Story = {
    args: { settings: { ...WITH_EMAILS, viewerDefaultMergeMethod: 'MERGE' }, viewerLogin: 'mlaine' },
};

/** No line: a squash by someone other than the author. */
export const EmailSquashNotAuthor: Story = { args: { settings: WITH_EMAILS, viewerLogin: 'mlaine' } };

/** No line: a single address is no choice. */
export const EmailOneAddress: Story = {
    args: {
        settings: {
            ...ALL_METHODS,
            viewerDefaultCommitEmail: 'm.laine@fitloop.dev',
            viewerPossibleCommitEmails: ['m.laine@fitloop.dev'],
        },
        viewerLogin: PR.author?.login ?? null,
    },
};

/** No line: a queue writes its own commits. */
export const EmailOnQueueBranch: Story = {
    args: {
        pr: { ...PR, isMergeQueueEnabled: true },
        options: { ...OPTIONS, mergeQueueMethod: 'MERGE' },
        settings: { ...WITH_EMAILS, viewerDefaultMergeMethod: 'MERGE' },
        viewerLogin: PR.author?.login ?? null,
    },
};

/** D15: reopened after a refused merge sent with another address, it starts on that one. */
export const EmailSentReopened: Story = {
    args: {
        settings: WITH_EMAILS,
        viewerLogin: PR.author?.login ?? null,
        sent: { request: { method: 'SQUASH', authorEmail: 'mikko@laine.fi' }, edited: null, head: PR.headRefOid },
    },
};
