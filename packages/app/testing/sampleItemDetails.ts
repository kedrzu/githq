import { assert } from '@nzyme/utils/assert.js';

import type {
    IssueDetail,
    ItemCheck,
    ItemComment,
    ItemDetailProject,
    PullRequestDetail,
} from '@/store/ItemDetailTypes.js';
import type { IssueItem, Item, PullRequestItem } from '@/store/ItemTypes.js';

import { D1_ITEMS, SAMPLE_NOW, sampleUser } from './sampleMyWork.js';
import { SAMPLE_VIEWER } from './sampleViewer.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const KEDRZU = sampleUser(SAMPLE_VIEWER.login, '#d6a23a');
const OLAM = sampleUser('olam', '#7fb3d5');
const PNOWAK = sampleUser('pnowak', '#81c995');
const TSW = sampleUser('tsw', '#b39ddb');

/** D1's issue as the panel shows it: assignee, labels, milestone, type, sub-issues, two projects. */
export const D1_ISSUE: IssueItem = {
    ...findItem('I_1187', 'issue'),
    createdAt: ago(3 * DAY),
    assignees: [KEDRZU],
    labels: [
        { name: 'bug', color: 'e5534b' },
        { name: 'calendar', color: '4fb0c6' },
    ],
    milestone: { title: 'v4.2 — November', dueOn: null },
    issueType: { name: 'Bug', color: 'RED' },
    subIssues: { total: 5, completed: 3 },
    commentCount: 4,
};

/** The detail of {@link D1_ISSUE}: its body, its last two of four comments, every field of its projects. */
export const D1_ISSUE_DETAIL: IssueDetail = {
    kind: 'issue',
    id: D1_ISSUE.id,
    item: D1_ISSUE,
    fetchedAt: SAMPLE_NOW,
    body: 'Recurring visits created before the DST change render one hour late in the week view.',
    bodyHtml:
        '<p>Recurring visits created before the DST change render one hour late in the week view. Single visits are fine. Repro: weekly visit on Oct 20, switch to Nov 3.</p>',
    reactions: [],
    comments: {
        totalCount: 4,
        nodes: [
            comment('C_1', OLAM, 2 * HOUR, 'Same on mobile. Looks like the series start is stored in local time.'),
            comment('C_2', KEDRZU, 20 * MINUTE, 'Opened #1205 — converting at creation and migrating existing series.'),
        ],
        olderCursor: 'cursor-older',
    },
    projects: [
        project('Platform Q4', { status: ['In progress', 'YELLOW'], priority: 'High', estimate: 3 }),
        project('Bug triage', { status: ['Confirmed', 'GREEN'], severity: 'Major' }),
    ],
    parent: null,
    subIssues: { totalCount: 5, nodes: [] },
    blockedBy: { totalCount: 0, nodes: [] },
    blocking: { totalCount: 0, nodes: [] },
};

/** F1's pull request: two checks failing and one running, changes requested by one reviewer, approved by another. */
export const F1_PULL_REQUEST: PullRequestItem = {
    ...findItem('PR_15', 'pullRequest'),
    createdAt: ago(2 * DAY),
    author: KEDRZU,
    assignees: [KEDRZU],
    labels: [
        { name: 'storage', color: '4493f8' },
        { name: 'sync', color: '7b61ff' },
    ],
    milestone: { title: 'First version', dueOn: null },
    headRefName: 'idb-store',
    changedFiles: 9,
    checks: { state: 'FAILURE', passing: 6, failing: 2, pending: 1 },
    latestReviews: [
        { author: 'olam', state: 'CHANGES_REQUESTED' },
        { author: 'pnowak', state: 'APPROVED' },
    ],
    reviewRequests: [{ kind: 'user', login: 'tsw' }],
    closingIssueIds: ['I_7'],
    commentCount: 7,
};

