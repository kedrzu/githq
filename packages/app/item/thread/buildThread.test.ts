import { expect, test } from 'bun:test';

import type { FailedComment } from '@/edits/CommentDrafts.js';
import type { ItemCheck, ItemComment, ItemDetail, ThreadCommit, ThreadEvent } from '@/store/ItemDetailTypes.js';
import type { ItemUser } from '@/store/ItemTypes.js';
import { D1_ISSUE, D1_ISSUE_DETAIL, F1_PULL_REQUEST, F1_PULL_REQUEST_DETAIL } from '@/testing/sampleItemDetails.js';

import { buildThread } from './buildThread.js';
import type { ThreadEventLine, ThreadItem } from './buildThread.js';

const START = Date.parse('2026-11-02T10:00:00Z');
const MLAINE: ItemUser = { login: 'mlaine', avatarUrl: '' };
const DKIM: ItemUser = { login: 'dkim', avatarUrl: '' };
const SOFIAB: ItemUser = { login: 'sofiab', avatarUrl: '' };
const BUG = { name: 'bug', color: 'd73a4a' };
const STORAGE = { name: 'storage', color: '7b87f7' };

test("one person's events within 10 minutes share a line, objects of one kind merged, in the order they came", () => {
    const thread = buildIssueThread([
        { ...base('E1', MLAINE, 0), kind: 'labeled', label: STORAGE },
        { ...base('E2', MLAINE, 2), kind: 'reviewRequested', reviewer: { kind: 'user', user: SOFIAB } },
        { ...base('E3', MLAINE, 4), kind: 'labeled', label: BUG },
        { ...base('E4', MLAINE, 9), kind: 'reviewRequested', reviewer: { kind: 'user', user: DKIM } },
    ]);

    const expected: ThreadEventLine = {
        kind: 'events',
        id: 'E1',
        actor: MLAINE,
        parts: [
            { kind: 'labeled', labels: [STORAGE, BUG] },
            {
                kind: 'reviewRequested',
                reviewers: [
                    { kind: 'user', user: SOFIAB },
                    { kind: 'user', user: DKIM },
                ],
            },
        ],
        updatedAt: at(9),
    };
    expect(withoutDescription(thread)).toEqual([expected]);
});

test('a burst ends after 10 minutes from its first event, at another person, and at anything that is not an event', () => {
    const thread = buildIssueThread(
        [
            { ...base('E1', MLAINE, 0), kind: 'labeled', label: BUG },
            { ...base('E2', MLAINE, 11), kind: 'labeled', label: STORAGE },
            { ...base('E3', DKIM, 12), kind: 'pinned' },
            { ...base('E4', DKIM, 14), kind: 'unlocked' },
            { ...base('E5', DKIM, 16), kind: 'reopened' },
        ],
        [comment('C1', SOFIAB, 15)],
    );

    expect(withoutDescription(thread).map(entry => entry.id)).toEqual(['E1', 'E2', 'E3', 'C1', 'E5']);
    expect(lineOf(thread, 'E3').parts.map(part => (part.kind === 'single' ? part.event.kind : part.kind))).toEqual([
        'pinned',
        'unlocked',
    ]);
});

test('an add and a remove of the same thing in one burst cancel out; a line left with nothing goes', () => {
    const thread = buildIssueThread([
        { ...base('E1', MLAINE, 0), kind: 'labeled', label: BUG },
        { ...base('E2', MLAINE, 1), kind: 'labeled', label: STORAGE },
        { ...base('E3', MLAINE, 2), kind: 'unlabeled', label: BUG },
        { ...base('E4', MLAINE, 3), kind: 'assigned', assignee: DKIM },
        { ...base('E5', MLAINE, 4), kind: 'unassigned', assignee: DKIM },
        { ...base('E6', DKIM, 30), kind: 'subIssueAdded', issue: ref('I_13', 13) },
        { ...base('E7', DKIM, 31), kind: 'subIssueRemoved', issue: ref('I_13', 13) },
        { ...base('E8', SOFIAB, 60), kind: 'subIssueAdded', issue: ref('I_13', 13) },
        { ...base('E9', SOFIAB, 61), kind: 'subIssueRemoved', issue: ref('I_14', 14) },
    ]);

    const lines = withoutDescription(thread);
    expect(lines.map(entry => entry.id)).toEqual(['E1', 'E8']);
    expect(lineOf(thread, 'E1').parts).toEqual([{ kind: 'labeled', labels: [STORAGE] }]);
    expect(lineOf(thread, 'E8').parts).toHaveLength(2);
});

