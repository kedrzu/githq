/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { ProjectItemDetailFieldsFragment, ThreadEventFieldsFragment } from '@githq/github/generated.gen.js';

import { sampleIssueDetailNode, samplePullRequestDetailNode } from '@/testing/sampleDetailNodes.js';

import type {
    ItemCheck,
    ItemDetailProject,
    ItemDetailReviewRequest,
    ItemReaction,
    ItemReviewSummary,
} from './ItemDetailTypes.js';
import { toItemDetail, toThreadEvent } from './toItemDetail.js';

const MONDAY = '2026-10-26T10:00:00Z';
const FETCHED_AT = Date.UTC(2026, 9, 30, 13, 0, 0);

test("neutral and skipped runs are told alike in a pull request's row and its detail: skipped in the list, passing in the counts", () => {
    const node = samplePullRequestDetailNode('PR_1', MONDAY);
    const run = {
        __typename: 'CheckRun' as const,
        detailsUrl: null,
        startedAt: MONDAY,
        completedAt: MONDAY,
        checkSuite: { workflowRun: null },
        status: 'COMPLETED' as const,
    };
    const detail = toItemDetail(
        {
            ...node,
            statusCheckRollup: {
                state: 'SUCCESS',
                contexts: {
                    checkRunCountsByState: [
                        { state: 'SUCCESS', count: 1 },
                        { state: 'NEUTRAL', count: 1 },
                        { state: 'SKIPPED', count: 1 },
                    ],
                    statusContextCountsByState: [],
                },
                contextPage: {
                    totalCount: 3,
                    nodes: [
                        { ...run, id: 'C_ok', name: 'build', conclusion: 'SUCCESS' },
                        { ...run, id: 'C_neutral', name: 'lint', conclusion: 'NEUTRAL' },
                        { ...run, id: 'C_skipped', name: 'deploy', conclusion: 'SKIPPED' },
                    ],
                },
            },
        },
        FETCHED_AT,
    );

    if (detail?.kind !== 'pullRequest' || detail.item.kind !== 'pullRequest') {
        throw new Error('Expected a pull request');
    }

    expect(detail.checks.map(check => check.state)).toEqual(['passing', 'skipped', 'skipped']);
    expect(detail.item.checks).toEqual({ state: 'SUCCESS', passing: 3, failing: 0, pending: 0 });
});

test("a pull request's checks are told passing, failing, pending or skipped from check runs and commit statuses alike", () => {
    const node = samplePullRequestDetailNode('PR_1', MONDAY);
    const run = {
        __typename: 'CheckRun' as const,
        detailsUrl: null,
        startedAt: MONDAY,
        completedAt: MONDAY,
        checkSuite: { workflowRun: { workflow: { name: 'CI' } } },
    };
    const status = { __typename: 'StatusContext' as const, targetUrl: 'https://ci.test/1', createdAt: MONDAY };
    const detail = toItemDetail(
        {
            ...node,
            statusCheckRollup: {
                state: 'FAILURE',
                contexts: { checkRunCountsByState: [], statusContextCountsByState: [] },
                contextPage: {
                    totalCount: 140,
                    nodes: [
                        { ...run, id: 'C_ok', name: 'build', status: 'COMPLETED', conclusion: 'SUCCESS' },
                        { ...run, id: 'C_running', name: 'test', status: 'IN_PROGRESS', conclusion: null },
                        { ...run, id: 'C_neutral', name: 'lint', status: 'COMPLETED', conclusion: 'NEUTRAL' },
                        { ...run, id: 'C_skipped', name: 'deploy', status: 'COMPLETED', conclusion: 'SKIPPED' },
                        { ...run, id: 'C_timeout', name: 'e2e', status: 'COMPLETED', conclusion: 'TIMED_OUT' },
                        { ...status, id: 'S_error', context: 'ci/legacy', state: 'ERROR' },
                        { ...status, id: 'S_expected', context: 'ci/required', state: 'EXPECTED' },
                        null,
                    ],
                },
            },
        },
        FETCHED_AT,
    );

    expect(detail?.kind).toBe('pullRequest');
    const checks = detail?.kind === 'pullRequest' ? detail.checks : [];
    expect(checks.map(check => [check.id, check.state])).toEqual([
        ['C_ok', 'passing'],
        ['C_running', 'pending'],
        ['C_neutral', 'skipped'],
        ['C_skipped', 'skipped'],
        ['C_timeout', 'failing'],
        ['S_error', 'failing'],
        ['S_expected', 'pending'],
    ]);
    const expectedStatus: ItemCheck = {
        id: 'S_error',
        kind: 'status',
        name: 'ci/legacy',
        workflow: null,
        state: 'failing',
        url: 'https://ci.test/1',
        startedAt: MONDAY,
        completedAt: null,
    };
    expect(checks[5]).toEqual(expectedStatus);
    expect(checks[0]?.workflow).toBe('CI');
    // GitHub cut the list: the count says how many there are.
    expect(detail?.kind === 'pullRequest' ? detail.checkCount : null).toBe(140);
});

