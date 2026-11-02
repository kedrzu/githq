/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { createTestSession } from '@/testing/createTestSession.js';

import { LastRepositoryTab } from './LastRepositoryTab.js';

test('a repository keeps its own tab, for the user on it, until they sign out', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const tabs = session.container.resolve(LastRepositoryTab);

    tabs.remember('octocat/app', 'pullRequests');
    tabs.remember('octocat/docs', 'issues');
    expect(tabs.get('octocat/app')).toBe('pullRequests');
    expect(tabs.get('octocat/docs')).toBe('issues');
    expect(tabs.get('octocat/other')).toBeNull();

    session.signInFromAnotherTab('hubot');
    expect(tabs.get('octocat/app')).toBeNull();
    session.signInFromAnotherTab('octocat');
    expect(tabs.get('octocat/app')).toBe('pullRequests');

    session.signOutFromAnotherTab();
    session.signInFromAnotherTab('octocat');
    expect(tabs.get('octocat/app')).toBeNull();
});
