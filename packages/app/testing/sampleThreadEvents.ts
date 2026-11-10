import type {
    IssueDetail,
    ItemCheck,
    ItemComment,
    PullRequestDetail,
    ThreadCommit,
    ThreadEvent,
    ThreadRef,
} from '@/store/ItemDetailTypes.js';
import type { IssueItem, ItemUser, PullRequestItem } from '@/store/ItemTypes.js';

import { D1_ISSUE, D1_ISSUE_DETAIL, F1_PULL_REQUEST, F1_PULL_REQUEST_DETAIL } from './sampleItemDetails.js';
import { SAMPLE_NOW, sampleUser } from './sampleMyWork.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MLAINE = sampleUser('mlaine', '#c9a26b');
const DKIM = sampleUser('dkim', '#7fb3d5');
const SOFIAB = sampleUser('sofiab', '#81c995');

const STORAGE = { name: 'storage', color: '4493f8' };
const BUG = { name: 'bug', color: 'e5534b' };
const ROADMAP = { title: 'tasklet Roadmap', url: 'https://github.com/users/mlaine/projects/1' };

/** The pull request of F5: its head is the newest commit, whose checks failed. */
export const F5_PULL_REQUEST: PullRequestItem = { ...F1_PULL_REQUEST, headRefOid: 'e81f0a3d5c1b9f7a' };

/**
 * F5's thread on {@link F5_PULL_REQUEST}: six commits pushed, a label added and two reviews asked for in one go, the
 * comments, three more commits, the newest failing two of its nine checks, a review asked for again.
 */
export const F5_PULL_REQUEST_DETAIL: PullRequestDetail = {
    ...F1_PULL_REQUEST_DETAIL,
    item: F5_PULL_REQUEST,
    events: {
        totalCount: 13,
        commitCount: 9,
        oldest: [],
        newest: [
            commit('a04c7e9', 'Count the store in the bundle budget', 4 * DAY, 'SUCCESS'),
            commit('5f1a0d3', 'Drop the in-memory cache', 4 * DAY - MINUTE, 'SUCCESS'),
            commit('2b9e4c1', 'Write back what the sync engine reads', 4 * DAY - 2 * MINUTE, 'SUCCESS'),
            commit('7d0f2aa', 'Read the list from the store before the network', 4 * DAY - 3 * MINUTE, 'SUCCESS'),
            commit('c3e8b17', 'Keep issues and pull requests in one store', 4 * DAY - 4 * MINUTE, 'SUCCESS'),
            commit('91ac0de', 'Open the IndexedDB store on sign-in', 4 * DAY - 5 * MINUTE, 'SUCCESS'),
            { ...event('E_1', MLAINE, 4 * DAY - 20 * MINUTE), kind: 'labeled', label: STORAGE },
            {
                ...event('E_2', MLAINE, 4 * DAY - 21 * MINUTE),
                kind: 'reviewRequested',
                reviewer: { kind: 'user', user: SOFIAB },
            },
            {
                ...event('E_3', MLAINE, 4 * DAY - 22 * MINUTE),
                kind: 'reviewRequested',
                reviewer: { kind: 'user', user: DKIM },
            },
            commit('4a1c9e2', 'Cover cross-repository links in the e2e', DAY + 2 * MINUTE, 'SUCCESS'),
            commit('b72d1c4', 'Retry the upgrade when another tab blocks it', DAY + MINUTE, 'SUCCESS'),
            commit('e81f0a3', 'Migrate pull requests instead of clearing the store', DAY, 'FAILURE'),
            {
                ...event('E_4', MLAINE, 2 * HOUR),
                kind: 'reviewRequested',
                reviewer: { kind: 'user', user: SOFIAB },
            },
        ],
        middle: null,
    },
    checks: [
        check('e2e', 'failing'),
        check('typecheck', 'failing'),
        ...['lint', 'unit', 'build', 'deploy', 'CodeQL', 'Vercel', 'docs'].map(name => check(name, 'passing')),
    ],
    checkCount: 9,
};