test("a review summary keeps its text and id; one not submitted is nobody else's to read", () => {
    const review = {
        id: 'PRR_1',
        url: 'https://github.com/o/r/pull/1#pullrequestreview-1',
        author: null,
        state: 'CHANGES_REQUESTED' as const,
        bodyHTML: '<p>Two things</p>',
        submittedAt: MONDAY,
    };
    const detail = toItemDetail(
        {
            ...samplePullRequestDetailNode('PR_1', MONDAY),
            reviews: {
                pageInfo: { hasPreviousPage: true, startCursor: 'older' },
                nodes: [
                    review,
                    null,
                    { ...review, id: 'PRR_2', state: 'PENDING' as const },
                    { ...review, id: 'PRR_3', submittedAt: null },
                ],
            },
        },
        FETCHED_AT,
    );

    const expected: ItemReviewSummary[] = [
        {
            id: 'PRR_1',
            url: review.url,
            author: null,
            state: 'CHANGES_REQUESTED',
            bodyHtml: '<p>Two things</p>',
            submittedAt: MONDAY,
        },
    ];
    expect(detail?.kind === 'pullRequest' ? detail.reviewSummaries : null).toEqual(expected);
    expect(detail?.kind === 'pullRequest' ? detail.olderReviewCursor : null).toBe('older');
});

test("a pull request's reviewers keep their avatars; a bot asked to review has no one to show", () => {
    const detail = toItemDetail(
        {
            ...samplePullRequestDetailNode('PR_1', MONDAY),
            reviewRequests: {
                nodes: [
                    { requestedReviewer: { login: 'ewa', avatarUrl: 'https://avatars.test/ewa' } },
                    { requestedReviewer: { slug: 'core', name: 'Core' } },
                    { requestedReviewer: {} },
                ],
            },
        },
        FETCHED_AT,
    );

    const expected: ItemDetailReviewRequest[] = [
        { kind: 'user', user: { login: 'ewa', avatarUrl: 'https://avatars.test/ewa' } },
        { kind: 'team', slug: 'core', name: 'Core' },
    ];
    expect(detail?.kind === 'pullRequest' ? detail.reviewRequests : null).toEqual(expected);
});

test("a project place keeps the project's own fields and their values; fields mirroring the issue, empty values and archived places are left out", () => {
    const place = projectItem('PVTI_1', false);
    const detail = toItemDetail(
        {
            ...sampleIssueDetailNode('I_1', MONDAY),
            projectItems: { nodes: [place, projectItem('PVTI_archived', true), null] },
        },
        FETCHED_AT,
    );

    const expected: ItemDetailProject = {
        itemId: 'PVTI_1',
        projectId: 'PVT_1',
        title: 'Roadmap',
        number: 3,
        url: 'https://github.com/orgs/acme/projects/3',
        updatedAt: MONDAY,
        viewerCanUpdate: true,
        fields: [
            {
                kind: 'singleSelect',
                id: 'F_status',
                name: 'Status',
                options: [{ id: 'O_todo', name: 'Todo', color: 'GRAY' }],
            },
            {
                kind: 'iteration',
                id: 'F_sprint',
                name: 'Sprint',
                iterations: [{ id: 'IT_2', title: 'Sprint 2', startDate: '2026-10-26', duration: 14 }],
                completedIterations: [],
            },
            { kind: 'text', id: 'F_note', name: 'Note' },
        ],
        values: {
            F_status: { kind: 'singleSelect', optionId: 'O_todo', name: 'Todo', color: 'GRAY' },
            F_sprint: {
                kind: 'iteration',
                iterationId: 'IT_2',
                title: 'Sprint 2',
                startDate: '2026-10-26',
                duration: 14,
            },
        },
    };
    expect(detail?.projects).toEqual([expected]);
    // The row read with it keeps only the place's status, as the list shows it.
    expect(detail?.item.projects.map(project => project.itemId)).toEqual(['PVTI_1']);
});

