import type { ListStack } from '@/lists/ListTypes.js';
import type { MyWorkMembership } from '@/store/ItemStoreTypes.js';
import type { Item, ItemRepository, PullRequestItem } from '@/store/ItemTypes.js';
import { describeStack } from '@/store/stacks/describeStack.js';
import { getStackPullRequestToOpen } from '@/store/stacks/getStackPullRequestToOpen.js';
import { groupStacks } from '@/store/stacks/groupStacks.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import { samplePullRequest } from './sampleItems.js';
import { D1_ITEMS, D1_MEMBERSHIP, sampleMembership, SAMPLE_NOW, sampleUser } from './sampleMyWork.js';
import { SAMPLE_VIEWER } from './sampleViewer.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const WEBAPP = repository('fitloop/webapp');
const TASKLET = repository('mlaine/tasklet');
const MOBILE = repository('fitloop/mobile');
const API = repository('fitloop/api');

const ML = sampleUser('mlaine', '#c9a26b');
const SB = sampleUser('sbrown', '#7fb3d5');
const RH = sampleUser('rhill', '#b39ddb');
const DK = sampleUser('dkoval', '#81c995');

const FRONTEND = { name: 'frontend', color: '4493f8' };
const CALENDAR = { name: 'calendar', color: 'd6a23a' };
const V38 = { title: 'v3.8', dueOn: '2026-11-15' };
const V39 = { title: 'v3.9', dueOn: '2026-12-13' };

const FAILING = { state: 'FAILURE', passing: 11, failing: 1, pending: 0 } as const;
const RUNNING = { state: 'PENDING', passing: 4, failing: 0, pending: 3 } as const;

/** What {@link sampleStack} makes a stack of. */
export interface SampleStackParams {
    /** The stack's node id. */
    readonly id: string;
    readonly repository?: ItemRepository;
    /** The first pull request's number; each next one counts on. */
    readonly number: number;
    /** How long ago the latest pull request changed, in ms before {@link SAMPLE_NOW}. */
    readonly age?: number;
    /** The pull requests, first to last: what each differs in from an open one ready to merge. */
    readonly members: readonly Partial<PullRequestItem>[];
    /** The stack's size when the copy holds fewer pull requests (D7). */
    readonly size?: number;
    /** The places the members hold, when not 1, 2, 3…. */
    readonly positions?: readonly number[];
}

