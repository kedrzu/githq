/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { IssueFieldsFragment, PullRequestFieldsFragment } from '@githq/github/generated.gen.js';

import { samplePullRequestNode } from '@/testing/sampleRowNodes.js';

import type { IssueItem, PullRequestItem } from './ItemTypes.js';
import { toItem } from './toItem.js';

const REPOSITORY: IssueFieldsFragment['repository'] = {
    nameWithOwner: 'acme/web',
    isPrivate: true,
    viewerPermission: 'WRITE',
    owner: { login: 'acme' },
};

const OCTOCAT = { login: 'octocat', avatarUrl: 'https://avatars.test/octocat' };

test('an issue keeps its row fields, its state from the `issueState` alias, and only the projects it is not archived in', () => {
    const node: IssueFieldsFragment = {
        __typename: 'Issue',
        id: 'I_1',
        url: 'https://github.com/acme/web/issues/12',
        number: 12,
        title: 'Login loops',
        issueState: 'CLOSED',
        stateReason: 'NOT_PLANNED',
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-20T10:00:00Z',
        closedAt: '2026-10-20T10:00:00Z',
        author: null,
        assignees: { nodes: [OCTOCAT, null] },
        labels: { nodes: [{ name: 'bug', color: 'd73a4a' }, null] },
        milestone: { title: 'v1', dueOn: '2026-11-01T00:00:00Z' },
        issueType: { name: 'Bug', color: 'RED' },
        comments: { totalCount: 3 },
        subIssuesSummary: { total: 4, completed: 1 },
        repository: REPOSITORY,
        projectItems: {
            nodes: [
                {
                    id: 'PVTI_1',
                    isArchived: false,
                    updatedAt: '2026-10-19T10:00:00Z',
                    project: {
                        id: 'PVT_1',
                        title: 'Roadmap',
                        number: 3,
                        url: 'https://github.com/orgs/acme/projects/3',
                    },
                    fieldValueByName: { name: 'In progress', color: 'YELLOW', optionId: 'opt1' },
                },
                {
                    id: 'PVTI_2',
                    isArchived: true,
                    updatedAt: '2026-10-19T10:00:00Z',
                    project: { id: 'PVT_2', title: 'Old', number: 1, url: 'https://github.com/orgs/acme/projects/1' },
                    fieldValueByName: null,
                },
                {
                    id: 'PVTI_3',
                    isArchived: false,
                    updatedAt: '2026-10-18T10:00:00Z',
                    project: { id: 'PVT_3', title: 'Bugs', number: 4, url: 'https://github.com/orgs/acme/projects/4' },
                    // "Status" is not a single-select field in this project.
                    fieldValueByName: {},
                },
            ],
        },
    };

    const expected: IssueItem = {
        kind: 'issue',
        id: 'I_1',
        url: 'https://github.com/acme/web/issues/12',
        number: 12,
        title: 'Login loops',
        state: 'CLOSED',
        stateReason: 'NOT_PLANNED',
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-20T10:00:00Z',
        closedAt: '2026-10-20T10:00:00Z',
        author: null,
        assignees: [OCTOCAT],
        labels: [{ name: 'bug', color: 'd73a4a' }],
        milestone: { title: 'v1', dueOn: '2026-11-01T00:00:00Z' },
        issueType: { name: 'Bug', color: 'RED' },
        commentCount: 3,
        subIssues: { total: 4, completed: 1 },
        repository: { nameWithOwner: 'acme/web', owner: 'acme', isPrivate: true, viewerPermission: 'WRITE' },
        projects: [
            {
                itemId: 'PVTI_1',
                projectId: 'PVT_1',
                title: 'Roadmap',
                number: 3,
                url: 'https://github.com/orgs/acme/projects/3',
                status: { name: 'In progress', color: 'YELLOW', optionId: 'opt1' },
                updatedAt: '2026-10-19T10:00:00Z',
            },
            {
                itemId: 'PVTI_3',
                projectId: 'PVT_3',
                title: 'Bugs',
                number: 4,
                url: 'https://github.com/orgs/acme/projects/4',
                status: null,
                updatedAt: '2026-10-18T10:00:00Z',
            },
        ],
    };
    expect(toItem(node)).toEqual(expected);
});