/** The issue of I1, with the thread's people. */
export const I1_ISSUE: IssueItem = { ...D1_ISSUE, author: DKIM };

/**
 * I1's thread on {@link I1_ISSUE}: a label and the type set in one go, a parent, a project and its Status, comments,
 * the user assigning themselves, sub-issues added and removed, a pull request linked, a commit and an issue naming it,
 * a project workflow's Status change, a pin.
 */
export const I1_ISSUE_DETAIL: IssueDetail = {
    ...D1_ISSUE_DETAIL,
    item: I1_ISSUE,
    comments: {
        totalCount: 2,
        first: [],
        nodes: [
            comment('C_1', SOFIAB, 4 * DAY + HOUR, 'Same here: the link to #9 is gone after a sync.'),
            comment('C_2', DKIM, 3 * HOUR, 'Fixed by #15 once it lands; the e2e covers both repositories now.'),
        ],
        olderCursor: null,
    },
    events: {
        totalCount: 13,
        commitCount: 0,
        oldest: [],
        newest: [
            { ...event('IE_1', DKIM, 6 * DAY), kind: 'labeled', label: BUG },
            {
                ...event('IE_2', DKIM, 6 * DAY - MINUTE),
                kind: 'issueTypeChanged',
                from: null,
                to: { name: 'Bug', color: 'RED' },
            },
            { ...event('IE_3', MLAINE, 6 * DAY - HOUR), kind: 'parentAdded', issue: ref(9, 'Offline support') },
            { ...event('IE_4', MLAINE, 5 * DAY), kind: 'addedToProject', project: ROADMAP },
            {
                ...event('IE_5', MLAINE, 5 * DAY - HOUR),
                kind: 'projectStatusChanged',
                project: ROADMAP,
                to: 'Todo',
                wasAutomated: false,
            },
            { ...event('IE_6', MLAINE, 4 * DAY), kind: 'assigned', assignee: MLAINE },
            {
                ...event('IE_7', MLAINE, 4 * DAY - HOUR),
                kind: 'subIssueAdded',
                issue: ref(13, 'Keep parent links in the migration'),
            },
            {
                ...event('IE_8', MLAINE, 3 * DAY),
                kind: 'subIssueRemoved',
                issue: ref(10, 'Rebuild links on every sync'),
            },
            {
                ...event('IE_9', MLAINE, 2 * DAY),
                kind: 'connected',
                ref: { ...ref(15, 'IndexedDB store'), kind: 'pullRequest' },
            },
            {
                ...event('IE_10', MLAINE, DAY),
                kind: 'referenced',
                commit: {
                    abbreviatedOid: '4a1c9e2',
                    url: 'https://github.com/mlaine/tasklet/commit/4a1c9e2',
                    messageHeadline: 'Cover cross-repository links in the e2e',
                },
                repository: 'mlaine/tasklet',
            },
            {
                ...event('IE_11', SOFIAB, DAY - HOUR),
                kind: 'crossReferenced',
                source: ref(14, 'Store project items next to issues'),
            },
            {
                ...event('IE_12', null, 2 * HOUR + 30 * MINUTE),
                kind: 'projectStatusChanged',
                project: ROADMAP,
                to: 'Done',
                wasAutomated: true,
            },
            { ...event('IE_13', MLAINE, 2 * HOUR), kind: 'pinned' },
        ],
        middle: null,
    },
};

/** mlaine asking for their own review, then taking the request back, an hour apart. */
export const THEIR_OWN_REVIEW_REQUEST: readonly ThreadEvent[] = spaced([
    { kind: 'reviewRequested', reviewer: { kind: 'user', user: MLAINE } },
    { kind: 'reviewRequestRemoved', reviewer: { kind: 'user', user: MLAINE } },
]);

