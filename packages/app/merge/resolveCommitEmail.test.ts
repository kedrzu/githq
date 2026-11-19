/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { resolveCommitEmail } from './resolveCommitEmail.js';
import type { ResolvedCommitEmail } from './resolveCommitEmail.js';

const GITHUB = 'me@users.noreply.github.com';
const WORK = 'me@work.test';
const PERSONAL = 'me@home.test';
const SETTINGS = { viewerDefaultCommitEmail: GITHUB, viewerPossibleCommitEmails: [GITHUB, WORK, PERSONAL] };

test('the repository wins over the owner, the owner over GitHub, and nothing chosen is GitHub', () => {
    const repository: ResolvedCommitEmail = { email: PERSONAL, source: 'repository' };
    expect(resolveCommitEmail({ repository: PERSONAL, owner: WORK, settings: SETTINGS })).toEqual(repository);
    expect(resolveCommitEmail({ repository: undefined, owner: WORK, settings: SETTINGS })).toEqual({
        email: WORK,
        source: 'owner',
    });
    expect(resolveCommitEmail({ repository: undefined, owner: null, settings: SETTINGS })).toEqual({
        email: GITHUB,
        source: 'github',
    });
});

test("an explicit GitHub default for the repository beats the owner's address and counts as the repository's", () => {
    expect(resolveCommitEmail({ repository: null, owner: WORK, settings: SETTINGS })).toEqual({
        email: GITHUB,
        source: 'repository',
    });
});

test('an address GitHub does not offer is skipped to the next level, never returned', () => {
    const gone = 'gone@old.test';
    expect(resolveCommitEmail({ repository: gone, owner: WORK, settings: SETTINGS })).toEqual({
        email: WORK,
        source: 'owner',
    });
    expect(resolveCommitEmail({ repository: gone, owner: gone, settings: SETTINGS })).toEqual({
        email: GITHUB,
        source: 'github',
    });
    expect(resolveCommitEmail({ repository: undefined, owner: gone, settings: SETTINGS })).toEqual({
        email: GITHUB,
        source: 'github',
    });
});

test('unknown settings or no GitHub default resolve to nothing', () => {
    expect(resolveCommitEmail({ repository: WORK, owner: WORK, settings: null })).toBeNull();
    const noDefault = { viewerDefaultCommitEmail: null, viewerPossibleCommitEmails: [WORK] };
    expect(resolveCommitEmail({ repository: WORK, owner: WORK, settings: noDefault })).toBeNull();
});
