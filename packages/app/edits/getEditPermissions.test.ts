import { expect, test } from 'bun:test';

import type { RepositoryPermission } from '@githq/github/generated.gen.js';

import type { Item } from '@/store/ItemTypes.js';
import { sampleIssue, samplePullRequest } from '@/testing/sampleItems.js';

import type { EditPermissions } from './getEditPermissions.js';
import { getEditPermissions, hasRole, NO_EDITS } from './getEditPermissions.js';

const VIEWER = 'kedrzu';

test('READ: comment on anything; close, reopen, ready for review and update the branch only of what the user opened', () => {
    const others = permissions(sampleIssue('I_1'), 'READ');
    const expected: EditPermissions = { ...NO_EDITS, comment: true, addToProject: true };
    expect(others).toEqual(expected);

    expect(permissions(mine(sampleIssue('I_2')), 'READ')).toEqual({ ...expected, state: true });
    expect(permissions({ ...mine(samplePullRequest('PR_1')), isDraft: true }, 'READ')).toEqual({
        ...expected,
        state: true,
        draft: true,
        updateBranch: true,
    });
});

test('TRIAGE: labels, assignees, milestone, close and reviewers of anything; the issue type and drafts need WRITE', () => {
    const issue = permissions(sampleIssue('I_1'), 'TRIAGE');
    expect(issue).toMatchObject({ labels: true, assignees: true, milestone: true, state: true, issueType: false });
    expect(permissions(samplePullRequest('PR_1'), 'TRIAGE')).toMatchObject({ reviewers: true, draft: false });

    expect(permissions(sampleIssue('I_1'), 'WRITE')).toMatchObject({ issueType: true });
    expect(permissions(samplePullRequest('PR_1'), 'WRITE')).toMatchObject({ draft: true, issueType: false });
});

test('updating the branch pushes to it: an open pull request, by WRITE and above or its author', () => {
    const pr = samplePullRequest('PR_1');
    expect(permissions(pr, 'TRIAGE')).toMatchObject({ updateBranch: false });
    expect(permissions(pr, 'WRITE')).toMatchObject({ updateBranch: true });
    expect(permissions({ ...pr, state: 'MERGED', merged: true }, 'ADMIN')).toMatchObject({ updateBranch: false });
    expect(permissions(sampleIssue('I_1'), 'ADMIN')).toMatchObject({ updateBranch: false });
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

test('merging: an open pull request, not merged nor being merged, by WRITE, MAINTAIN or ADMIN; the panel opens while it is being merged', () => {
    const pr = samplePullRequest('PR_1');
    const both = { mergePanel: true, merge: true };
    const neither = { mergePanel: false, merge: false };
    for (const role of ['WRITE', 'MAINTAIN', 'ADMIN'] as const) {
        expect(permissions(pr, role)).toMatchObject(both);
    }

    for (const role of ['READ', 'TRIAGE', 'TRIAGE_PLUS', null] as const) {
        expect(permissions(mine(pr), role)).toMatchObject(neither);
    }

    expect(permissions({ ...pr, state: 'CLOSED' }, 'ADMIN')).toMatchObject(neither);
    expect(permissions({ ...pr, state: 'MERGED', merged: true }, 'ADMIN')).toMatchObject(neither);
    // PM24: the panel shows the merge on its way; nothing is sent again.
    expect(permissions({ ...pr, merging: 'SQUASH' }, 'ADMIN')).toMatchObject({ mergePanel: true, merge: false });
    expect(permissions({ ...pr, merging: 'SQUASH' }, 'TRIAGE')).toMatchObject(neither);
    expect(permissions(sampleIssue('I_1'), 'ADMIN')).toMatchObject(neither);
    expect(getEditPermissions({ item: pr, viewerLogin: VIEWER, permission: 'ADMIN', archived: true })).toMatchObject(
        neither,
    );
});

test('any open pull request of a stack may open the merge panel, whatever its place (stacked PRs D11)', () => {
    const pr = samplePullRequest('PR_1');
    const stack = { id: 'PRS_1', number: 3, size: 3 };

    for (const position of [1, 2, 3]) {
        expect(permissions({ ...pr, stack: { ...stack, position } }, 'ADMIN')).toMatchObject({
            mergePanel: true,
            merge: true,
        });
    }

    expect(permissions({ ...pr, stack: { ...stack, position: 2 } }, 'TRIAGE')).toMatchObject({
        mergePanel: false,
        merge: false,
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