/**
 * The pull requests of one stack, for tests and stories: each open, approved and ready to merge unless told otherwise.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function sampleStack(params: SampleStackParams): PullRequestItem[] {
    const size = params.size ?? params.members.length;
    const updatedAt = new Date(SAMPLE_NOW - (params.age ?? HOUR)).toISOString();
    return params.members.map((overrides, index) => {
        const position = params.positions?.[index] ?? index + 1;
        const number = params.number + position - 1;
        return {
            ...samplePullRequest(`PR_${params.id}_${position}`),
            number,
            url: `https://github.com/${(params.repository ?? WEBAPP).nameWithOwner}/pull/${number}`,
            title: `Part ${position} of ${params.id}`,
            repository: params.repository ?? WEBAPP,
            updatedAt,
            reviewDecision: 'APPROVED',
            ...overrides,
            stack: { id: params.id, number: 1, size, position },
        };
    });
}

/**
 * A stack's entry as a list folds it (`foldStacks`), from all its pull requests: described for {@link SAMPLE_VIEWER}.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function sampleListStack(members: readonly PullRequestItem[]): ListStack {
    const [stack] = groupStacks(members).values();
    const toOpen = getStackPullRequestToOpen(members);
    if (!stack || !toOpen) {
        throw new Error('A sample stack needs pull requests.');
    }

    return {
        id: stack.id,
        description: describeStack({ stack, viewerLogin: SAMPLE_VIEWER.login, getItem: () => undefined }),
        open: toOpen.id,
        pullRequests: stack.members,
    };
}

/** SP14's states (those githq tells today), as the pull requests of a stack each. */
export const SAMPLE_STACKS = {
    /** Every open pull request can merge. */
    ready: sampleStack({
        id: 'S_indexeddb',
        repository: TASKLET,
        number: 310,
        age: 40 * MINUTE,
        members: [
            { title: 'IndexedDB store for issues and pull requests', assignees: [ML], labels: [FRONTEND] },
            { assignees: [ML], labels: [FRONTEND] },
            { assignees: [ML], labels: [FRONTEND], milestone: V38 },
        ],
    }),
    /** The third fails its checks and holds back the fourth; people, labels and milestones differ (SP12). */
    held: sampleStack({
        id: 'S_calendar',
        number: 1204,
        age: 12 * MINUTE,
        members: [
            { title: 'Migrate class calendar to new date picker', assignees: [ML], labels: [FRONTEND, CALENDAR] },
            { assignees: [SB], labels: [FRONTEND], milestone: V38, additions: 420, deletions: 310 },
            {
                assignees: [RH, DK],
                labels: [FRONTEND],
                reviewDecision: 'REVIEW_REQUIRED',
                mergeStateStatus: 'BLOCKED',
                checks: FAILING,
            },
            { labels: [FRONTEND], milestone: V39, reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BLOCKED' },
        ],
    }),
    /** The first is merged; the next one's checks run again after GitHub rewrote it. */
    partlyMerged: sampleStack({
        id: 'S_idempotency',
        repository: API,
        number: 480,
        age: MINUTE,
        members: [
            { title: 'Idempotency keys for payment intents', state: 'MERGED', merged: true },
            { mergeStateStatus: 'BLOCKED', checks: RUNNING },
            { mergeStateStatus: 'BLOCKED', checks: RUNNING },
        ],
    }),
    /** SP23: the second's checks are running, and it holds the stack — "1 of 2 ready, #1216 checks running". */
    checksRunning: sampleStack({
        id: 'S_emails',
        number: 1215,
        age: 7 * HOUR,
        members: [{ title: 'Booking emails: templates' }, { mergeStateStatus: 'BLOCKED', checks: RUNNING }],
    }),
    /** SP12: the third waits for a review — "2 of 3 ready, #142 waiting for review". */
    waitingForReview: sampleStack({
        id: 'S_waitlist',
        repository: MOBILE,
        number: 140,
        members: [
            { title: 'Waitlist for full classes' },
            {},
            { reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BLOCKED' },
        ],
    }),
    /** A later pull request is behind its base: nothing can merge until the stack is rebased on github.com. */
    needsRebase: sampleStack({
        id: 'S_offline',
        repository: MOBILE,
        number: 95,
        members: [{ title: 'Offline queue for booking edits' }, { behindBase: true }, { behindBase: true }],
    }),
    /** The second was closed without merging; the two after it are stuck. */
    closedInside: sampleStack({
        id: 'S_billing',
        repository: API,
        number: 489,
        age: 2 * HOUR,
        members: [
            { title: 'Rework the billing export' },
            { state: 'CLOSED' },
            { reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BLOCKED' },
            { reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BLOCKED' },
        ],
    }),
    /** The second is a draft and holds back the third. */
    draftInside: sampleStack({
        id: 'S_reminders',
        repository: MOBILE,
        number: 101,
        age: 5 * HOUR,
        members: [
            { title: 'Booking reminders' },
            { isDraft: true, reviewDecision: null, mergeStateStatus: 'DRAFT' },
            { reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BLOCKED' },
        ],
    }),
    /** The copy holds two of its four pull requests so far. */
    incomplete: sampleStack({
        id: 'S_backoff',
        repository: API,
        number: 520,
        age: 2 * HOUR,
        size: 4,
        positions: [1, 2],
        members: [{ title: 'Add rate-limit backoff to webhook worker' }, {}],
    }),
    /** Every pull request landed. */
    merged: sampleStack({
        id: 'S_search',
        number: 1230,
        age: 4 * MINUTE,
        members: [
            { title: 'Member search', state: 'MERGED', merged: true },
            { state: 'MERGED', merged: true },
            { state: 'MERGED', merged: true },
        ],
    }),
    /** Someone else's stack asking the user's review on two of its four. */
    reviewRequested: sampleStack({
        id: 'S_webhooks',
        repository: API,
        number: 530,
        age: 2 * HOUR,
        members: [
            { title: 'Retry webhooks with backoff', author: SB, assignees: [SB] },
            {
                author: SB,
                assignees: [SB],
                reviewDecision: 'REVIEW_REQUIRED',
                mergeStateStatus: 'BLOCKED',
                reviewRequests: [{ kind: 'user', login: SAMPLE_VIEWER.login }],
            },
            {
                author: SB,
                assignees: [SB],
                reviewDecision: 'REVIEW_REQUIRED',
                mergeStateStatus: 'BLOCKED',
                reviewRequests: [{ kind: 'user', login: SAMPLE_VIEWER.login }],
            },
            { author: SB, assignees: [SB], reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BLOCKED' },
        ],
    }),
} as const;

/** The user's own stack of four, in "My pull requests"; the third fails its checks. */
const MY_STACK = SAMPLE_STACKS.held.map(pr => ({ ...pr, author: sampleUser(SAMPLE_VIEWER.login, '#d6a23a') }));

/**
 * "My work" of the D1 mockup with two stacks (SP1): the user's own, and someone else's asking their review on two of
 * its four — the other two in no group of my work.
 */
export const STACKED_MY_WORK_ITEMS: readonly Item[] = [...D1_ITEMS, ...MY_STACK, ...SAMPLE_STACKS.reviewRequested];

/** Which search found which item of {@link STACKED_MY_WORK_ITEMS}. */
export const STACKED_MY_WORK_MEMBERSHIP: MyWorkMembership = sampleMembership({
    reviewRequested: [...(D1_MEMBERSHIP.reviewRequested ?? []), 'PR_S_webhooks_2', 'PR_S_webhooks_3'],
    authored: [...(D1_MEMBERSHIP.authored ?? []), ...MY_STACK.map(pr => pr.id)],
    assigned: [...(D1_MEMBERSHIP.assigned ?? [])],
    mentioned: [...(D1_MEMBERSHIP.mentioned ?? [])],
});

function repository(nameWithOwner: string): ItemRepository {
    const { owner } = parseRepositoryName(nameWithOwner);
    return { nameWithOwner, owner, isPrivate: false, viewerPermission: 'WRITE' };
}
