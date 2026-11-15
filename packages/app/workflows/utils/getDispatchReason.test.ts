/// <reference types="bun" />
import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import { expect, test } from 'bun:test';

import { getDispatchReason } from './getDispatchReason.js';
import type { WorkflowDispatchReason } from './getDispatchReason.js';

const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);

test('a 422 says what GitHub said; 403 and 404 are told by their status', () => {
    const cases: readonly (readonly [number, string, WorkflowDispatchReason])[] = [
        [
            422,
            "Workflow does not have 'workflow_dispatch' trigger",
            { kind: 'refused', message: "Workflow does not have 'workflow_dispatch' trigger" },
        ],
        [
            422,
            'Unexpected inputs provided: ["nope"]',
            { kind: 'refused', message: 'Unexpected inputs provided: ["nope"]' },
        ],
        [403, 'Resource not accessible by integration', { kind: 'noPermission' }],
        [404, 'Not Found', { kind: 'notFound' }],
    ];
    for (const [status, message, reason] of cases) {
        const error = new GitHubApiError({ status, message, githubMessage: message });
        expect(getDispatchReason({ error, limit: null, now: NOW })).toEqual(reason);
    }
});

test('no answer and a failure on GitHub’s side are no refusals', () => {
    expect(getDispatchReason({ error: new TypeError('Failed to fetch'), limit: null, now: NOW })).toEqual({
        kind: 'unreachable',
    });
    const error = new GitHubApiError({ status: 502, message: 'Bad gateway' });
    expect(getDispatchReason({ error, limit: null, now: NOW })).toEqual({ kind: 'serverError', status: 502 });
});
