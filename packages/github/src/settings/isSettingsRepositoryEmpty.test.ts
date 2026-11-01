import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { createGitHubRestRequester } from '../rest/createGitHubRestRequester.js';
import { isSettingsRepositoryEmpty } from './isSettingsRepositoryEmpty.js';

test('a repository GitHub answers 409 for is empty; one with a commit is not', async () => {
    let asked = '';
    const empty = restAnswering(url => {
        asked = url;
        return Response.json({ message: 'Git Repository is empty.' }, { status: 409 });
    });
    const used = restAnswering(() => Response.json([{ sha: 'abc' }]));

    expect(await isSettingsRepositoryEmpty(empty, 'kedrzu')).toBe(true);
    expect(asked).toBe('https://api.github.com/repos/kedrzu/githq-settings/commits?per_page=1');
    expect(await isSettingsRepositoryEmpty(used, 'kedrzu')).toBe(false);
});

test('no repository is a refusal, not an empty one', async () => {
    const rest = restAnswering(() => Response.json({ message: 'Not Found' }, { status: 404 }));

    await expect(isSettingsRepositoryEmpty(rest, 'kedrzu')).rejects.toMatchObject({ status: 404 });
});

function restAnswering(answer: (url: string) => Response) {
    const fetch: Fetch = input => Promise.resolve(answer(input instanceof Request ? input.url : input.toString()));
    return createGitHubRestRequester({ getToken: () => 'token', fetch });
}