/** Every event a pull request's thread shows (F13, left), one person's each well apart, so none share a line. */
export const EVERY_PULL_REQUEST_EVENT: readonly ThreadEvent[] = spaced([
    { kind: 'forcePushed', beforeOid: '91ac0de', afterOid: 'e81f0a3' },
    { kind: 'assigned', assignee: DKIM },
    { kind: 'unassigned', assignee: DKIM },
    { kind: 'renamed', from: 'Store issues in IndexedDB', to: 'IndexedDB store for issues and pull requests' },
    { kind: 'labeled', label: STORAGE },
    { kind: 'unlabeled', label: { name: 'sync', color: '7b61ff' } },
    { kind: 'milestoned', milestone: 'First version' },
    { kind: 'demilestoned', milestone: 'First version' },
    { kind: 'reviewRequested', reviewer: { kind: 'user', user: SOFIAB } },
    { kind: 'reviewRequestRemoved', reviewer: { kind: 'team', slug: 'storage', name: 'Storage' } },
    {
        kind: 'reviewDismissed',
        reviewer: SOFIAB,
        reviewId: 'R-sofiab',
        previousState: 'CHANGES_REQUESTED',
        message: 'Addressed in 3f2a9b1',
    },
    { kind: 'readyForReview' },
    { kind: 'convertedToDraft' },
    { kind: 'baseChanged', from: 'offline-stack', to: 'main' },
    { kind: 'crossReferenced', source: ref(14, 'Store project items next to issues') },
    { kind: 'closed', stateReason: null, closer: null, duplicateOf: null },
    { kind: 'reopened' },
    {
        kind: 'merged',
        commit: { abbreviatedOid: '3f2a9b1', url: 'https://github.com/kedrzu/githq/commit/3f2a9b1' },
        into: 'main',
    },
    { kind: 'headRefDeleted', branch: 'idb-store' },
]);

/** Every event only an issue's thread shows (F13, right), one person's each well apart, so none share a line. */
export const EVERY_ISSUE_EVENT: readonly ThreadEvent[] = spaced([
    { kind: 'closed', stateReason: 'COMPLETED', closer: null, duplicateOf: null },
    {
        kind: 'closed',
        stateReason: 'COMPLETED',
        closer: { kind: 'pullRequest', pullRequest: { ...ref(15, 'IndexedDB store'), kind: 'pullRequest' } },
        duplicateOf: null,
    },
    { kind: 'closed', stateReason: 'NOT_PLANNED', closer: null, duplicateOf: null },
    { kind: 'closed', stateReason: 'DUPLICATE', closer: null, duplicateOf: ref(12, 'Sub-issue links are lost') },
    // As github/roadmap#1318 has it: closed as a duplicate, of an issue GitHub does not name.
    { kind: 'closed', stateReason: 'DUPLICATE', closer: null, duplicateOf: null },
    { kind: 'reopened' },
    { kind: 'connected', ref: { ...ref(15, 'IndexedDB store'), kind: 'pullRequest' } },
    {
        kind: 'referenced',
        commit: {
            abbreviatedOid: '4a1c9e2',
            url: 'https://github.com/mlaine/tasklet/commit/4a1c9e2',
            messageHeadline: 'Cover cross-repository links in the e2e',
        },
        repository: 'mlaine/tasklet',
    },
    { kind: 'subIssueAdded', issue: ref(13, 'Keep parent links in the migration') },
    { kind: 'subIssueRemoved', issue: ref(10, 'Rebuild links on every sync') },
    { kind: 'parentAdded', issue: { ...ref(9, 'Offline support'), repository: 'mlaine/tasklet-mobile' } },
    { kind: 'issueTypeChanged', from: { name: 'Task', color: 'BLUE' }, to: { name: 'Bug', color: 'RED' } },
    { kind: 'addedToProject', project: ROADMAP },
    { kind: 'projectStatusChanged', project: ROADMAP, to: 'In progress', wasAutomated: false },
    { kind: 'transferred', from: 'mlaine/tasklet-mobile' },
    { kind: 'locked', reason: null },
    { kind: 'unlocked' },
    { kind: 'pinned' },
    { kind: 'unpinned' },
]);

