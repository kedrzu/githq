/// <reference types="bun" />
import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import { expect, test } from 'bun:test';

import { getRerunReason } from './getRerunReason.js';
import type { WorkflowRerunReason } from './getRerunReason.js';

const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);

function refusal(status: number, githubMessage: string, retryAfter?: number) {
    return new GitHubApiError({ status, message: githubMessage, githubMessage, retryAfter });
}

const WORDS: readonly (readonly [string, WorkflowRerunReason])[] = [
    ['Must have admin rights to Repository.', { kind: 'noPermission' }],
    ['Resource not accessible by integration', { kind: 'noPermission' }],
    ['Unable to retry this workflow run because it was created over a month ago', { kind: 'tooOld' }],
    ['This workflow is already running', { kind: 'alreadyRunning' }],
    ['This workflow run cannot be retried', { kind: 'refused', message: 'This workflow run cannot be retried' }],
];

test.each(WORDS)('GitHub’s 403 “%s” is told by its words', (message, reason) => {
    expect(getRerunReason({ error: refusal(403, message), limit: null, now: NOW })).toEqual(reason);
});

test('no answer and a failure on GitHub’s side are no refusals', () => {
    expect(getRerunReason({ error: new TypeError('Failed to fetch'), limit: null, now: NOW })).toEqual({
        kind: 'unreachable',
    });
    expect(getRerunReason({ error: refusal(502, 'Bad gateway'), limit: null, now: NOW })).toEqual({
        kind: 'serverError',
        status: 502,
    });
});

test('refused for the rate, it says until when', () => {
    expect(
        getRerunReason({ error: refusal(403, 'You have exceeded a secondary rate limit', 60), limit: null, now: NOW }),
    ).toEqual({
        kind: 'allowance',
        until: NOW + 60_000,
    });
});

test('an organisation that has not approved githq is named', () => {
    const message =
        'Although you appear to have the correct authorization credentials, the `nzymejs` organization has enabled OAuth App access restrictions, meaning that data access to third-parties is limited.';
    expect(getRerunReason({ error: refusal(403, message), limit: null, now: NOW })).toEqual({
        kind: 'organizationRestricted',
        organization: 'nzymejs',
    });
});
