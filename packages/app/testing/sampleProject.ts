import type { Project, ProjectEntry, ProjectItem, ProjectView } from '@/projects/ProjectTypes.js';
import type { ProjectField, ProjectFieldOption, ProjectFieldValue } from '@/store/ItemDetailTypes.js';
import type { IssueItem, ItemLabel, ItemRepository, PullRequestItem } from '@/store/ItemTypes.js';

import { sampleIssue, samplePullRequest } from './sampleItems.js';
import { SAMPLE_NOW, sampleUser } from './sampleMyWork.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The user's day in the samples (`SAMPLE_NOW`): Sprint 14 runs. */
export const SAMPLE_TODAY = '2026-10-30';

const PORTAL: ItemRepository = {
    nameWithOwner: 'skyline-labs/portal',
    owner: 'skyline-labs',
    isPrivate: true,
    viewerPermission: 'WRITE',
};
const API: ItemRepository = { ...PORTAL, nameWithOwner: 'skyline-labs/api' };
/** A repository the user may only read: its items' project fields can still be set (`ui/project.md`). */
const MOBILE: ItemRepository = { ...PORTAL, nameWithOwner: 'skyline-labs/mobile', viewerPermission: 'READ' };

const BUG: ItemLabel = { name: 'bug', color: 'e5534b' };
const FEATURE: ItemLabel = { name: 'feature', color: '3fb950' };
const DOCS: ItemLabel = { name: 'docs', color: '4493f8' };
const BLOCKED: ItemLabel = { name: 'blocked', color: 'd6a23a' };

const KE = sampleUser('kedrzu', '#d6a23a');
const OM = sampleUser('olam', '#81c995');
const PN = sampleUser('pnowak', '#7fb3d5');

const TODO: ProjectFieldOption = { id: 'opt_todo', name: 'Todo', color: 'GRAY' };
const IN_PROGRESS: ProjectFieldOption = { id: 'opt_progress', name: 'In progress', color: 'YELLOW' };
const IN_REVIEW: ProjectFieldOption = { id: 'opt_review', name: 'In review', color: 'BLUE' };
const DONE: ProjectFieldOption = { id: 'opt_done', name: 'Done', color: 'GREEN' };
const URGENT: ProjectFieldOption = { id: 'opt_urgent', name: 'Urgent', color: 'RED' };
const HIGH: ProjectFieldOption = { id: 'opt_high', name: 'High', color: 'ORANGE' };
const MEDIUM: ProjectFieldOption = { id: 'opt_medium', name: 'Medium', color: 'YELLOW' };
const LOW: ProjectFieldOption = { id: 'opt_low', name: 'Low', color: 'GRAY' };

const SPRINT_13 = { id: 'it_13', title: 'Sprint 13', startDate: '2026-10-06', duration: 14 };
const SPRINT_14 = { id: 'it_14', title: 'Sprint 14', startDate: '2026-10-20', duration: 14 };
const SPRINT_15 = { id: 'it_15', title: 'Sprint 15', startDate: '2026-11-03', duration: 14 };

/** The sample project's fields: two single selects, an iteration, a number, a date and a text field. */
export const SAMPLE_PROJECT_FIELDS = {
    status: { kind: 'singleSelect', id: 'F_status', name: 'Status', options: [TODO, IN_PROGRESS, IN_REVIEW, DONE] },
    priority: { kind: 'singleSelect', id: 'F_priority', name: 'Priority', options: [URGENT, HIGH, MEDIUM, LOW] },
    iteration: {
        kind: 'iteration',
        id: 'F_iteration',
        name: 'Iteration',
        iterations: [SPRINT_14, SPRINT_15],
        completedIterations: [SPRINT_13],
    },
    estimate: { kind: 'number', id: 'F_estimate', name: 'Story points' },
    due: { kind: 'date', id: 'F_due', name: 'Due' },
    note: { kind: 'text', id: 'F_note', name: 'Note' },
} as const satisfies Record<string, ProjectField>;

const FIELDS: readonly ProjectField[] = [
    SAMPLE_PROJECT_FIELDS.status,
    SAMPLE_PROJECT_FIELDS.priority,
    SAMPLE_PROJECT_FIELDS.iteration,
    SAMPLE_PROJECT_FIELDS.estimate,
    SAMPLE_PROJECT_FIELDS.due,
    SAMPLE_PROJECT_FIELDS.note,
];