/**
 * One burst of mlaine's (F13), as primer/react#8676 had them: each new issue mentioned this one, then went in as its
 * sub-issue; then two commits referenced it.
 */
export const BURST_OF_ONE_KIND: readonly ThreadEvent[] = inBurst([
    { kind: 'crossReferenced', source: ref(14, 'Store project items next to issues') },
    { kind: 'subIssueAdded', issue: ref(14, 'Store project items next to issues') },
    { kind: 'crossReferenced', source: ref(15, 'Keep parent links in the migration') },
    { kind: 'subIssueAdded', issue: ref(15, 'Keep parent links in the migration') },
    { kind: 'crossReferenced', source: ref(16, 'Rebuild links on every sync') },
    { kind: 'subIssueAdded', issue: ref(16, 'Rebuild links on every sync') },
    ...['4a1c9e2', '7d3b0f5'].map(oid => ({
        kind: 'referenced' as const,
        commit: { abbreviatedOid: oid, url: `https://github.com/mlaine/tasklet/commit/${oid}`, messageHeadline: oid },
        repository: 'mlaine/tasklet',
    })),
]);

type EventFields = ThreadEvent extends infer TEvent
    ? TEvent extends ThreadEvent
        ? TEvent extends ThreadCommit
            ? never
            : Omit<TEvent, 'id' | 'createdAt' | 'actor'>
        : never
    : never;

/** mlaine's events an hour apart, the newest an hour ago. */
function spaced(events: readonly EventFields[]): ThreadEvent[] {
    return events.map((fields, index): ThreadEvent => ({
        ...fields,
        ...event(`EV_${index + 1}`, MLAINE, (events.length - index) * HOUR),
    }));
}

/** mlaine's events a minute apart, the newest a minute ago: one burst. */
function inBurst(events: readonly EventFields[]): ThreadEvent[] {
    return events.map((fields, index): ThreadEvent => ({
        ...fields,
        ...event(`EB_${index + 1}`, MLAINE, (events.length - index) * MINUTE),
    }));
}

function event(id: string, actor: ItemUser | null, age: number) {
    return { id, actor, createdAt: new Date(SAMPLE_NOW - age).toISOString() };
}

function commit(oid: string, headline: string, age: number, ci: ThreadCommit['ci']): ThreadCommit {
    return {
        kind: 'commit',
        id: `PRC_${oid}`,
        createdAt: new Date(SAMPLE_NOW - age).toISOString(),
        actor: MLAINE,
        authorName: 'Maja Laine',
        abbreviatedOid: oid,
        messageHeadline: headline,
        url: `https://github.com/kedrzu/githq/pull/15/commits/${oid}`,
        ci,
    };
}

function ref(number: number, title: string): ThreadRef {
    return {
        kind: 'issue',
        id: `I_${number}`,
        url: `https://github.com/${D1_ISSUE.repository.nameWithOwner}/issues/${number}`,
        number,
        title,
        repository: D1_ISSUE.repository.nameWithOwner,
    };
}

function comment(id: string, author: ItemUser, age: number, text: string): ItemComment {
    return {
        id,
        url: `https://github.com/acme/web/issues/1#${id}`,
        author,
        body: text,
        bodyHtml: `<p>${text}</p>`,
        createdAt: new Date(SAMPLE_NOW - age).toISOString(),
        lastEditedAt: null,
        viewerCanUpdate: false,
        viewerCanDelete: false,
    };
}

function check(name: string, state: ItemCheck['state']): ItemCheck {
    return {
        id: `ci/${name}`,
        kind: 'checkRun',
        name,
        workflow: 'ci',
        state,
        cancelled: false,
        url: null,
        startedAt: new Date(SAMPLE_NOW - DAY + MINUTE).toISOString(),
        completedAt: new Date(SAMPLE_NOW - DAY + 9 * MINUTE).toISOString(),
    };
}
