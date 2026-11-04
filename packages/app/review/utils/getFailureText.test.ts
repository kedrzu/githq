import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import { expect, test } from 'bun:test';

import { getFailureText } from './getFailureText.js';

test("GitHub's own words, without what the requester puts before them", () => {
    const graphql = new GitHubApiError({
        status: 200,
        message: 'GitHub GraphQL error: Not allowed; Try later',
        errors: [{ message: 'Not allowed' }, { message: 'Try later' }],
    });
    const rest = new GitHubApiError({ status: 403, message: 'whatever', githubMessage: 'Forbidden by GitHub' });
    const bare = new GitHubApiError({ status: 502, message: 'Bad gateway' });

    expect(getFailureText(graphql)).toBe('Not allowed; Try later');
    expect(getFailureText(rest)).toBe('Forbidden by GitHub');
    expect(getFailureText(bare)).toBe('Bad gateway');
    expect(getFailureText(new Error('Offline'))).toBe('Offline');
});