const TITLE_REF = { id: 'F_title', name: 'Title' };
const ASSIGNEES_REF = { id: 'F_assignees', name: 'Assignees' };
const LABELS_REF = { id: 'F_labels', name: 'Labels' };
const STATUS_REF = { id: 'F_status', name: 'Status' };
const PRIORITY_REF = { id: 'F_priority', name: 'Priority' };
const ESTIMATE_REF = { id: 'F_estimate', name: 'Story points' };

/** "Current sprint": this iteration's items as a list by Status, by Priority (D4). */
export const SAMPLE_VIEW_SPRINT: ProjectView = {
    id: 'PVTV_sprint',
    number: 1,
    name: 'Current sprint',
    layout: 'TABLE_LAYOUT',
    filter: 'iteration:@current',
    groupBy: [STATUS_REF],
    verticalGroupBy: [],
    sortBy: [{ field: PRIORITY_REF, direction: 'ASC' }],
    fields: [TITLE_REF, ASSIGNEES_REF, STATUS_REF, PRIORITY_REF, LABELS_REF, ESTIMATE_REF],
};

/** "Board": every item, a column per Status (D5). */
export const SAMPLE_VIEW_BOARD: ProjectView = {
    id: 'PVTV_board',
    number: 2,
    name: 'Board',
    layout: 'BOARD_LAYOUT',
    filter: null,
    groupBy: [],
    verticalGroupBy: [STATUS_REF],
    sortBy: [],
    fields: [TITLE_REF, ASSIGNEES_REF, PRIORITY_REF, LABELS_REF, ESTIMATE_REF],
};

/** "Next sprint": a filter githq can't evaluate, answered by GitHub (K6). */
export const SAMPLE_VIEW_NEXT: ProjectView = {
    id: 'PVTV_next',
    number: 3,
    name: 'Next sprint',
    layout: 'TABLE_LAYOUT',
    filter: 'iteration:@next no:linked-pull-requests',
    groupBy: [STATUS_REF],
    verticalGroupBy: [],
    sortBy: [{ field: PRIORITY_REF, direction: 'ASC' }],
    fields: [TITLE_REF, ASSIGNEES_REF, PRIORITY_REF, LABELS_REF],
};

/** "Blocked": nothing matches right now (K9). */
export const SAMPLE_VIEW_BLOCKED: ProjectView = {
    id: 'PVTV_blocked',
    number: 4,
    name: 'Blocked',
    layout: 'TABLE_LAYOUT',
    filter: 'iteration:@current label:blocked',
    groupBy: [STATUS_REF],
    verticalGroupBy: [],
    sortBy: [],
    fields: [TITLE_REF, ASSIGNEES_REF, PRIORITY_REF],
};

/** "Roadmap": a roadmap, shown as a list (githq has no roadmap). */
export const SAMPLE_VIEW_ROADMAP: ProjectView = {
    id: 'PVTV_roadmap',
    number: 5,
    name: 'Roadmap',
    layout: 'ROADMAP_LAYOUT',
    filter: null,
    groupBy: [],
    verticalGroupBy: [],
    sortBy: [],
    fields: [TITLE_REF, STATUS_REF],
};

/** Platform Q4 as D4 and D5 draw it. */
export const SAMPLE_PROJECT: Project = {
    id: 'PVT_q4',
    title: 'Platform Q4',
    number: 2,
    url: 'https://github.com/orgs/skyline-labs/projects/2',
    owner: 'skyline-labs',
    ownerKind: 'org',
    closed: false,
    viewerCanUpdate: true,
    fields: FIELDS,
    views: [SAMPLE_VIEW_SPRINT, SAMPLE_VIEW_BOARD, SAMPLE_VIEW_NEXT, SAMPLE_VIEW_BLOCKED, SAMPLE_VIEW_ROADMAP],
};

