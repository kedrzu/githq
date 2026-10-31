import type { IssueItem, ItemLabel, ItemProject, ItemRepository, PullRequestItem } from '@/store/ItemTypes.js';

import { sampleIssue, samplePullRequest } from './sampleItems.js';
import { SAMPLE_NOW, sampleUser } from './sampleMyWork.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const PORTAL: ItemRepository = {
    nameWithOwner: 'sigma-clinic/portal',
    owner: 'sigma-clinic',
    isPrivate: true,
    viewerPermission: 'WRITE',
};

const BUG: ItemLabel = { name: 'bug', color: 'e5534b' };
const FEATURE: ItemLabel = { name: 'feature', color: '3fb950' };
const CALENDAR: ItemLabel = { name: 'calendar', color: '4493f8' };

const V42 = { title: 'v4.2 — November', dueOn: '2026-11-15' };
const V43 = { title: 'v4.3 — December', dueOn: '2026-12-13' };

const KE = sampleUser('kedrzu', '#d6a23a');
const JD = sampleUser('jdoe', '#7fb3d5');
const OM = sampleUser('olam', '#81c995');

/** The repository the samples are of. */
export const SAMPLE_REPOSITORY = PORTAL.nameWithOwner;

/**
 * A tracked repository as J1 and J2 draw it: issues in two milestones and none, with labels, types, assignees
 * and project row fields; a pull request; closed items that count towards the milestones' progress.
 */
export const SAMPLE_REPOSITORY_ITEMS: readonly (IssueItem | PullRequestItem)[] = [
    issue('I_1187', 1187, 'Calendar shows wrong timezone for recurring visits', 20 * 60_000, {
        milestone: V42,
        labels: [BUG, CALENDAR],
        assignees: [KE],
        issueType: { name: 'Bug', color: 'RED' },
        projects: [project('Platform Q4', 'In progress'), project('Bug triage', 'Confirmed')],
    }),
    issue('I_1199', 1199, 'Patient search ignores diacritics', DAY, {
        milestone: V42,
        labels: [{ name: 'search', color: 'a57bf5' }],
        assignees: [JD],
        issueType: { name: 'Bug', color: 'RED' },
        projects: [project('Platform Q4', 'In review')],
    }),
    issue('I_1210', 1210, 'Export visits as CSV', 2 * DAY, {
        milestone: V42,
        labels: [FEATURE],
        assignees: [OM],
        issueType: { name: 'Feature', color: 'BLUE' },
        projects: [project('Platform Q4', 'Todo')],
    }),
    issue('I_1150', 1150, 'Visits list loses its scroll position', 9 * DAY, { milestone: V42, state: 'CLOSED' }),
    issue('I_1215', 1215, 'Reschedule a visit by dragging it in the week view', 3 * DAY, {
        milestone: V43,
        labels: [FEATURE],
        issueType: { name: 'Feature', color: 'BLUE' },
        projects: [project('Platform Q4', 'Todo')],
    }),
    issue('I_1180', 1180, 'Flaky e2e: login redirect on Safari', 6 * DAY, {
        labels: [{ name: 'flaky', color: 'd6a23a' }],
        issueType: { name: 'Task', color: 'GRAY' },
        projects: [project('Bug triage', 'Confirmed')],
    }),
    pullRequest('PR_1203', 1203, 'Migrate appointment calendar to new date picker', 5 * HOUR, {
        labels: [CALENDAR],
        assignees: [KE],
        checks: { state: 'PENDING', passing: 3, failing: 0, pending: 2 },
    }),
];

function issue(id: string, number: number, title: string, age: number, overrides: Partial<IssueItem> = {}): IssueItem {
    return { ...sampleIssue(id), ...common(number, title, age), ...overrides };
}

function pullRequest(
    id: string,
    number: number,
    title: string,
    age: number,
    overrides: Partial<PullRequestItem> = {},
): PullRequestItem {
    return { ...samplePullRequest(id), ...common(number, title, age), ...overrides };
}

function common(number: number, title: string, age: number) {
    return {
        number,
        title,
        url: `https://github.com/${PORTAL.nameWithOwner}/issues/${number}`,
        updatedAt: new Date(SAMPLE_NOW - age).toISOString(),
        repository: PORTAL,
    };
}

function project(title: string, status: string): ItemProject {
    return {
        itemId: `PVTI_${title}`,
        projectId: `PVT_${title}`,
        title,
        number: 1,
        url: 'https://github.com/orgs/sigma-clinic/projects/1',
        status: { name: status, color: 'YELLOW', optionId: null },
        updatedAt: '2026-10-29T10:00:00Z',
    };
}