test('an event with no person is never shown, but a project workflow’s Status change, which shows no one', () => {
    const thread = buildIssueThread([
        { ...base('E1', null, 0), kind: 'addedToProject', project: PROJECT, wasAutomated: true },
        { ...base('E2', null, 1), kind: 'labeled', label: BUG },
        {
            ...base('E3', null, 2),
            kind: 'projectStatusChanged',
            project: PROJECT,
            from: 'Todo',
            to: 'Done',
            wasAutomated: true,
        },
        {
            ...base('E4', null, 3),
            kind: 'projectStatusChanged',
            project: PROJECT,
            from: 'Done',
            to: 'Todo',
            wasAutomated: false,
        },
    ]);

    expect(withoutDescription(thread)).toEqual([
        {
            kind: 'events',
            id: 'E3',
            actor: null,
            parts: [{ kind: 'single', event: expect.objectContaining({ id: 'E3' }) }],
            updatedAt: at(2),
        },
    ]);
});

test("the description comes first, then comments and events by time, then the user's comments on their way and those not sent", () => {
    const pending: ItemComment = { ...comment('pending:1', MLAINE, -60), pendingBody: 'On its way' };
    const failed: FailedComment = {
        id: 1,
        itemId: D1_ISSUE.id,
        body: 'Not taken',
        reason: { kind: 'offline' },
        retrying: false,
    };
    const thread = buildThread({
        item: D1_ISSUE,
        detail: issueDetail(
            [
                { ...base('E1', MLAINE, 5), kind: 'pinned' },
                { ...base('E2', DKIM, 20), kind: 'unpinned' },
            ],
            [comment('C2', DKIM, 10), pending, comment('C3', SOFIAB, 30)],
            [comment('C1', SOFIAB, 1), comment('C2', DKIM, 10)],
        ),
        failedComments: [failed],
    });

    expect(thread.map(entry => entry.id)).toEqual([
        'description',
        'C1',
        'E1',
        'C2',
        'E2',
        'C3',
        'pending:1',
        'failed:1',
    ]);
});

test("one author's commits straight after each other are one push; a comment or another author starts the next", () => {
    const thread = buildThread({
        item: F1_PULL_REQUEST,
        detail: pullRequestDetail(
            [
                commitAt('a1', MLAINE, 0),
                commitAt('a2', MLAINE, 1),
                commitAt('a3', DKIM, 2),
                commitAt('a4', DKIM, 20),
                commitAt('a5', DKIM, 21),
            ],
            [comment('C1', SOFIAB, 10)],
        ),
    });

    const pushes = withoutDescription(thread).map(entry =>
        entry.kind === 'push' ? entry.commits.map(commit => commit.abbreviatedOid) : entry.id,
    );
    expect(pushes).toEqual([['a1', 'a2'], ['a3'], 'C1', ['a4', 'a5']]);
});

test("once the newest commit's checks finished with a failure, the thread says which failed, when the last finished", () => {
    const thread = buildThread({
        item: { ...F1_PULL_REQUEST, headRefOid: 'e81f0a3c0ffee' },
        detail: pullRequestDetail([commitAt('e81f0a3', MLAINE, 0)], [comment('C1', SOFIAB, 30)], {
            checks: [
                check('e2e', 'failing', 20),
                check('typecheck', 'failing', 40),
                check('e2e', 'failing', 25),
                check('lint', 'passing', 50),
            ],
            checkCount: 4,
        }),
    });

    expect(withoutDescription(thread).map(entry => entry.id)).toEqual(['PRC_e81f0a3', 'C1', 'checks:e81f0a3c0ffee']);
    expect(thread.at(-1)).toEqual({
        kind: 'checksFailed',
        id: 'checks:e81f0a3c0ffee',
        commit: { abbreviatedOid: 'e81f0a3', url: 'https://github.com/kedrzu/githq/pull/1/commits/e81f0a3' },
        failedCount: 3,
        failed: ['e2e', 'typecheck'],
        total: 4,
        updatedAt: at(50),
    });
});

