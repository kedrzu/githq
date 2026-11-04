import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { listPullRequestRenames } from './listPullRequestRenames.js';

const NEXT_URL = 'https://api.github.com/repositories/1/pulls/7/files?per_page=100&page=2';

test('reads every page, keeping only the files that came from another path', async () => {
    const requests: Parameters<Fetch>[] = [];
    const answers = [
        Response.json(
            [
                { filename: 'new.ts', previous_filename: 'old.ts', patch: '@@ -1 +1 @@' },
                { filename: 'same.ts', patch: '@@ -1 +1 @@' },
            ],
            { headers: { link: `<${NEXT_URL}>; rel="next"` } },
        ),
        Response.json([{ filename: 'copy.ts', previous_filename: 'source.ts' }]),
    ];
    const rest = createGitHubRestRequester({
        getToken: () => 'gho_token',
        fetch: (...request) => {
            requests.push(request);
            const answer = answers.shift();
            return answer ? Promise.resolve(answer) : Promise.reject(new Error('Asked too often'));
        },
    });

    const renames = await listPullRequestRenames(rest, { nameWithOwner: 'kedrzu/githq', number: 7 });

    expect(renames).toEqual(
        new Map([
            ['new.ts', 'old.ts'],
            ['copy.ts', 'source.ts'],
        ]),
    );
    expect(requests.map(([url]) => url)).toEqual([
        'https://api.github.com/repos/kedrzu/githq/pulls/7/files?per_page=100',
        NEXT_URL,
    ]);
});