/** The detail of {@link F1_PULL_REQUEST}. */
export const F1_PULL_REQUEST_DETAIL: PullRequestDetail = {
    kind: 'pullRequest',
    id: F1_PULL_REQUEST.id,
    item: F1_PULL_REQUEST,
    fetchedAt: SAMPLE_NOW,
    body: 'Moves issues, pull requests and project items into IndexedDB.',
    bodyHtml:
        '<p>Moves issues, pull requests and project items into IndexedDB so reads never wait on the network. Schema v1: one store per kind, indexed by repository and <code>updatedAt</code>.</p>',
    reactions: [],
    comments: {
        totalCount: 2,
        nodes: [
            comment(
                'C_3',
                OLAM,
                3 * HOUR,
                "The migration drops sub-issue links when the parent lives in another repo. That's the failing e2e.",
            ),
            comment('C_4', KEDRZU, HOUR, 'Good catch, adding a cross-repo fixture before re-requesting review.'),
        ],
        olderCursor: null,
    },
    projects: [project('githq Roadmap', { status: ['In review', 'PURPLE'], priority: 'High', estimate: 5 })],
    commitCount: 4,
    headRepository: 'kedrzu/githq',
    checks: [
        check('ci', 'test (node 20)', 'failing', 134_000),
        check('ci', 'e2e (chromium)', 'failing', 362_000),
        check('ci', 'e2e (webkit)', 'pending', null),
        ...['lint', 'typecheck', 'build', 'test (node 22)'].map(name => check('ci', name, 'passing', 45_000)),
        check(null, 'CodeQL', 'passing', 80_000),
        check(null, 'Vercel', 'passing', 60_000),
    ],
    checkCount: 9,
    reviews: [
        { author: OLAM, state: 'CHANGES_REQUESTED', submittedAt: ago(3 * HOUR) },
        { author: PNOWAK, state: 'APPROVED', submittedAt: ago(DAY) },
    ],
    reviewRequests: [{ kind: 'user', user: TSW }],
};

/** The issue F1's pull request closes. */
export const F1_CLOSES: readonly Item[] = [
    {
        ...findItem('I_12', 'issue'),
        id: 'I_7',
        number: 7,
        title: 'Keep a local copy of issues in IndexedDB',
        repository: F1_PULL_REQUEST.repository,
    },
];

/** F3's pull request: approved by two, every check passed, no conflicts — ready to merge on GitHub. */
export const F3_PULL_REQUEST: PullRequestItem = {
    ...findItem('PR_477', 'pullRequest'),
    createdAt: ago(3 * DAY),
    author: KEDRZU,
    assignees: [KEDRZU],
    headRefName: 'retry-stripe-5xx',
    changedFiles: 3,
    checks: { state: 'SUCCESS', passing: 9, failing: 0, pending: 0 },
    latestReviews: [
        { author: 'olam', state: 'APPROVED' },
        { author: 'pnowak', state: 'APPROVED' },
    ],
};

/** The detail of {@link F3_PULL_REQUEST}. */
export const F3_PULL_REQUEST_DETAIL: PullRequestDetail = {
    ...F1_PULL_REQUEST_DETAIL,
    id: F3_PULL_REQUEST.id,
    item: F3_PULL_REQUEST,
    bodyHtml:
        '<p>Retries webhook deliveries that fail with a 5xx, with exponential backoff capped at one hour. Duplicate deliveries are dropped by event id.</p>',
    projects: [project('Platform Q4', { status: ['In review', 'PURPLE'], priority: 'High', estimate: 2 })],
    headRepository: 'skyline-labs/api',
    checks: ['lint', 'typecheck', 'unit', 'e2e', 'build', 'deploy', 'CodeQL', 'Vercel', 'docs'].map(name =>
        check('ci', name, 'passing', 50_000),
    ),
    reviews: [
        { author: OLAM, state: 'APPROVED', submittedAt: ago(2 * HOUR) },
        { author: PNOWAK, state: 'APPROVED', submittedAt: ago(3 * HOUR) },
        { author: TSW, state: 'COMMENTED', submittedAt: ago(DAY) },
    ],
    reviewRequests: [],
};

function findItem<K extends Item['kind']>(id: string, kind: K): Extract<Item, { kind: K }> {
    const item = D1_ITEMS.find(candidate => candidate.id === id);
    assert(item && isKind(item, kind), `No ${kind} ${id} in D1`);
    return item;
}

