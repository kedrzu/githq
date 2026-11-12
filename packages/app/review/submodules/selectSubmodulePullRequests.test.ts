import type { CommitPullRequest } from '@githq/github/readCommitPullRequests.js';
import { expect, test } from 'bun:test';

import { selectSubmodulePullRequests } from './selectSubmodulePullRequests.js';

test('the open pull requests, drafts too, when any holds the commit; the merged ones otherwise; never a closed one', () => {
    const open = pullRequest(1, 'OPEN');
    const draft = { ...pullRequest(2, 'OPEN'), isDraft: true };
    const merged = pullRequest(3, 'MERGED');
    const closed = pullRequest(4, 'CLOSED');

    expect(selectSubmodulePullRequests([closed, merged, open, draft])).toEqual([open, draft]);
    expect(selectSubmodulePullRequests([closed, merged])).toEqual([merged]);
    expect(selectSubmodulePullRequests([closed])).toEqual([]);
});

function pullRequest(number: number, state: CommitPullRequest['state']): CommitPullRequest {
    return {
        number,
        state,
        title: `PR ${number}`,
        url: `https://github.com/kedrzu/nzyme/pull/${number}`,
        isDraft: false,
    };
}