/** Docs revamp's one view: all its items, as a table. */
export const SAMPLE_VIEW_DOCS: ProjectView = {
    id: 'PVTV_docs_all',
    number: 1,
    name: 'All items',
    layout: 'TABLE_LAYOUT',
    filter: null,
    groupBy: [],
    verticalGroupBy: [],
    sortBy: [],
    fields: [TITLE_REF, { id: 'F_docs_due', name: 'Due' }, { id: 'F_pages', name: 'Pages' }],
};

/** Docs revamp (K7): only text, date and number fields — nothing to make board columns from. */
export const SAMPLE_PROJECT_WITHOUT_SELECT: Project = {
    id: 'PVT_docs',
    title: 'Docs revamp',
    number: 4,
    url: 'https://github.com/orgs/skyline-labs/projects/4',
    owner: 'skyline-labs',
    ownerKind: 'org',
    closed: false,
    viewerCanUpdate: true,
    fields: [
        { kind: 'text', id: 'F_owner', name: 'Owner' },
        { kind: 'date', id: 'F_docs_due', name: 'Due' },
        { kind: 'number', id: 'F_pages', name: 'Pages' },
    ],
    views: [SAMPLE_VIEW_DOCS],
};

/** Website relaunch (K8): a new project, nothing in it yet. */
export const SAMPLE_EMPTY_PROJECT: Project = {
    id: 'PVT_web',
    title: 'Website relaunch',
    number: 7,
    url: 'https://github.com/users/kedrzu/projects/7',
    owner: 'kedrzu',
    ownerKind: 'user',
    closed: false,
    viewerCanUpdate: true,
    fields: [SAMPLE_PROJECT_FIELDS.status],
    views: [
        {
            id: 'PVTV_web_1',
            number: 1,
            name: 'View 1',
            layout: 'TABLE_LAYOUT',
            filter: null,
            groupBy: [],
            verticalGroupBy: [],
            sortBy: [],
            fields: [TITLE_REF, STATUS_REF],
        },
    ],
};

/** Platform Q4's items: issues and pull requests from three repositories, and a draft issue. */
export const SAMPLE_PROJECT_ENTRIES: readonly ProjectEntry[] = [
    entry(
        issue('I_1187', 1187, 'Calendar shows wrong timezone for recurring bookings', 20 * 60_000, {
            labels: [BUG],
            assignees: [KE],
            issueType: { name: 'Bug', color: 'RED' },
        }),
        { status: IN_PROGRESS, priority: HIGH, iteration: SPRINT_14, estimate: 3, due: '2026-11-02' },
    ),
    entry(
        pullRequest('PR_1203', 1203, 'Migrate booking calendar to new date picker', 5 * HOUR, {
            assignees: [KE],
            checks: { state: 'PENDING', passing: 3, failing: 0, pending: 2 },
        }),
        { status: IN_PROGRESS, priority: MEDIUM, iteration: SPRINT_14, estimate: 5 },
    ),
    entry(issue('I_470', 470, 'Idempotency keys for payment intents', HOUR, { repository: API, assignees: [OM] }), {
        status: IN_PROGRESS,
        priority: URGENT,
        iteration: SPRINT_14,
        estimate: 3,
        note: 'needs API review',
    }),
    entry(
        pullRequest('PR_477', 477, 'Retry Stripe webhook delivery on 5xx', 3 * HOUR, {
            repository: API,
            assignees: [KE],
            reviewDecision: 'APPROVED',
        }),
        { status: IN_REVIEW, priority: HIGH, iteration: SPRINT_14, estimate: 2 },
    ),
    entry(
        issue('I_91', 91, 'Crash on Android 15 when opening receipts', HOUR, {
            repository: MOBILE,
            labels: [BUG],
            issueType: { name: 'Bug', color: 'RED' },
        }),
        { status: TODO, priority: URGENT, iteration: SPRINT_14, estimate: 2, due: '2026-10-30' },
    ),
    entry(issue('I_455', 455, 'Document webhook retry policy', 4 * DAY, { repository: API, labels: [DOCS] }), {
        status: TODO,
        priority: MEDIUM,
        iteration: SPRINT_15,
        estimate: 1,
    }),
    entry(issue('I_1210', 1210, 'Client switcher loses filter state', 6 * HOUR, { labels: [FEATURE] }), {
        status: TODO,
        priority: MEDIUM,
        iteration: SPRINT_15,
        estimate: 2,
    }),
    entry(
        issue('I_1150', 1150, 'Visits list loses its scroll position', 9 * DAY, {
            state: 'CLOSED',
            stateReason: 'COMPLETED',
            assignees: [PN],
        }),
        { status: DONE, priority: LOW, iteration: SPRINT_13, estimate: 1 },
    ),
    entry(issue('I_1220', 1220, 'Waiting list for fully booked days', 2 * DAY, { labels: [BLOCKED] }), {
        priority: LOW,
    }),
    {
        item: {
            itemId: 'PVTI_draft_1',
            projectId: 'PVT_q4',
            contentId: null,
            draft: {
                id: 'DI_1',
                title: 'Decide on retention policy for audit logs',
                body: 'Legal asked for **7 years**; storage says 2.',
                assignees: [],
                createdAt: new Date(SAMPLE_NOW - 9 * DAY).toISOString(),
            },
            values: toValues({ status: IN_PROGRESS, priority: LOW, iteration: SPRINT_14 }),
            updatedAt: new Date(SAMPLE_NOW - 9 * DAY).toISOString(),
            isArchived: false,
        },
        content: null,
    },
    entry(issue('I_1001', 1001, 'Old archived work', 40 * DAY, { state: 'CLOSED' }), { status: DONE }, true),
];