function isKind<K extends Item['kind']>(item: Item, kind: K): item is Extract<Item, { kind: K }> {
    return item.kind === kind;
}

function ago(ms: number) {
    return new Date(SAMPLE_NOW - ms).toISOString();
}

function comment(id: string, author: ItemComment['author'], age: number, text: string): ItemComment {
    return {
        id,
        url: `https://github.com/acme/web/issues/1#${id}`,
        author,
        bodyHtml: `<p>${text}</p>`,
        createdAt: ago(age),
        lastEditedAt: null,
    };
}

function check(workflow: string | null, name: string, state: ItemCheck['state'], ran: number | null): ItemCheck {
    const startedAt = ago(ran ?? 4 * MINUTE);
    return {
        id: `${workflow ?? ''}/${name}`,
        kind: 'checkRun',
        name,
        workflow,
        state,
        url: `https://github.com/acme/web/actions/runs/1#${name}`,
        startedAt,
        completedAt: state === 'pending' ? null : ago(0),
    };
}

interface SampleFields {
    status: [name: string, color: 'GREEN' | 'PURPLE' | 'YELLOW'];
    priority?: string;
    estimate?: number;
    severity?: string;
}

function project(title: string, fields: SampleFields): ItemDetailProject {
    const sprint = { id: 'IT_14', title: 'Sprint 14', startDate: ago(3 * DAY).slice(0, 10), duration: 14 };
    const sample: ItemDetailProject = {
        itemId: `PVTI_${title}`,
        projectId: `PVT_${title}`,
        title,
        number: 1,
        url: 'https://github.com/orgs/acme/projects/1',
        updatedAt: ago(DAY),
        viewerCanUpdate: true,
        fields: [
            {
                kind: 'singleSelect',
                id: 'status',
                name: 'Status',
                options: [
                    { id: 'status-todo', name: 'Todo', color: 'GRAY' as const },
                    { id: 'status-option', name: fields.status[0], color: fields.status[1] },
                    { id: 'status-review', name: 'In review', color: 'BLUE' as const },
                    { id: 'status-done', name: 'Done', color: 'GREEN' as const },
                ].filter((option, index, all) => all.findIndex(other => other.name === option.name) === index),
            },
            ...(fields.priority
                ? [
                      {
                          kind: 'singleSelect' as const,
                          id: 'priority',
                          name: 'Priority',
                          options: [
                              { id: 'priority-urgent', name: 'Urgent', color: 'RED' as const },
                              { id: 'priority-high', name: 'High', color: 'ORANGE' as const },
                              { id: 'priority-medium', name: 'Medium', color: 'YELLOW' as const },
                              { id: 'priority-low', name: 'Low', color: 'GRAY' as const },
                          ],
                      },
                  ]
                : []),
            ...(fields.estimate === undefined
                ? []
                : [
                      {
                          kind: 'iteration' as const,
                          id: 'iteration',
                          name: 'Iteration',
                          iterations: [sprint],
                          completedIterations: [],
                      },
                  ]),
            ...(fields.estimate === undefined ? [] : [{ kind: 'number' as const, id: 'estimate', name: 'Estimate' }]),
            ...(fields.severity ? [{ kind: 'text' as const, id: 'severity', name: 'Severity' }] : []),
        ],
        values: {
            status: {
                kind: 'singleSelect',
                optionId: 'status-option',
                name: fields.status[0],
                color: fields.status[1],
            },
            ...(fields.priority
                ? {
                      priority: {
                          kind: 'singleSelect',
                          optionId: 'priority-high',
                          name: fields.priority,
                          color: 'ORANGE',
                      },
                  }
                : {}),
            ...(fields.estimate === undefined
                ? {}
                : {
                      iteration: {
                          kind: 'iteration',
                          iterationId: sprint.id,
                          title: sprint.title,
                          startDate: sprint.startDate,
                          duration: sprint.duration,
                      },
                      estimate: { kind: 'number', number: fields.estimate },
                  }),
            ...(fields.severity ? { severity: { kind: 'text', text: fields.severity } } : {}),
        },
    };
    return sample;
}
