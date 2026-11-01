import type { IssueFieldsFragment, PullRequestFieldsFragment } from '@githq/github/generated.gen.js';

import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

/** What a sample row node differs by. */
export interface SampleRowNodeParams {
    /** `owner/name`. */
    readonly repository: string;
    readonly number: number;
    readonly updatedAt: string;
    readonly open?: boolean;
}

/** An issue as `IssueFields` reads it, for tests. */
export function sampleIssueNode(id: string, params: SampleRowNodeParams): IssueFieldsFragment {
    const { repository, number, updatedAt, open = true } = params;
    return {
        __typename: 'Issue',
        id,
        url: `https://github.com/${repository}/issues/${number}`,
        number,
        title: `Issue ${id}`,
        issueState: open ? 'OPEN' : 'CLOSED',
        stateReason: open ? null : 'COMPLETED',
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt,
        closedAt: open ? null : updatedAt,
        author: null,
        assignees: { nodes: [] },
        labels: { nodes: [] },
        milestone: null,
        issueType: null,
        comments: { totalCount: 0 },
        subIssuesSummary: { total: 0, completed: 0 },
        repository: toRepository(repository),
        projectItems: { nodes: [] },
    };
}

/** A pull request as `PullRequestFields` reads it, for tests. */
export function samplePullRequestNode(id: string, params: SampleRowNodeParams): PullRequestFieldsFragment {
    const { repository, number, updatedAt, open = true } = params;
    return {
        __typename: 'PullRequest',
        id,
        url: `https://github.com/${repository}/pull/${number}`,
        number,
        title: `Pull request ${id}`,
        state: open ? 'OPEN' : 'MERGED',
        isDraft: false,
        merged: !open,
        reviewDecision: null,
        mergeable: 'MERGEABLE',
        mergeStateStatus: 'CLEAN',
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt,
        closedAt: open ? null : updatedAt,
        additions: 1,
        deletions: 1,
        changedFiles: 1,
        headRefName: 'feature',
        baseRefName: 'main',
        author: null,
        assignees: { nodes: [] },
        labels: { nodes: [] },
        milestone: null,
        comments: { totalCount: 0 },
        closingIssuesReferences: { nodes: [] },
        repository: toRepository(repository),
        projectItems: { nodes: [] },
        statusCheckRollup: null,
        reviewRequests: { nodes: [] },
        latestOpinionatedReviews: { nodes: [] },
        stack: null,
        stackEntry: null,
        baseRefOid: 'base-oid',
        baseRef: { target: { oid: 'base-oid' } },
    };
}

function toRepository(nameWithOwner: string): IssueFieldsFragment['repository'] {
    return {
        nameWithOwner,
        isPrivate: false,
        viewerPermission: 'WRITE',
        owner: { login: parseRepositoryName(nameWithOwner).owner },
    };
}