/** What a sample item's fields hold. */
interface SampleValues {
    readonly status?: ProjectFieldOption;
    readonly priority?: ProjectFieldOption;
    readonly iteration?: { id: string; title: string; startDate: string; duration: number };
    readonly estimate?: number;
    readonly due?: string;
    readonly note?: string;
}

function entry(content: IssueItem | PullRequestItem, values: SampleValues, isArchived = false): ProjectEntry {
    const item: ProjectItem = {
        itemId: `PVTI_${content.id}`,
        projectId: 'PVT_q4',
        contentId: content.id,
        draft: null,
        values: toValues(values),
        updatedAt: content.updatedAt,
        isArchived,
    };
    return {
        item,
        content: {
            ...content,
            projects: [
                {
                    itemId: item.itemId,
                    projectId: 'PVT_q4',
                    title: 'Platform Q4',
                    number: 2,
                    url: SAMPLE_PROJECT.url,
                    status: values.status
                        ? { name: values.status.name, color: values.status.color, optionId: values.status.id }
                        : null,
                    updatedAt: content.updatedAt,
                },
            ],
        },
    };
}

function toValues(values: SampleValues): Record<string, ProjectFieldValue> {
    const result: Record<string, ProjectFieldValue> = {};
    const { status, priority, iteration, estimate, due, note } = values;
    if (status) {
        result.F_status = { kind: 'singleSelect', optionId: status.id, name: status.name, color: status.color };
    }

    if (priority) {
        result.F_priority = { kind: 'singleSelect', optionId: priority.id, name: priority.name, color: priority.color };
    }

    if (iteration) {
        result.F_iteration = { kind: 'iteration', iterationId: iteration.id, ...iteration };
    }

    if (estimate != null) {
        result.F_estimate = { kind: 'number', number: estimate };
    }

    if (due) {
        result.F_due = { kind: 'date', date: due };
    }

    if (note) {
        result.F_note = { kind: 'text', text: note };
    }

    return result;
}

function issue(id: string, number: number, title: string, age: number, overrides: Partial<IssueItem> = {}): IssueItem {
    return {
        ...sampleIssue(id),
        number,
        title,
        url: `https://github.com/${(overrides.repository ?? PORTAL).nameWithOwner}/issues/${number}`,
        updatedAt: new Date(SAMPLE_NOW - age).toISOString(),
        repository: PORTAL,
        ...overrides,
    };
}

function pullRequest(
    id: string,
    number: number,
    title: string,
    age: number,
    overrides: Partial<PullRequestItem> = {},
): PullRequestItem {
    return {
        ...samplePullRequest(id),
        number,
        title,
        url: `https://github.com/${(overrides.repository ?? PORTAL).nameWithOwner}/pull/${number}`,
        updatedAt: new Date(SAMPLE_NOW - age).toISOString(),
        repository: PORTAL,
        ...overrides,
    };
}
