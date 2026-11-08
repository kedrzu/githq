/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { RepositoryDownloadPhase, RepositorySyncState } from '@/tracking/TrackingTypes.js';

import { isRepositoryStateArriving } from './isRepositoryStateArriving.js';

test('first run and loading D5: a state is arriving until the download is past the phase reading the last of it', () => {
    expect(isRepositoryStateArriving(undefined, 'issue', 'open')).toBe(true);

    // Open pull requests downloading: open issues are in, open pull requests and anything closed are not.
    const openPullRequests = sync('openPullRequests');
    expect(isRepositoryStateArriving(openPullRequests, 'issue', 'open')).toBe(false);
    expect(isRepositoryStateArriving(openPullRequests, 'pullRequest', 'open')).toBe(true);
    expect(isRepositoryStateArriving(openPullRequests, 'issue', 'closed')).toBe(true);

    // Closed pull requests downloading: closed issues are in, so is Open and closed of issues; not of pull requests.
    const closedPullRequests = sync('closedPullRequests');
    expect(isRepositoryStateArriving(closedPullRequests, 'issue', 'all')).toBe(false);
    expect(isRepositoryStateArriving(closedPullRequests, 'pullRequest', 'open')).toBe(false);
    expect(isRepositoryStateArriving(closedPullRequests, 'pullRequest', 'all')).toBe(true);
    expect(isRepositoryStateArriving(closedPullRequests, 'pullRequest', 'closed')).toBe(true);

    expect(isRepositoryStateArriving(sync('done'), 'pullRequest', 'closed')).toBe(false);
});

test('a repository GitHub hides is not arriving: nothing more comes', () => {
    expect(isRepositoryStateArriving({ ...sync('openIssues'), hidden: true }, 'issue', 'open')).toBe(false);
});

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
