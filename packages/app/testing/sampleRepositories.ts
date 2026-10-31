import type { ItemEditing } from '@/item/ItemEditing.js';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';

import { SAMPLE_NOW, sampleUser } from './sampleMyWork.js';
import { SAMPLE_VIEWER } from './sampleViewer.js';

/** What sigma-clinic/portal offers in the pickers, for stories: its labels, people, milestones and types. */
export const SAMPLE_PORTAL_METADATA: RepositoryMetadata = {
    nameWithOwner: 'sigma-clinic/portal',
    id: 'R_portal',
    viewerPermission: 'WRITE',
    hasIssuesEnabled: true,
    isArchived: false,
    labels: [
        { id: 'LA_bug', name: 'bug', color: 'e5534b', description: null },
        { id: 'LA_calendar', name: 'calendar', color: '4fb0c6', description: null },
        { id: 'LA_perf', name: 'perf', color: 'd6a23a', description: null },
        { id: 'LA_regression', name: 'regression', color: 'b60205', description: null },
        { id: 'LA_ux', name: 'ux', color: 'a57bf5', description: null },
    ],
    milestones: [
        { id: 'MI_42', title: 'v4.2 — November', dueOn: '2026-11-28T00:00:00Z' },
        { id: 'MI_43', title: 'v4.3 — December', dueOn: '2026-12-19T00:00:00Z' },
    ],
    assignableUsers: ['olam', 'pnowak', SAMPLE_VIEWER.login, 'tsw'].map(login => ({
        id: `U_${login}`,
        login,
        name: null,
        avatarUrl: sampleUser(login, '#81c995').avatarUrl,
    })),
    issueTypes: [
        { id: 'IT_bug', name: 'Bug', color: 'RED', description: null },
        { id: 'IT_feature', name: 'Feature', color: 'BLUE', description: null },
        { id: 'IT_task', name: 'Task', color: 'GRAY', description: null },
    ],
    fetchedAt: SAMPLE_NOW,
};

/** The item view's editing for a maintainer of sigma-clinic/portal: everything offered. */
export const SAMPLE_MAINTAINER_EDITING: ItemEditing = {
    permissions: {
        comment: true,
        labels: true,
        assignees: true,
        milestone: true,
        issueType: true,
        state: true,
        reviewers: true,
        draft: true,
        addToProject: true,
    },
    metadata: SAMPLE_PORTAL_METADATA,
    viewerLogin: SAMPLE_VIEWER.login,
    viewerProjects: [
        {
            id: 'PVT_roadmap',
            title: 'githq Roadmap',
            number: 2,
            url: 'https://github.com/users/kedrzu/projects/2',
            owner: 'kedrzu',
            closed: false,
        },
    ],
};

/** K1b: a contributor (READ) — they comment, and close or reopen what they opened; nothing else is offered. */
export const SAMPLE_CONTRIBUTOR_EDITING: ItemEditing = {
    ...SAMPLE_MAINTAINER_EDITING,
    permissions: {
        comment: true,
        labels: false,
        assignees: false,
        milestone: false,
        issueType: false,
        state: false,
        reviewers: false,
        draft: false,
        addToProject: true,
    },
    metadata: { ...SAMPLE_PORTAL_METADATA, viewerPermission: 'READ' },
};
