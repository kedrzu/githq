import type { GitHubMock } from '../github/GitHubMock.js';

/** The merges the app asked GitHub for (`PUT …/merge-async`), by their bodies, oldest first. */
export function getMergeRequests(github: GitHubMock): unknown[] {
    return github.restCalls
        .filter(call => call.method === 'PUT' && call.url.pathname.endsWith('/merge-async'))
        .map(call => call.body);
}
