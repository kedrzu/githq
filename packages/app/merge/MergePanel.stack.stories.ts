import type { PullRequestMergeMethod } from '@githq/github/generated.gen.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { computed, defineComponent, h, ref, shallowRef } from 'vue';
import type { PropType } from 'vue';

import type { PullRequestItem, PullRequestQueueEntry } from '@/store/ItemTypes.js';
import { SAMPLE_PASSED_CHECKS } from '@/testing/sampleMergeChecks.js';
import { sampleStack, sampleStackDescription, SAMPLE_STACKS } from '@/testing/sampleStacks.js';

import type { MergeSettings } from './getMergeMethods.js';
import MergePanel from './MergePanel.vue';
import type { MergeOptions, MergeRecord, MergeStep, MergeSubmission, SentMerge } from './MergeTypes.js';
import { getStackMerge } from './stack/getStackMerge.js';
import { getStackMergeEnd } from './stack/getStackMergeEnd.js';
import { moveStackMergeEnd } from './stack/moveStackMergeEnd.js';

/** When the stories happen. */
const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);

const SQUASH_FIRST: MergeSettings = {
    mergeCommitAllowed: true,
    squashMergeAllowed: true,
    rebaseMergeAllowed: true,
    viewerDefaultMergeMethod: 'SQUASH',
    autoMergeAllowed: false,
};

/** What {@link CALENDAR}'s first one was last sent with, alone. */
const FIRST_SENT: SentMerge = { request: { method: 'SQUASH' }, edited: null, head: 'head-oid' };

/** SP41–SP43: four ready, "Migrate class calendar to new date picker". */
const CALENDAR = sampleStack({
    id: 'S_calendar',
    number: 1203,
    members: [
        { title: 'Swap the date picker component' },
        { title: 'Move recurring rules to the new picker' },
        { title: 'Timezones in the picker' },
        { title: 'Remove the old picker' },
    ],
});

/** GitHub's word on a merge that stopped partway (SP59). */
const STOPPED = { kind: 'refused', message: 'Required status check "export-e2e" is failing.' } as const;

/** GitHub's word on a stack with a push to a lower one (D21). */
const MUST_REBASE = { kind: 'refused', message: 'This stack must be rebased before it can be merged.' } as const;

/**
 * What GitHub answers the panel's merge with, in the harness: `accepted` closes it; `pending` keeps it, every one going
 * drawn as being merged until the hidden `confirm` button says GitHub merged them; `refused` refuses it at once.
 */
type HarnessAnswer = 'accepted' | 'pending' | 'refused';

/**
 * A stack's merge panel as the app drives it (`MergePanelHost`): the line moved with `↑`/`↓`, the merge it sends
 * written out under it (`sent`: the method, the top it goes to with its head, and every one going), and the record of
 * its last merge (`record`) speaking as the host's does: for the range's top, or for the range's first, sent alone or
 * taken by a stack's merge. The hidden `arrive` button brings the panel's read when `readLater`, and the stack read again
 * (`reread`) after a refusal, which then speaks.
 */