test('comments come oldest first, with where the older ones start; reactions nobody gave are left out', () => {
    const detail = toItemDetail(
        {
            ...sampleIssueDetailNode('I_1', MONDAY),
            reactionGroups: [
                { content: 'THUMBS_UP', viewerHasReacted: true, reactors: { totalCount: 2 } },
                { content: 'EYES', viewerHasReacted: false, reactors: { totalCount: 0 } },
            ],
            commentPage: {
                totalCount: 70,
                pageInfo: { hasPreviousPage: true, startCursor: 'cursor-21' },
                nodes: [comment('IC_21'), null, comment('IC_22')],
            },
        },
        FETCHED_AT,
    );

    const reactions: ItemReaction[] = [{ content: 'THUMBS_UP', count: 2, viewerHasReacted: true }];
    expect(detail?.reactions).toEqual(reactions);
    expect(detail?.comments.totalCount).toBe(70);
    expect(detail?.comments.olderCursor).toBe('cursor-21');
    expect(detail?.comments.nodes.map(node => node.id)).toEqual(['IC_21', 'IC_22']);

    const allRead = toItemDetail(
        {
            ...sampleIssueDetailNode('I_1', MONDAY),
            commentPage: {
                totalCount: 1,
                pageInfo: { hasPreviousPage: false, startCursor: 'cursor-1' },
                nodes: [comment('IC_1')],
            },
        },
        FETCHED_AT,
    );
    expect(allRead?.comments.olderCursor).toBeNull();
});

test('a node GitHub gave empty or not at all has no detail', () => {
    expect(toItemDetail(null, FETCHED_AT)).toBeNull();
    expect(toItemDetail({}, FETCHED_AT)).toBeNull();
});

function projectItem(id: string, isArchived: boolean): ProjectItemDetailFieldsFragment {
    return {
        id,
        isArchived,
        updatedAt: MONDAY,
        project: {
            id: 'PVT_1',
            title: 'Roadmap',
            number: 3,
            url: 'https://github.com/orgs/acme/projects/3',
            viewerCanUpdate: true,
            fields: {
                nodes: [
                    { id: 'F_title', name: 'Title', dataType: 'TITLE' },
                    {
                        id: 'F_status',
                        name: 'Status',
                        dataType: 'SINGLE_SELECT',
                        options: [{ id: 'O_todo', name: 'Todo', color: 'GRAY' }],
                    },
                    {
                        id: 'F_sprint',
                        name: 'Sprint',
                        dataType: 'ITERATION',
                        configuration: {
                            iterations: [{ id: 'IT_2', title: 'Sprint 2', startDate: '2026-10-26', duration: 14 }],
                            completedIterations: [],
                        },
                    },
                    { id: 'F_note', name: 'Note', dataType: 'TEXT' },
                    { id: 'F_labels', name: 'Labels', dataType: 'LABELS' },
                ],
            },
        },
        fieldValueByName: { name: 'Todo', color: 'GRAY', optionId: 'O_todo' },
        fieldValues: {
            nodes: [
                {
                    __typename: 'ProjectV2ItemFieldSingleSelectValue',
                    field: { id: 'F_status' },
                    optionId: 'O_todo',
                    name: 'Todo',
                    color: 'GRAY',
                },
                {
                    __typename: 'ProjectV2ItemFieldIterationValue',
                    field: { id: 'F_sprint' },
                    iterationId: 'IT_2',
                    title: 'Sprint 2',
                    startDate: '2026-10-26',
                    duration: 14,
                },
                { __typename: 'ProjectV2ItemFieldTextValue', field: { id: 'F_note' }, text: null },
                { __typename: 'ProjectV2ItemFieldLabelValue' },
            ],
        },
    };
}

