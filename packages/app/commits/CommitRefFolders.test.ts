/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { createTestSession } from '@/testing/createTestSession.js';

import { CommitRefFolders } from './CommitRefFolders.js';

test('a repository keeps its own unfolded folders, for the user on it, until they sign out', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const folders = session.container.resolve(CommitRefFolders);
    const present = ['branches:feat', 'tags:v1'];

    folders.toggle('octocat/app', 'branches:feat', present);
    folders.toggle('octocat/docs', 'tags:v1', present);
    expect(folders.isUnfolded('octocat/app', 'branches:feat')).toBe(true);
    expect(folders.isUnfolded('octocat/app', 'tags:v1')).toBe(false);
    expect(folders.isUnfolded('octocat/docs', 'tags:v1')).toBe(true);

    folders.toggle('octocat/app', 'branches:feat', present);
    expect(folders.isUnfolded('octocat/app', 'branches:feat')).toBe(false);
    folders.toggle('octocat/app', 'branches:feat', present);

    session.signInFromAnotherTab('hubot');
    expect(folders.isUnfolded('octocat/app', 'branches:feat')).toBe(false);
    session.signInFromAnotherTab('octocat');
    expect(folders.isUnfolded('octocat/app', 'branches:feat')).toBe(true);

    session.signOutFromAnotherTab();
    session.signInFromAnotherTab('octocat');
    expect(folders.isUnfolded('octocat/app', 'branches:feat')).toBe(false);
});

test('the folders are kept in this browser under the user, never in the synced settings', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const folders = session.container.resolve(CommitRefFolders);

    folders.toggle('octocat/app', 'branches:feat', null);

    expect(JSON.parse(session.localStorage.get('githq.refFolders.octocat') ?? 'null')).toEqual({
        'octocat/app': ['branches:feat'],
    });
});

test('toggling with the folders on screen drops the absent ones and keeps the present ones', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const folders = session.container.resolve(CommitRefFolders);

    folders.toggle('octocat/app', 'branches:gone', null);
    folders.toggle('octocat/app', 'branches:feat', null);
    folders.toggle('octocat/app', 'tags:v1', ['branches:feat', 'tags:v1']);

    expect(folders.isUnfolded('octocat/app', 'branches:gone')).toBe(false);
    expect(folders.isUnfolded('octocat/app', 'branches:feat')).toBe(true);
    expect(folders.isUnfolded('octocat/app', 'tags:v1')).toBe(true);
});

test('toggling without a complete read forgets nothing', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const folders = session.container.resolve(CommitRefFolders);

    folders.toggle('octocat/app', 'branches:old', null);
    folders.toggle('octocat/app', 'branches:feat', null);

    expect(folders.isUnfolded('octocat/app', 'branches:old')).toBe(true);
    expect(folders.isUnfolded('octocat/app', 'branches:feat')).toBe(true);
});

test('what is stored but not a map of path lists is ignored', () => {
    const stored = JSON.stringify({ 'a/b': ['tags:x'], 'a/c': 'tags:x', 'a/d': [1] });
    const session = createTestSession({
        login: 'octocat',
        answer: () => undefined,
        localStorage: new Map([['githq.refFolders.octocat', stored]]),
    });
    const folders = session.container.resolve(CommitRefFolders);

    session.signInFromAnotherTab('octocat');

    expect(folders.isUnfolded('a/b', 'tags:x')).toBe(true);
    expect(folders.isUnfolded('a/c', 'tags:x')).toBe(false);
    expect(folders.isUnfolded('a/d', '1')).toBe(false);
});