test('no CI event while a check still runs, when none failed, or when GitHub cut the list', () => {
    const running = [check('e2e', 'failing', 20), check('lint', 'pending', null)];
    const passing = [check('e2e', 'passing', 20), check('lint', 'skipped', 30)];
    const cut = [check('e2e', 'failing', 20)];

    for (const [checks, checkCount] of [
        [running, 2],
        [passing, 2],
        [cut, 120],
    ] as const) {
        const thread = buildThread({
            item: F1_PULL_REQUEST,
            detail: pullRequestDetail([], [], { checks, checkCount }),
        });
        expect(thread.filter(entry => entry.kind === 'checksFailed')).toEqual([]);
    }
});

const PROJECT = { title: 'tasklet Roadmap', url: 'https://github.com/users/mlaine/projects/1' };

function buildIssueThread(events: ThreadEvent[], comments: ItemComment[] = []) {
    return buildThread({ item: D1_ISSUE, detail: issueDetail(events, comments) });
}

function issueDetail(newest: ThreadEvent[], nodes: ItemComment[], first: ItemComment[] = []): ItemDetail {
    return {
        ...D1_ISSUE_DETAIL,
        comments: { totalCount: nodes.length, first, nodes, olderCursor: null },
        events: { totalCount: newest.length, commitCount: 0, oldest: [], newest, middle: null },
    };
}

function pullRequestDetail(
    newest: ThreadEvent[],
    nodes: ItemComment[],
    checks?: Pick<typeof F1_PULL_REQUEST_DETAIL, 'checks' | 'checkCount'>,
): ItemDetail {
    return {
        ...F1_PULL_REQUEST_DETAIL,
        checks: checks?.checks ?? [],
        checkCount: checks?.checkCount ?? 0,
        comments: { totalCount: nodes.length, first: [], nodes, olderCursor: null },
        events: { totalCount: newest.length, commitCount: newest.length, oldest: [], newest, middle: null },
    };
}

function withoutDescription(thread: ThreadItem[]) {
    return thread.filter(entry => entry.kind !== 'description');
}

function lineOf(thread: ThreadItem[], id: string): ThreadEventLine {
    const line = thread.find(entry => entry.id === id);
    if (line?.kind !== 'events') {
        throw new Error(`No line ${id}`);
    }

    return line;
}

/** The time `minutes` after the start. */
function at(minutes: number) {
    return new Date(START + minutes * 60_000).toISOString();
}

function base(id: string, actor: ItemUser | null, minutes: number) {
    return { id, actor, createdAt: at(minutes) };
}

function ref(id: string, number: number) {
    return {
        kind: 'issue' as const,
        id,
        url: `https://github.com/mlaine/tasklet/issues/${number}`,
        number,
        title: `Issue ${number}`,
        repository: 'mlaine/tasklet',
    };
}

function comment(id: string, author: ItemUser, minutes: number): ItemComment {
    return {
        id,
        url: `https://github.com/mlaine/tasklet/issues/12#issuecomment-${id}`,
        author,
        body: id,
        bodyHtml: `<p>${id}</p>`,
        createdAt: at(minutes),
        lastEditedAt: null,
        viewerCanUpdate: false,
        viewerCanDelete: false,
    };
}

function commitAt(oid: string, author: ItemUser, minutes: number): ThreadCommit {
    return {
        kind: 'commit',
        id: `PRC_${oid}`,
        createdAt: at(minutes),
        actor: author,
        authorName: author.login,
        abbreviatedOid: oid,
        messageHeadline: `Commit ${oid}`,
        url: `https://github.com/kedrzu/githq/pull/1/commits/${oid}`,
        ci: 'SUCCESS',
    };
}

function check(name: string, state: ItemCheck['state'], completedMinutes: number | null): ItemCheck {
    return {
        id: `${name}:${completedMinutes}`,
        kind: 'checkRun',
        name,
        workflow: 'ci',
        state,
        url: null,
        startedAt: at(0),
        completedAt: completedMinutes === null ? null : at(completedMinutes),
    };
}