function comment(id: string) {
    return {
        id,
        url: `https://github.com/acme/web/issues/1#${id}`,
        createdAt: MONDAY,
        lastEditedAt: null,
        author: { login: 'octocat', avatarUrl: 'https://avatars.test/octocat' },
        body: id,
        bodyHTML: `<p>${id}</p>`,
        viewerCanUpdate: false,
        viewerCanDelete: false,
    };
}

test("a short thread's first and newest events overlap: each is kept once, and nothing is left to read between them", () => {
    const events = [labeled('E_1', 'bug'), labeled('E_2', 'docs'), labeled('E_3', 'ui')];
    const detail = toItemDetail(
        {
            ...sampleIssueDetailNode('I_1', MONDAY),
            firstEvents: { pageInfo: { endCursor: 'E_2' }, nodes: events.slice(0, 2) },
            lastEvents: { totalCount: 3, pageInfo: { startCursor: 'E_1' }, nodes: events },
        },
        FETCHED_AT,
    );

    expect(detail?.events).toEqual({
        totalCount: 3,
        commitCount: 0,
        oldest: [],
        newest: events.map(event => expect.objectContaining({ id: event.id, kind: 'labeled' })),
        middle: null,
    });
});

test('a long thread keeps its first events apart from its newest, with the cursors of the middle between them', () => {
    const detail = toItemDetail(
        {
            ...samplePullRequestDetailNode('PR_1', MONDAY),
            firstEvents: {
                pageInfo: { endCursor: 'after-2' },
                nodes: [labeled('E_1', 'bug'), labeled('E_2', 'docs')],
            },
            lastEvents: {
                totalCount: 60,
                pageInfo: { startCursor: 'before-51' },
                nodes: [labeled('E_51', 'ui')],
            },
            commitEvents: { totalCount: 12 },
        },
        FETCHED_AT,
    );

    expect(detail?.events).toMatchObject({
        totalCount: 60,
        commitCount: 12,
        oldest: [{ id: 'E_1' }, { id: 'E_2' }],
        newest: [{ id: 'E_51' }],
        middle: { after: 'after-2', before: 'before-51' },
    });
});

test('a pull request linked to an issue is the other side, whichever side GitHub reports the link from', () => {
    const issue = { __typename: 'Issue' as const, ...ref('I_1', 12) };
    const pullRequest = { __typename: 'PullRequest' as const, ...ref('PR_1', 15) };
    const connected = (source: typeof issue | typeof pullRequest, subject: typeof issue | typeof pullRequest) =>
        toThreadEvent(
            { __typename: 'ConnectedEvent', id: 'E_1', createdAt: MONDAY, actor: null, source, subject },
            'I_1',
        );

    expect(connected(pullRequest, issue)).toMatchObject({
        kind: 'connected',
        ref: { kind: 'pullRequest', number: 15 },
    });
    expect(connected(issue, pullRequest)).toMatchObject({
        kind: 'connected',
        ref: { kind: 'pullRequest', number: 15 },
    });
});

test("a Status a project workflow set names no one, though GitHub reports the project's owner", () => {
    const statusChange = (wasAutomated: boolean) =>
        toThreadEvent(
            {
                __typename: 'ProjectV2ItemStatusChangedEvent',
                id: 'E_1',
                createdAt: MONDAY,
                actor: { login: 'mlaine', avatarUrl: 'https://avatars.example/mlaine' },
                wasAutomated,
                previousStatus: 'In progress',
                status: 'Done',
                project: { title: 'Roadmap', url: 'https://github.com/orgs/acme/projects/1' },
            },
            'I_1',
        );

    expect(statusChange(true)).toMatchObject({
        kind: 'projectStatusChanged',
        actor: null,
        from: 'In progress',
        to: 'Done',
    });
    expect(statusChange(false)).toMatchObject({ actor: { login: 'mlaine' } });
});

function labeled(id: string, label: string): Extract<ThreadEventFieldsFragment, { __typename: 'LabeledEvent' }> {
    return { __typename: 'LabeledEvent', id, createdAt: MONDAY, actor: null, label: { name: label, color: 'ededed' } };
}

function ref(id: string, number: number) {
    return {
        id,
        url: `https://github.com/acme/web/issues/${number}`,
        number,
        title: `Item ${number}`,
        repository: { nameWithOwner: 'acme/web' },
    };
}
