/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { sampleIssue, samplePullRequest } from '@/testing/sampleItems.js';
import type { Item } from '@/store/ItemTypes.js';
import type { RepositoryDownloadPhase, RepositorySyncState } from '@/tracking/TrackingTypes.js';
import { buildRepositoryWorkflows } from '@/workflows/buildRepositoryWorkflows.js';

import type { RepositorySectionCounts } from './getRepositorySectionCounts.js';
import { getRepositorySectionCounts } from './getRepositorySectionCounts.js';

const ITEMS: readonly Item[] = [
    sampleIssue('I_1'),
    sampleIssue('I_2'),
    { ...sampleIssue('I_3'), state: 'CLOSED' },
    samplePullRequest('PR_1'),
    { ...samplePullRequest('PR_2'), state: 'MERGED' },
];

test('first run and loading D4: a section has no count until its download has read its open items, then its open ones', () => {
    expect(count(ITEMS, undefined)).toEqual({ issues: null, pullRequests: null, workflows: 'unknown' });
    // Open pull requests downloading: the open issues are all in, the open pull requests are not.
    expect(count(ITEMS, sync('openPullRequests'))).toEqual({ issues: 2, pullRequests: null, workflows: 'unknown' });

    const expected: RepositorySectionCounts = { issues: 2, pullRequests: 1, workflows: 'unknown' };
    expect(count(ITEMS, sync('closedIssues'))).toEqual(expected);
    expect(count([], sync('done'))).toEqual({ issues: 0, pullRequests: 0, workflows: 'unknown' });
});

test('first run and loading D6: GitHub hiding the repository leaves no count of what none is held of', () => {
    const hidden = { ...sync('openIssues'), hidden: true };
    expect(count([], hidden)).toEqual({ issues: null, pullRequests: null, workflows: 'unknown' });
    expect(count(ITEMS, hidden)).toEqual({ issues: 2, pullRequests: 1, workflows: 'unknown' });
});

function count(items: readonly Item[], state: RepositorySyncState | undefined) {
    return getRepositorySectionCounts({
        items,
        sync: state,
        workflows: buildRepositoryWorkflows({ stored: undefined, settings: { defaultBranch: true, refs: [] }, now: 0 }),
    });
}

function sync(phase: RepositoryDownloadPhase | 'done'): RepositorySyncState {
    return {
        kind: 'repository',
        nameWithOwner: 'acme/web',
        phase,
        cursor: null,
        counts: {},
        since: null,
        etag: null,
        hidden: false,
        refused: null,
        lastSuccessAt: null,
    };
}
