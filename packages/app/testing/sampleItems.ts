import type { IssueItem, PullRequestItem } from '@/store/ItemTypes.js';

/** An open issue for tests and stories, told apart by its node id. */
export function sampleIssue(id: string): IssueItem {
    return {
        kind: 'issue',
        id,
        url: `https://github.com/acme/web/issues/${id}`,
        number: 1,
        title: `Issue ${id}`,
        state: 'OPEN',
        stateReason: null,
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-20T10:00:00Z',
        closedAt: null,
        author: { login: 'octocat', avatarUrl: 'https://avatars.test/octocat' },
        assignees: [],
        labels: [],
        milestone: null,
        issueType: null,
        commentCount: 0,
        subIssues: { total: 0, completed: 0 },
        repository: { nameWithOwner: 'acme/web', owner: 'acme', isPrivate: false, viewerPermission: 'WRITE' },
        projects: [],
    };
}

/** An open pull request for tests and stories, told apart by its node id: no checks, no review asked yet. */
export function samplePullRequest(id: string): PullRequestItem {
    return {
        kind: 'pullRequest',
        id,
        url: `https://github.com/acme/web/pull/${id}`,
        number: 2,
        title: `Pull request ${id}`,
        state: 'OPEN',
        isDraft: false,
        merged: false,
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-20T10:00:00Z',
        closedAt: null,
        author: { login: 'octocat', avatarUrl: 'https://avatars.test/octocat' },
        assignees: [],
        labels: [],
        milestone: null,
        commentCount: 0,
        repository: { nameWithOwner: 'acme/web', owner: 'acme', isPrivate: false, viewerPermission: 'WRITE' },
        projects: [],
        additions: 10,
        deletions: 2,
        changedFiles: 1,
        headRefName: 'feature',
        baseRefName: 'main',
        closingIssueIds: [],
        reviewDecision: null,
        mergeable: 'MERGEABLE',
        mergeStateStatus: 'CLEAN',
        checks: null,
        reviewRequests: [],
        latestReviews: [],
    };
}