test('a pull request counts its checks by outcome and keeps reviews, review requests (users and teams) and closed issues', () => {
    const node: PullRequestFieldsFragment = {
        __typename: 'PullRequest',
        id: 'PR_1',
        url: 'https://github.com/acme/web/pull/40',
        number: 40,
        title: 'Fix the login loop',
        state: 'OPEN',
        isDraft: true,
        merged: false,
        reviewDecision: 'CHANGES_REQUESTED',
        mergeable: 'CONFLICTING',
        mergeStateStatus: 'DIRTY',
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: '2026-10-21T10:00:00Z',
        closedAt: null,
        additions: 120,
        deletions: 30,
        changedFiles: 7,
        headRefName: 'fix/login',
        baseRefName: 'main',
        author: OCTOCAT,
        assignees: { nodes: null },
        labels: null,
        milestone: null,
        comments: { totalCount: 0 },
        closingIssuesReferences: { nodes: [{ id: 'I_1' }, null, { id: 'I_2' }] },
        repository: REPOSITORY,
        projectItems: null,
        statusCheckRollup: {
            state: 'FAILURE',
            contexts: {
                checkRunCountsByState: [
                    { state: 'SUCCESS', count: 3 },
                    { state: 'SKIPPED', count: 1 },
                    { state: 'FAILURE', count: 1 },
                    { state: 'TIMED_OUT', count: 1 },
                    { state: 'IN_PROGRESS', count: 2 },
                    { state: 'QUEUED', count: 1 },
                ],
                statusContextCountsByState: [
                    { state: 'SUCCESS', count: 1 },
                    { state: 'ERROR', count: 1 },
                    { state: 'EXPECTED', count: 1 },
                ],
            },
        },
        reviewRequests: {
            nodes: [
                { requestedReviewer: { login: 'hubot' } },
                { requestedReviewer: { slug: 'frontend', name: 'Frontend' } },
                // A bot or a mannequin.
                { requestedReviewer: {} },
                { requestedReviewer: null },
            ],
        },
        latestOpinionatedReviews: {
            nodes: [
                { author: { login: 'monalisa' }, state: 'CHANGES_REQUESTED' },
                { author: null, state: 'APPROVED' },
            ],
        },
        stack: null,
        stackEntry: null,
        baseRefOid: 'a1',
        baseRef: { target: { oid: 'a1' } },
    };

    const expected: PullRequestItem = {
        kind: 'pullRequest',
        id: 'PR_1',
        url: 'https://github.com/acme/web/pull/40',
        number: 40,
        title: 'Fix the login loop',
        state: 'OPEN',
        isDraft: true,
        merged: false,
        reviewDecision: 'CHANGES_REQUESTED',
        mergeable: 'CONFLICTING',
        mergeStateStatus: 'DIRTY',
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: '2026-10-21T10:00:00Z',
        closedAt: null,
        additions: 120,
        deletions: 30,
        changedFiles: 7,
        headRefName: 'fix/login',
        baseRefName: 'main',
        author: OCTOCAT,
        assignees: [],
        labels: [],
        milestone: null,
        commentCount: 0,
        closingIssueIds: ['I_1', 'I_2'],
        repository: { nameWithOwner: 'acme/web', owner: 'acme', isPrivate: true, viewerPermission: 'WRITE' },
        projects: [],
        checks: { state: 'FAILURE', passing: 5, failing: 3, pending: 4 },
        reviewRequests: [
            { kind: 'user', login: 'hubot' },
            { kind: 'team', slug: 'frontend', name: 'Frontend' },
        ],
        latestReviews: [
            { author: 'monalisa', state: 'CHANGES_REQUESTED' },
            { author: null, state: 'APPROVED' },
        ],
        stack: null,
        behindBase: false,
    };
    expect(toItem(node)).toEqual(expected);
});

test('a pull request in a stack knows its place there, and is behind its base when the base branch moved past its base commit', () => {
    const node: PullRequestFieldsFragment = {
        ...samplePullRequestNode('PR_2', { repository: 'acme/web', number: 41, updatedAt: '2026-10-21T10:00:00Z' }),
        stack: { id: 'PRS_1', number: 3, size: 4 },
        stackEntry: { position: 2 },
        baseRefOid: 'a1',
        baseRef: { target: { oid: 'b2' } },
    };

    expect(toItem(node)).toMatchObject({
        stack: { id: 'PRS_1', number: 3, size: 4, position: 2 },
        behindBase: true,
    });
});

test('a pull request whose base branch is gone is not behind it', () => {
    const node: PullRequestFieldsFragment = {
        ...samplePullRequestNode('PR_3', { repository: 'acme/web', number: 42, updatedAt: '2026-10-21T10:00:00Z' }),
        baseRefOid: 'a1',
        baseRef: null,
    };

    expect(toItem(node)).toMatchObject({ stack: null, behindBase: false });
});

test('a node GitHub returns empty or null (deleted, or no longer visible) is no item', () => {
    expect(toItem(null)).toBeNull();
    expect(toItem({})).toBeNull();
});