const Harness = defineComponent({
    props: {
        members: { type: Array as PropType<readonly PullRequestItem[]>, required: true },
        /** The number of the pull request it was opened on; `null` from the stack's entry. */
        openedOn: { type: Number as PropType<number | null>, default: null },
        settings: { type: Object as PropType<MergeSettings>, default: () => SQUASH_FIRST },
        readLater: { type: Boolean, default: false },
        /** The last merge that did not end merged: a stack's names those going, else it is the first one's alone. */
        record: { type: Object as PropType<MergeRecord | null>, default: null },
        /** The stack as the read after a refusal finds it. */
        reread: { type: Array as PropType<readonly PullRequestItem[] | null>, default: null },
        answer: { type: String as PropType<HarnessAnswer>, default: 'accepted' },
        /** The methods the base branch's rules allow, as read; `null` when none restricts them. */
        allowedMergeMethods: { type: Array as PropType<readonly PullRequestMergeMethod[] | null>, default: null },
        /** GitHub says the viewer may merge past what isn't met. */
        admin: { type: Boolean, default: false },
        /** The members this session saw in a merge queue. */
        queued: { type: Array as PropType<readonly string[]>, default: () => [] },
        viewerEmail: { type: String as PropType<string | null>, default: null },
    },
    setup(props) {
        const open = ref(true);
        const arrived = ref(!props.readLater);
        const sent = ref('Nothing sent');
        const members = shallowRef(props.members);
        const record = shallowRef(props.record);
        const movedEnd = shallowRef<number | null | undefined>(undefined);
        const sending = ref(false);
        const advancing = ref<MergeStep | null>(null);

        const description = computed(() => sampleStackDescription(members.value));
        const merge = computed(() =>
            getStackMerge({
                description: description.value,
                end:
                    movedEnd.value === undefined
                        ? getStackMergeEnd({ description: description.value, openedOn: props.openedOn })
                        : movedEnd.value,
                queued: props.queued,
            }),
        );
        const pr = computed(() => members.value.find(member => member.state === 'OPEN') ?? members.value[0]);
        const recordOf = computed(() => {
            const id = record.value?.sent.going?.at(-1) ?? members.value[0]?.id;
            const first = merge.value.open[0];
            const speaks =
                merge.value.going.at(-1)?.id === id ||
                first?.id === id ||
                (first && record.value?.sent.going?.includes(first.id));
            return speaks ? members.value.find(member => member.id === id) : undefined;
        });
        const options = computed((): MergeOptions | null => {
            const first = pr.value;
            return first && arrived.value
                ? {
                      status: first,
                      proposedTexts: {
                          SQUASH: { title: `${first.title} (#${first.number})`, body: 'Swaps the old picker out.' },
                          MERGE: { title: `Merge pull request #${first.number}`, body: first.title },
                      },
                      allowedMergeMethods: props.allowedMergeMethods,
                      requiresLinearHistory: false,
                      viewerCanMergeAsAdmin: props.admin,
                      viewerCanEnableAutoMerge: false,
                      autoMergeBody: null,
                      mergeQueueMethod: first.isMergeQueueEnabled ? 'SQUASH' : null,
                      checks: [],
                      headCommit: null,
                  }
                : null;
        });

        return () => {
            const first = pr.value;
            return h('div', { style: { padding: '16px' } }, [
                h('p', [h('span', { tid: 'sent' }, sent.value)]),
                h(
                    'button',
                    {
                        type: 'button',
                        tid: 'arrive',
                        hidden: true,
                        onClick: () => {
                            arrived.value = true;
                            if (props.reread) {
                                members.value = props.reread;
                            }

                            if (record.value?.kind === 'unknown' && record.value.refusal) {
                                const { sent: merged, refusal: reason, at } = record.value;
                                record.value = { kind: 'refused', sent: merged, reason, at };
                            }
                        },
                    },
                    'The read arrives',
                ),
                h(
                    'button',
                    {
                        type: 'button',
                        tid: 'confirm',
                        hidden: true,
                        onClick: () =>
                            (members.value = members.value.map(member =>
                                member.merging
                                    ? { ...member, merging: undefined, state: 'MERGED', merged: true }
                                    : member,
                            )),
                    },
                    'GitHub says merged',
                ),
                first &&
                    h(MergePanel, {
                        open: open.value,
                        'onUpdate:open': (value: boolean) => (open.value = value),
                        pr: first,
                        settings: props.settings,
                        options: options.value,
                        reading: !arrived.value,
                        allowed: true,
                        sending: sending.value,
                        record: recordOf.value ? record.value : null,
                        recordOf: recordOf.value ?? null,
                        sent: null,
                        alreadyMerged: false,
                        advancing: advancing.value,
                        now: NOW,
                        stack: {
                            description: description.value,
                            merge: merge.value,
                            checks:
                                merge.value.going.length > 1 && merge.value.checksOf
                                    ? {
                                          number: merge.value.checksOf.number,
                                          summary: merge.value.checksOf.checks,
                                          checks: SAMPLE_PASSED_CHECKS,
                                          reading: false,
                                      }
                                    : null,
                        },
                        onMove: (direction: 'earlier' | 'later') => {
                            movedEnd.value = moveStackMergeEnd(merge.value, direction);
                        },
                        onStep: (step: MergeStep) => {
                            sent.value = `Step: ${step}`;
                            advancing.value = step;
                        },
                        emails: props.viewerEmail
                            ? {
                                  viewerDefaultCommitEmail: props.viewerEmail,
                                  viewerPossibleCommitEmails: [props.viewerEmail, 'other@fitloop.dev'],
                              }
                            : null,
                        viewerLogin: first.author?.login ?? null,
                        onVisit: (url: string) => (sent.value = `Visit: ${url}`),
                        onBypass: (submission: MergeSubmission) => {
                            sent.value = `Bypass: ${JSON.stringify({ request: submission.request, to: first.number })}`;
                        },
                        onMerge: (submission: MergeSubmission) => onMerge(submission),
                    }),
            ]);
        };

        function onMerge(submission: MergeSubmission) {
            const { going } = merge.value;
            const top = going.at(-1);
            sent.value = JSON.stringify({
                request: submission.request,
                top: top?.number,
                head: top?.headRefOid,
                going: going.map(member => member.number),
            });
            switch (props.answer) {
                case 'accepted':
                    open.value = false;
                    return;
                case 'pending': {
                    const ids = new Set(going.map(member => member.id));
                    members.value = members.value.map(member =>
                        ids.has(member.id) ? { ...member, merging: submission.request.method } : member,
                    );
                    return;
                }
                case 'refused':
                    record.value = {
                        kind: 'refused',
                        sent: {
                            ...submission,
                            head: top?.headRefOid ?? '',
                            going: going.map(member => member.id),
                        },
                        reason: MUST_REBASE,
                        at: NOW,
                    };
            }
        }
    },
});

