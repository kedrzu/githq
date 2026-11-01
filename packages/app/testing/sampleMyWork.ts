import { buildMyWork } from '@/myWork/buildMyWork.js';
import type { MyWork, MyWorkFilter } from '@/myWork/buildMyWork.js';
import type { MyWorkGroup, MyWorkMembership } from '@/store/ItemStoreTypes.js';
import type { IssueItem, Item, ItemBase, ItemProject, ItemUser, PullRequestItem } from '@/store/ItemTypes.js';
import { groupStacks } from '@/store/stacks/groupStacks.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import { sampleIssue, samplePullRequest } from './sampleItems.js';
import { SAMPLE_VIEWER } from './sampleViewer.js';

/** The moment the samples' ages are counted to. */
export const SAMPLE_NOW = Date.parse('2026-10-30T12:00:00Z');

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "My work" of the D1 mockup: every kind of row, a pull request nested under the issue it closes. */
export const D1_ITEMS: readonly Item[] = [
    pr('PR_482', 'skyline-labs/api', 482, 'Add rate-limit backoff to webhook worker', 2 * HOUR, {
        author: sampleUser('olam', '#7fb3d5'),
        additions: 214,
        deletions: 38,
        reviewDecision: 'REVIEW_REQUIRED',
        checks: { state: 'SUCCESS', passing: 4, failing: 0, pending: 0 },
    }),
    pr('PR_1203', 'skyline-labs/portal', 1203, 'Migrate booking calendar to new date picker', 5 * HOUR, {
        author: sampleUser('tw', '#c3a6f2'),
        additions: 1092,
        deletions: 640,
        checks: { state: 'PENDING', passing: 3, failing: 0, pending: 2 },
    }),
    pr('PR_15', 'kedrzu/githq', 15, 'IndexedDB store for issues and pull requests', 12 * MINUTE, {
        additions: 486,
        deletions: 12,
        reviewDecision: 'CHANGES_REQUESTED',
        checks: { state: 'FAILURE', passing: 5, failing: 2, pending: 0 },
    }),
    pr('PR_477', 'skyline-labs/api', 477, 'Retry Stripe webhook delivery on 5xx', 3 * HOUR, {
        additions: 58,
        deletions: 9,
        reviewDecision: 'APPROVED',
        checks: { state: 'SUCCESS', passing: 6, failing: 0, pending: 0 },
    }),
    pr('PR_18842', 'vitejs/vite', 18842, 'fix(css): preserve source maps for nested @import', DAY, {
        additions: 31,
        deletions: 4,
        reviewDecision: 'REVIEW_REQUIRED',
        reviewRequests: [{ kind: 'user', login: 'sapphi-red' }],
    }),
    issue('I_1187', 'skyline-labs/portal', 1187, 'Calendar shows wrong timezone for recurring bookings', 20 * MINUTE, {
        author: sampleUser('pnowak', '#81c995'),
        labels: [{ name: 'bug', color: 'e5534b' }],
        projects: [project('Platform Q4', 'In progress'), project('Bug triage', 'Confirmed')],
    }),
    pr('PR_1205', 'skyline-labs/portal', 1205, 'Fix timezone offset for recurring bookings', 20 * MINUTE, {
        closingIssueIds: ['I_1187'],
        checks: { state: 'PENDING', passing: 3, failing: 0, pending: 6 },
    }),
    issue('I_12', 'kedrzu/githq', 12, 'Background sync with conditional requests', DAY, {
        labels: [{ name: 'perf', color: 'd6a23a' }],
        projects: [project('githq Roadmap', 'Todo')],
    }),
    issue('I_9', 'kedrzu/githq', 9, 'Command palette: jump to issue by number', 2 * DAY, {
        labels: [{ name: 'feature', color: '3fb950' }],
    }),
    issue('I_31', 'kedrzu/skills', 31, 'design-doc: support multi-file briefs', 7 * DAY),
    issue('I_463', 'skyline-labs/api', 463, 'Webhook signatures fail behind the new proxy', 3 * HOUR, {
        author: sampleUser('olam', '#7fb3d5'),
        // No "Status" in its first project: the row shows the project marker and "+1" alone.
        projects: [project('Platform Q4', null), project('Bug triage', 'Confirmed')],
    }),
    pr('PR_94', 'skyline-labs/mobile', 94, 'Offline queue for booking edits', DAY, {
        author: sampleUser('tsw', '#f2b8a6'),
        isDraft: true,
        additions: 731,
        deletions: 88,
    }),
];

/** Which search found which item of {@link D1_ITEMS}. */
export const D1_MEMBERSHIP: MyWorkMembership = sampleMembership({
    reviewRequested: ['PR_482', 'PR_1203'],
    authored: ['PR_15', 'PR_477', 'PR_18842', 'PR_1205'],
    assigned: ['I_1187', 'I_12', 'I_9', 'I_31'],
    mentioned: ['I_463', 'PR_94', 'I_1187'],
});

/** "My work" of `items` and `groups` under `filter`, newest first. */
export function sampleMyWork(items: readonly Item[], groups: MyWorkMembership, filter: MyWorkFilter): MyWork {
    const byId = new Map(items.map(item => [item.id, item]));
    return buildMyWork({
        membership: groups,
        getItem: id => byId.get(id),
        stacks: groupStacks(items),
        filter,
        sort: 'updated',
    });
}

/** The membership of "my work" from lists of ids, every group arrived (empty unless listed). */
export function sampleMembership(groups: Partial<Record<MyWorkGroup, readonly string[]>>): MyWorkMembership {
    return {
        reviewRequested: new Set(groups.reviewRequested),
        authored: new Set(groups.authored),
        assigned: new Set(groups.assigned),
        mentioned: new Set(groups.mentioned),
    };
}

function issue(
    id: string,
    repository: string,
    number: number,
    title: string,
    age: number,
    overrides: Partial<IssueItem> = {},
): IssueItem {
    return { ...sampleIssue(id), ...common(repository, number, title, age), ...overrides };
}

function pr(
    id: string,
    repository: string,
    number: number,
    title: string,
    age: number,
    overrides: Partial<PullRequestItem> = {},
): PullRequestItem {
    return { ...samplePullRequest(id), ...common(repository, number, title, age), ...overrides };
}

function common(nameWithOwner: string, number: number, title: string, age: number): Partial<ItemBase> {
    const { owner } = parseRepositoryName(nameWithOwner);
    return {
        number,
        title,
        url: `https://github.com/${nameWithOwner}/issues/${number}`,
        updatedAt: new Date(SAMPLE_NOW - age).toISOString(),
        author: sampleUser(SAMPLE_VIEWER.login, '#d6a23a'),
        repository: { nameWithOwner, owner, isPrivate: false, viewerPermission: 'WRITE' },
    };
}

/** A user with a plain round avatar in `color`, drawn inline so stories need no network. */
export function sampleUser(login: string, color: string): ItemUser {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="${color}"/></svg>`;
    return { login, avatarUrl: `data:image/svg+xml,${encodeURIComponent(svg)}` };
}

function project(title: string, status: string | null): ItemProject {
    return {
        itemId: `PVTI_${title}`,
        projectId: `PVT_${title}`,
        title,
        number: 1,
        url: 'https://github.com/orgs/acme/projects/1',
        status: status === null ? null : { name: status, color: 'YELLOW', optionId: null },
        updatedAt: '2026-10-29T10:00:00Z',
    };
}
