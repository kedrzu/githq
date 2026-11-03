/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { createTestSession } from '@/testing/createTestSession.js';

import { LastRepositoryTab } from './LastRepositoryTab.js';

test('a repository keeps its own section, for the user on it, until they sign out', () => {
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

test("a repository's link opens the section it was left on, Issues before it has one", () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const tabs = session.container.resolve(LastRepositoryTab);

    expect(tabs.getPath('octocat/app')).toBe('/octocat/app/issues');
    tabs.remember('octocat/app', 'pullRequests');
    expect(tabs.getPath('octocat/app')).toBe('/octocat/app/pulls');
    tabs.remember('octocat/app', 'commits');
    expect(tabs.getPath('octocat/app')).toBe('/octocat/app/commits');
    tabs.remember('octocat/app', 'issues');
    expect(tabs.getPath('octocat/app')).toBe('/octocat/app/issues');
});
