import { expect, test } from 'bun:test';

import type { RepositoryPermission } from '@githq/github/generated.gen.js';

import type { Item } from '@/store/ItemTypes.js';
import { sampleIssue, samplePullRequest } from '@/testing/sampleItems.js';

import type { EditPermissions } from './getEditPermissions.js';
import { getEditPermissions, hasRole, NO_EDITS } from './getEditPermissions.js';

const VIEWER = 'kedrzu';

test('READ: comment on anything; close, reopen and ready for review only what the user opened', () => {
    const others = permissions(sampleIssue('I_1'), 'READ');
    const expected: EditPermissions = { ...NO_EDITS, comment: true, addToProject: true };
    expect(others).toEqual(expected);

    expect(permissions(mine(sampleIssue('I_2')), 'READ')).toEqual({ ...expected, state: true });
    expect(permissions({ ...mine(samplePullRequest('PR_1')), isDraft: true }, 'READ')).toEqual({
        ...expected,
        state: true,
        draft: true,
    });
});

test('TRIAGE: labels, assignees, milestone, close and reviewers of anything; the issue type and drafts need WRITE', () => {
    const issue = permissions(sampleIssue('I_1'), 'TRIAGE');
    expect(issue).toMatchObject({ labels: true, assignees: true, milestone: true, state: true, issueType: false });
    expect(permissions(samplePullRequest('PR_1'), 'TRIAGE')).toMatchObject({ reviewers: true, draft: false });

    expect(permissions(sampleIssue('I_1'), 'WRITE')).toMatchObject({ issueType: true });
    expect(permissions(samplePullRequest('PR_1'), 'WRITE')).toMatchObject({ draft: true, issueType: false });
});

test('nothing is editable in an archived repository, one GitHub does not say the role in, or of a merged pull request’s state', () => {
    expect(
        getEditPermissions({ item: sampleIssue('I_1'), viewerLogin: VIEWER, permission: 'ADMIN', archived: true }),
    ).toEqual(NO_EDITS);
    expect(permissions(sampleIssue('I_1'), null)).toEqual(NO_EDITS);
    expect(permissions({ ...samplePullRequest('PR_1'), merged: true, state: 'MERGED' }, 'ADMIN')).toMatchObject({
        state: false,
        draft: false,
        labels: true,
    });
});

test('a role is held at or above it: WRITE, MAINTAIN and ADMIN can push; no role holds none', () => {
    expect(hasRole('WRITE', 'WRITE')).toBe(true);
    expect(hasRole('MAINTAIN', 'WRITE')).toBe(true);
    expect(hasRole('ADMIN', 'WRITE')).toBe(true);
    expect(hasRole('TRIAGE_PLUS', 'WRITE')).toBe(false);
    expect(hasRole('READ', 'TRIAGE')).toBe(false);
    expect(hasRole(null, 'READ')).toBe(false);
    expect(hasRole(undefined, 'READ')).toBe(false);
});

function permissions(item: Item, permission: RepositoryPermission | null) {
    return getEditPermissions({ item, viewerLogin: VIEWER, permission });
}

function mine<T extends Item>(item: T): T {
    return { ...item, author: { login: VIEWER, avatarUrl: '' } };
}