const meta = {
    component: Harness,
    args: { members: SAMPLE_STACKS.ready },
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

/** SP40: from an entry, the whole stack — what lands, each with its state, and the button counts. */
export const WholeStack: Story = {};

/** SP41: four, from the entry — `↑` moves the line, later ones stay open and the button counts. */
export const LineMoved: Story = { args: { members: CALENDAR } };

/** SP42: opened on #1204 — everything up to it, the header the stack's. */
export const FromPullRequest: Story = { args: { members: CALENDAR, openedOn: 1204 } };

/** SP43: opened on the first — it lands alone, an ordinary merge, with its commit text. */
export const OneLands: Story = { args: { members: CALENDAR, openedOn: 1203 } };

/** SP44: several methods, one for all — Rebase chosen. */
export const OneMethodForAll: Story = {
    args: { settings: { ...SQUASH_FIRST, viewerDefaultMergeMethod: 'REBASE' } },
};

/** SP45: held — the line at the last that can land, the one holding the rest named. */
export const Held: Story = { args: { members: SAMPLE_STACKS.held } };

/** SP46: needs rebase, the target moved — `⌘↵` opens GitHub's "Rebase stack". */
export const NeedsRebase: Story = { args: { members: SAMPLE_STACKS.needsRebase } };

/** SP47: needs rebase after a push to an earlier one. */
export const NeedsRebaseAfterPush: Story = {
    args: {
        members: sampleStack({
            id: 'S_offline',
            number: 94,
            members: [
                { title: 'Offline queue for booking edits', headRefName: 'offline-queue' },
                { headRefName: 'replay', baseRefName: 'offline-queue', behindBase: true },
                { baseRefName: 'replay' },
            ],
        }),
    },
};

/** SP48: a pull request closed mid-stack — those before it can land, later ones can't. */
export const ClosedInside: Story = { args: { members: SAMPLE_STACKS.closedInside } };

/** SP49: a draft inside holds the rest; marking it ready is right there. */
export const DraftInside: Story = { args: { members: SAMPLE_STACKS.draftInside } };

/** SP50: the copy holds two of four — never ready, `⌘↵` does nothing. */
export const Incomplete: Story = { args: { members: SAMPLE_STACKS.incomplete } };

/** SP51: being read — `⌘↵` already works. */
export const BeingRead: Story = { args: { readLater: true } };

/** SP56: sent and accepted while open — every one going is being merged, none merged until GitHub says so. */
export const BeingMerged: Story = { args: { answer: 'pending' } };

/** SP58: one landed, the rest carries on. */
export const PartlyMerged: Story = { args: { members: SAMPLE_STACKS.partlyMerged } };

const BILLING = sampleStack({
    id: 'S_billing',
    number: 488,
    members: [
        { title: 'Split the export job' },
        { title: 'Stream rows to storage' },
        { title: 'Add the export format option' },
        { title: 'Remove the old export' },
    ],
});

/** A merge of every one of {@link BILLING}, as sent. */
const BILLING_SENT: SentMerge = {
    request: { method: 'SQUASH' },
    edited: null,
    head: 'head-oid',
    going: BILLING.map(member => member.id),
};

/**
 * SP60, then SP59 once the stack is read again (`arrive`): the first landed, the second refused, and those left
 * rewritten onto what landed.
 */
export const PartwayFailure: Story = {
    args: {
        members: BILLING,
        record: { kind: 'unknown', sent: BILLING_SENT, at: NOW, accepted: false, refusal: STOPPED },
        reread: BILLING.map((member, index) =>
            index === 0
                ? { ...member, state: 'MERGED', merged: true }
                : { ...member, headRefOid: `rewritten-${index}` },
        ),
    },
};

/** SP60 with no answer: nothing known of any of them, none to send again. */
export const NoAnswer: Story = {
    args: { members: BILLING, record: { kind: 'unknown', sent: BILLING_SENT, at: NOW, accepted: true } },
};

/** SP61: refused at once — GitHub's words, nothing merged, the way forward. */
export const Refused: Story = { args: { members: SAMPLE_STACKS.ready, answer: 'refused' } };

const OFFLINE = sampleStack({
    id: 'S_offline',
    number: 94,
    members: [
        { title: 'Offline queue for booking edits', headRefName: 'offline-queue' },
        { headRefName: 'replay', baseRefName: 'offline-queue', behindBase: true },
        { baseRefName: 'replay' },
    ],
});

/** SP62: someone pushed to #94 meanwhile — GitHub refuses, and read again the stack needs a rebase, because of #94. */
export const PushedToLower: Story = {
    args: {
        members: OFFLINE,
        record: {
            kind: 'refused',
            sent: { request: { method: 'SQUASH' }, edited: null, head: 'head-oid', going: OFFLINE.map(pr => pr.id) },
            reason: MUST_REBASE,
            at: NOW,
        },
    },
};

/** PM27: someone pushed to the top of the range meanwhile: the new commit, as for any merge. */
export const TopHeadMoved: Story = {
    args: {
        members: BILLING,
        record: {
            kind: 'refused',
            sent: { ...BILLING_SENT, head: 'older-head' },
            reason: { kind: 'refused', message: 'Head branch was modified. Review and try the merge again.' },
            at: NOW,
        },
    },
};

/** PM27: as {@link TopHeadMoved}, with the commit read on the top after the refusal: who pushed it, and what. */
export const TopHeadMovedNamed: Story = {
    args: {
        members: BILLING,
        record: {
            kind: 'refused',
            sent: { ...BILLING_SENT, head: 'older-head' },
            reason: { kind: 'refused', message: 'Head branch was modified. Review and try the merge again.' },
            at: NOW,
            headCommit: { oid: 'head-oid', headline: 'Drop the old export format', author: 'monalisa' },
        },
    },
};

/** PM28: refused for a method the rules, read after it was sent, don't allow. */
export const MethodNotAllowed: Story = {
    args: {
        members: BILLING,
        allowedMergeMethods: ['SQUASH'],
        record: {
            kind: 'refused',
            sent: { ...BILLING_SENT, request: { method: 'MERGE' } },
            reason: { kind: 'refused', message: 'Merge commits are not allowed.' },
            at: NOW,
        },
    },
};

/** D11: opened on #489, though the refused merge went to the top: the record is found by any member going. */
export const OpenedElsewhere: Story = {
    args: {
        members: BILLING,
        openedOn: 489,
        record: { kind: 'refused', sent: BILLING_SENT, reason: STOPPED, at: NOW },
    },
};

/** PM22, D18: opened on the first while GitHub works out whether it merges: a merge like any, its own verdict. */
export const OneGoingMergeabilityUnknown: Story = {
    args: {
        members: sampleStack({
            id: 'S_calendar',
            number: 1203,
            members: [
                { title: 'Swap the date picker component', mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' },
                { title: 'Move recurring rules to the new picker' },
            ],
        }),
        openedOn: 1203,
    },
};

/** PM25, D18: opened on #1204, `↑` to the first, whose last merge alone GitHub refused: its own ending speaks. */
export const OneGoingRefused: Story = {
    args: {
        members: CALENDAR,
        openedOn: 1204,
        record: { kind: 'refused', sent: FIRST_SENT, reason: STOPPED, at: NOW },
    },
};

/** PM29, D18: as {@link OneGoingRefused}, GitHub not having said how it ended: nothing to send again. */
export const OneGoingUnknown: Story = {
    args: {
        members: CALENDAR,
        openedOn: 1204,
        record: { kind: 'unknown', sent: FIRST_SENT, at: NOW, accepted: true },
    },
};

/** PM27, D18: as {@link OneGoingRefused}, refused for a new commit on the first since it was sent. */
export const OneGoingNewCommit: Story = {
    args: {
        members: CALENDAR,
        openedOn: 1204,
        record: {
            kind: 'refused',
            sent: { ...FIRST_SENT, head: 'older-head' },
            reason: { kind: 'refused', message: 'Head branch was modified. Review and try the merge again.' },
            at: NOW,
        },
    },
};

/** A stack of three on a merge queue's branch: SP53's. */
const SEARCH = sampleStack({
    id: 'S_search',
    number: 1212,
    members: [
        { title: 'Index members', isMergeQueueEnabled: true },
        { title: 'Fuzzy matching', isMergeQueueEnabled: true },
        { title: 'Search box', isMergeQueueEnabled: true },
    ],
});

const SEARCH_ENTRY: PullRequestQueueEntry = {
    position: 2,
    state: 'AWAITING_CHECKS',
    estimatedTimeToMerge: 12 * 60,
    enqueuedAt: new Date(NOW - 9 * 60_000).toISOString(),
    enqueuer: 'mlaine',
};

/** {@link SEARCH} in the queue: each with an entry and a position of its own, as on GitHub (live, 2026-11-03). */
function searchInQueue(): PullRequestItem[] {
    return SEARCH.map((member, index) => ({
        ...member,
        mergeQueueEntry: { ...SEARCH_ENTRY, position: SEARCH_ENTRY.position + index },
    }));
}

/** SP53: all three enter as one group; no method to choose, no text, no jump. */
export const QueueWhole: Story = { args: { members: SEARCH } };

/** SP53, the line moved: two of the three enter. */
export const QueueSome: Story = { args: { members: SEARCH, openedOn: 1213 } };

/** SP53, exactly one going: still no method to choose and no text. */
export const QueueOneGoing: Story = { args: { members: SEARCH, openedOn: 1212, viewerEmail: 'm.laine@fitloop.dev' } };

/** SP54: in the queue, the group's place is its first one's and each row says its own; all that is left is to leave. */
export const InQueue: Story = { args: { members: searchInQueue(), admin: true } };

/** SP54: GitHub says the first won't merge: thrown out, the later ones with it; nothing to add again until they are out. */
export const ThrownOutUnmergeable: Story = {
    args: {
        members: searchInQueue().map((member, index) =>
            index === 0 ? { ...member, mergeQueueEntry: { ...SEARCH_ENTRY, state: 'UNMERGEABLE' as const } } : member,
        ),
    },
};

/** SP54: seen in the queue, no entry now and still open: it says which one and adds again; why is GitHub's to say. */
export const ThrownOutEntryGone: Story = {
    args: { members: SEARCH, queued: SEARCH.map(member => member.id) },
};

/** SP54: the first went through the queue and the second was thrown out: the last left with it. */
export const ThrownOutAfterOneLanded: Story = {
    args: {
        members: SEARCH.map((member, index) => (index === 0 ? { ...member, state: 'MERGED', merged: true } : member)),
        queued: SEARCH.map(member => member.id),
    },
};

/** SP54: the last one thrown out, none after it. */
export const ThrownOutLast: Story = {
    args: {
        members: SEARCH.map((member, index) => (index < 2 ? { ...member, state: 'MERGED', merged: true } : member)),
        queued: SEARCH.map(member => member.id),
    },
};

/** SP55's first: waiting for a review. */
const WAITING_FIRST = sampleStack({
    id: 'S_calendar',
    number: 1203,
    members: [
        { title: 'Swap the date picker component', mergeStateStatus: 'BLOCKED', reviewDecision: 'REVIEW_REQUIRED' },
        { title: 'Move recurring rules to the new picker' },
        { title: 'Timezones in the picker' },
        { title: 'Remove the old picker' },
    ],
});

/** SP55: the line speaks of the first alone, and lands it alone; the primary stays last, off. */
export const BypassFirst: Story = {
    args: { members: WAITING_FIRST, admin: true, viewerEmail: 'm.laine@fitloop.dev' },
};

/** SP55: the first is ready and the second holds the rest: nothing it can reach, so no line. */
export const BypassNotTheSecond: Story = {
    args: {
        members: sampleStack({
            id: 'S_calendar',
            number: 1203,
            members: [
                { title: 'Swap the date picker component' },
                { title: 'Move recurring rules', mergeStateStatus: 'BLOCKED', reviewDecision: 'REVIEW_REQUIRED' },
            ],
        }),
        admin: true,
    },
};
