/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { samplePullRequest } from '@/testing/sampleItems.js';

import { getCommitEmails } from './getCommitEmails.js';

const PR = samplePullRequest('PR_1');
const AUTHOR = PR.author?.login ?? '';
const EMAILS = { viewerDefaultCommitEmail: 'a@x.dev', viewerPossibleCommitEmails: ['b@x.dev', 'a@x.dev', 'c@x.dev'] };

test('the default first, then the others', () => {
    expect(getCommitEmails({ emails: EMAILS, method: 'MERGE', pr: PR, viewerLogin: 'someone' })).toEqual([
        'a@x.dev',
        'b@x.dev',
        'c@x.dev',
    ]);
});

test('a squash only for the pull request’s author; a merge commit for anyone (D4)', () => {
    expect(getCommitEmails({ emails: EMAILS, method: 'SQUASH', pr: PR, viewerLogin: AUTHOR })).not.toBeNull();
    expect(getCommitEmails({ emails: EMAILS, method: 'SQUASH', pr: PR, viewerLogin: 'someone' })).toBeNull();
    expect(getCommitEmails({ emails: EMAILS, method: 'SQUASH', pr: PR, viewerLogin: null })).toBeNull();
});

test('none for a rebase, a queue branch or a stack, nor without a choice', () => {
    const viewerLogin = AUTHOR;
    expect(getCommitEmails({ emails: EMAILS, method: 'REBASE', pr: PR, viewerLogin })).toBeNull();
    expect(getCommitEmails({ emails: EMAILS, method: null, pr: PR, viewerLogin })).toBeNull();
    expect(
        getCommitEmails({ emails: EMAILS, method: 'MERGE', pr: { ...PR, isMergeQueueEnabled: true }, viewerLogin }),
    ).toBeNull();
    const stack = { id: 'S_1', number: 1, size: 2, position: 1 };
    expect(getCommitEmails({ emails: EMAILS, method: 'MERGE', pr: { ...PR, stack }, viewerLogin })).toBeNull();
    expect(getCommitEmails({ emails: null, method: 'MERGE', pr: PR, viewerLogin })).toBeNull();
    const one = { viewerDefaultCommitEmail: 'a@x.dev', viewerPossibleCommitEmails: ['a@x.dev'] };
    expect(getCommitEmails({ emails: one, method: 'MERGE', pr: PR, viewerLogin })).toBeNull();
    const noDefault = { viewerDefaultCommitEmail: null, viewerPossibleCommitEmails: ['a@x.dev', 'b@x.dev'] };
    expect(getCommitEmails({ emails: noDefault, method: 'MERGE', pr: PR, viewerLogin })).toBeNull();
});
