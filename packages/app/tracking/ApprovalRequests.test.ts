/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { createTestSession, TEST_START } from '@/testing/createTestSession.js';

import { ApprovalRequests } from './ApprovalRequests.js';

test('a request is remembered for the user who made it, across reloads, and forgotten when they sign out', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const approvals = session.container.resolve(ApprovalRequests);

    approvals.record('acme');
    expect(approvals.getRequestedAt('acme')).toBe(TEST_START);
    expect(approvals.getRequestedAt('other')).toBeNull();

    // Another user in this browser has none of them.
    session.signInFromAnotherTab('hubot');
    expect(approvals.getRequestedAt('acme')).toBeNull();
    session.signInFromAnotherTab('octocat');
    expect(approvals.getRequestedAt('acme')).toBe(TEST_START);

    session.signOutFromAnotherTab();
    session.signInFromAnotherTab('octocat');
    expect(approvals.requests).toEqual({});
});
