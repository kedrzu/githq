import { expect, test } from 'bun:test';

import type { FailedComment } from '@/edits/CommentDrafts.js';
import type { ReviewThread, ReviewThreadComment } from '@/review/threads/ReviewThread.js';
import type {
    ItemCheck,
    ItemComment,
    ItemDetail,
    ItemReviewSummary,
    PullRequestDetail,
    ThreadCommit,
    ThreadEvent,
} from '@/store/ItemDetailTypes.js';
import type { ItemUser } from '@/store/ItemTypes.js';
import { D1_ISSUE, D1_ISSUE_DETAIL, F1_PULL_REQUEST, F1_PULL_REQUEST_DETAIL } from '@/testing/sampleItemDetails.js';

import { buildThread } from './buildThread.js';
import type { ThreadEventLine, ThreadFold, ThreadItem, ThreadPendingReview, ThreadReview } from './buildThread.js';

const START = Date.parse('2026-11-02T10:00:00Z');
const MLAINE: ItemUser = { login: 'mlaine', avatarUrl: '' };
const DKIM: ItemUser = { login: 'dkim', avatarUrl: '' };
const SOFIAB: ItemUser = { login: 'sofiab', avatarUrl: '' };
const PNOWAK: ItemUser = { login: 'pnowak', avatarUrl: '' };
/** The viewer's draft review. */
const PENDING_ID = 'PRR_pending';
const BUG = { name: 'bug', color: 'd73a4a' };
/** A pull request with no reviews: a test gives it those it is about. */
const PR_DETAIL: PullRequestDetail = { ...F1_PULL_REQUEST_DETAIL, reviewSummaries: [] };
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
            { kind: 'labeled', objects: [STORAGE, BUG] },
            {
                kind: 'reviewRequested',
                objects: [
                    { kind: 'user', user: SOFIAB },
                    { kind: 'user', user: DKIM },
                ],
            },
        ],
        updatedAt: at(9),
    };
    expect(thread).toEqual([expected]);
});

test('mentions, sub-issues and commit references of one burst each merge into the part of their kind, where it first came', () => {
    const fix = {
        abbreviatedOid: 'a1b2c3d',
        url: 'https://github.com/mlaine/tasklet/commit/a1b2c3d',
        messageHeadline: 'Fix',
    };
    const cover = { ...fix, abbreviatedOid: 'e4f5a6b', url: 'https://github.com/mlaine/tasklet/commit/e4f5a6b' };
    // As primer/react#8676 had them: each new issue mentioned this one, then went in as its sub-issue.
    const thread = buildIssueThread([
        { ...base('E1', MLAINE, 0), kind: 'crossReferenced', source: ref('I_8714', 8714) },
        { ...base('E2', MLAINE, 1), kind: 'subIssueAdded', issue: ref('I_8714', 8714) },
        { ...base('E3', MLAINE, 2), kind: 'crossReferenced', source: ref('I_8715', 8715) },
        { ...base('E4', MLAINE, 3), kind: 'subIssueAdded', issue: ref('I_8715', 8715) },
        { ...base('E5', MLAINE, 4), kind: 'referenced', commit: fix, repository: 'mlaine/tasklet' },
        { ...base('E6', MLAINE, 5), kind: 'subIssueAdded', issue: null },
        { ...base('E7', MLAINE, 6), kind: 'referenced', commit: cover, repository: 'mlaine/tasklet' },
    ]);

    expect(lineOf(thread, 'E1').parts).toEqual([
        { kind: 'crossReferenced', objects: [ref('I_8714', 8714), ref('I_8715', 8715)] },
        { kind: 'subIssueAdded', objects: [ref('I_8714', 8714), ref('I_8715', 8715)] },
        { kind: 'referenced', objects: [fix, cover] },
        // One the viewer cannot see has nothing to merge by: it stays apart.
        { kind: 'single', event: expect.objectContaining({ id: 'E6' }) },
    ]);
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

    expect(thread.map(entry => entry.id)).toEqual(['E1', 'E2', 'E3', 'C1', 'E5']);
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

    expect(thread.map(entry => entry.id)).toEqual(['E1', 'E8']);
    expect(lineOf(thread, 'E1').parts).toEqual([{ kind: 'labeled', objects: [STORAGE] }]);
    expect(lineOf(thread, 'E8').parts).toHaveLength(2);
});

test('an event with no person is never shown, but a project workflow’s Status change, which shows no one', () => {
    const thread = buildIssueThread([
        { ...base('E1', null, 0), kind: 'addedToProject', project: PROJECT },
        { ...base('E2', null, 1), kind: 'labeled', label: BUG },
        {
            ...base('E3', null, 2),
            kind: 'projectStatusChanged',
            project: PROJECT,
            to: 'Done',
            wasAutomated: true,
        },
        {
            ...base('E4', null, 3),
            kind: 'projectStatusChanged',
            project: PROJECT,
            to: 'Todo',
            wasAutomated: false,
        },
    ]);

    expect(thread).toEqual([
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

    expect(thread.map(entry => entry.id)).toEqual(['C1', 'E1', 'C2', 'E2', 'C3', 'pending:1', 'failed:1']);
});

test("one author's commits straight after each other are one push; a comment or another author starts the next", () => {
    const thread = buildThread({
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

    const pushes = thread.map(entry =>
        entry.kind === 'push' ? entry.commits.map(commit => commit.abbreviatedOid) : entry.id,
    );
    expect(pushes).toEqual([['a1', 'a2'], ['a3'], 'C1', ['a4', 'a5']]);
});

test("one author's commits more than an hour apart are two pushes: GitHub tells no push's time", () => {
    const thread = buildThread({
        detail: pullRequestDetail(
            [
                commitAt('a1', MLAINE, 0),
                commitAt('a2', MLAINE, 50),
                commitAt('a3', MLAINE, 110),
                commitAt('a4', MLAINE, 171),
                commitAt('a5', MLAINE, 400),
            ],
            [],
        ),
    });

    const pushes = thread.map(entry =>
        entry.kind === 'push' ? entry.commits.map(commit => commit.abbreviatedOid) : [],
    );
    expect(pushes).toEqual([['a1', 'a2', 'a3'], ['a4'], ['a5']]);
});

test("once the newest commit's checks finished with a failure, the thread says which failed, when the last finished", () => {
    const thread = buildThread({
        detail: {
            ...pullRequestDetail([commitAt('e81f0a3', MLAINE, 0)], [comment('C1', SOFIAB, 30)], {
                checks: [
                    check('e2e', 'failing', 20),
                    check('typecheck', 'failing', 40),
                    check('e2e', 'failing', 25),
                    check('lint', 'passing', 50),
                ],
                checkCount: 4,
            }),
            item: { ...F1_PULL_REQUEST, headRefOid: 'e81f0a3c0ffee' },
        },
    });

    expect(thread.map(entry => entry.id)).toEqual(['PRC_e81f0a3', 'C1', 'checks:e81f0a3c0ffee']);
    expect(thread.at(-1)).toEqual({
        kind: 'checksFailed',
        id: 'checks:e81f0a3c0ffee',
        commit: { abbreviatedOid: 'e81f0a3', url: `${F1_PULL_REQUEST.url}/commits/e81f0a3c0ffee` },
        // e2e ran twice: its newer run counts.
        failedCount: 2,
        failed: ['e2e', 'typecheck'],
        total: 3,
        updatedAt: at(50),
    });
});

test("the CI line counts each check's newest run only, and a cancelled run fails nothing", () => {
    // As healedcare/healed#586 had them: Build and TODO Check cancelled, then passing in newer runs.
    const checks = [
        check('Verify Submodules', 'failing', 1),
        check('Verify Submodules', 'failing', 2),
        { ...check('Build', 'failing', 1), cancelled: true },
        { ...check('TODO Check', 'failing', 1), cancelled: true },
        check('Release pins', 'skipped', 1),
        check('Release pins', 'skipped', 2),
        check('Build', 'passing', 3),
        check('TODO Check', 'passing', 3),
        // Cancelled in its newest run too: still no failure.
        { ...check('Deploy', 'failing', 4), cancelled: true },
    ];
    const thread = buildThread({ detail: pullRequestDetail([], [], { checks, checkCount: checks.length }) });

    expect(thread.find(entry => entry.kind === 'checksFailed')).toMatchObject({
        failedCount: 1,
        failed: ['Verify Submodules'],
        total: 5,
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
            detail: pullRequestDetail([], [], { checks, checkCount }),
        });
        expect(thread.filter(entry => entry.kind === 'checksFailed')).toEqual([]);
    }
});

test('more than 20 items fold: the first 2 stay above, the last 5 below, the rest is one band', () => {
    const twenty = manyComments(20);
    expect(idsOf(buildIssueThread([], twenty))).toEqual(twenty.map(entry => entry.id));

    const thread = buildIssueThread([], manyComments(21));

    expect(idsOf(thread)).toEqual(['C1', 'C2', 'fold', 'C17', 'C18', 'C19', 'C20', 'C21']);
    expect(foldOf(thread)).toEqual(fold({ comments: 14 }));
});

test('fewer than 6 left to fold: nothing folds; what the user must see stays below, the fold ending before it', () => {
    const many = manyComments(21);

    // The 7th held open (an editor, a refused edit): 4 left to fold.
    const short = buildThread({ detail: issueDetail([], many), keepShown: new Set(['C7']) });
    expect(idsOf(short)).toEqual(many.map(entry => entry.id));

    const thread = buildThread({ detail: issueDetail([], many), keepShown: new Set(['C9']) });
    expect(idsOf(thread)).toEqual(['C1', 'C2', 'fold', ...many.slice(8).map(entry => entry.id)]);
    expect(foldOf(thread)).toEqual(fold({ comments: 6 }));
});

test("the user's comments on their way, refused or being edited are never folded away, however many", () => {
    const sent = manyComments(20);
    const editing = { ...sent[9]!, pendingBody: 'Edited, on its way' };
    const pending = [1, 2, 3, 4, 5, 6].map(index => ({ ...comment(`pending:${index}`, MLAINE, 100 + index) }));
    const thread = buildThread({
        detail: issueDetail([], [...sent.slice(0, 9), editing, ...sent.slice(10), ...pending]),
        failedComments: [failedComment(1)],
    });

    expect(idsOf(thread)).toEqual([
        'C1',
        'C2',
        'fold',
        ...sent.slice(9).map(entry => entry.id),
        ...pending.map(entry => entry.id),
        'failed:1',
    ]);
});

test('the fold counts by group: the commits of its pushes, its comments, its other events with one line counted once', () => {
    const written = Array.from({ length: 18 }, (_, index) =>
        comment(`C${index + 1}`, SOFIAB, index < 2 ? index + 1 : index + 10),
    );
    const thread = buildPullRequestThread(
        [
            commitAt('a1', MLAINE, 3),
            commitAt('a2', MLAINE, 4),
            commitAt('a3', MLAINE, 5),
            { ...base('E1', DKIM, 6), kind: 'labeled', label: BUG },
            { ...base('E2', DKIM, 7), kind: 'labeled', label: STORAGE },
            { ...base('E3', DKIM, 8), kind: 'pinned' },
            commitAt('b1', SOFIAB, 9),
            commitAt('b2', SOFIAB, 10),
        ],
        written,
    );

    // C1, C2; folded: 3 commits, DKIM's line, 2 commits, C3–C13; below: C14–C18.
    expect(idsOf(thread)).toEqual(['C1', 'C2', 'fold', 'C14', 'C15', 'C16', 'C17', 'C18']);
    expect(foldOf(thread)).toEqual(fold({ commits: 5, comments: 11, otherEvents: 1 }));
});

test('what GitHub has and the detail does not hold counts as folded, and folds however short the rest', () => {
    const [c1, c2, c3, c4, c5] = manyComments(5);
    const detail: ItemDetail = {
        ...D1_ISSUE_DETAIL,
        comments: { totalCount: 12, first: [c1!, c2!], nodes: [c3!, c4!, c5!], olderCursor: 'older' },
        events: {
            totalCount: 9,
            commitCount: 0,
            oldest: [{ ...base('E1', DKIM, 0.5), kind: 'pinned' }],
            newest: [{ ...base('E2', DKIM, 200), kind: 'unpinned' }],
            middle: { after: 'a', before: 'b' },
        },
    };

    const thread = buildThread({ detail });

    // The events not held may lie anywhere between E1 and E2: the comments held between them fold too.
    expect(idsOf(thread)).toEqual(['E1', 'fold', 'E2']);
    expect(foldOf(thread)).toEqual(fold({ comments: 12, otherEvents: 7 }));
    // The first comments not held either: they may be older than E1, which cannot stay above them.
    const newestOnly: ItemDetail = { ...detail, comments: { ...detail.comments, first: [] } };
    expect(idsOf(buildThread({ detail: newestOnly }))).toEqual(['fold', 'E2']);
    // Shown, with the middle still not held: it stays folded — nothing to show it with.
    expect(idsOf(buildThread({ detail, unfolded: true }))).toEqual(['E1', 'fold', 'E2']);
});

test("what stays around the fold keeps the time order of what it hides, whichever stream's middle is not held", () => {
    // The first two commits are one push; the commits after them are not read, the comments all are.
    const comments = Array.from({ length: 25 }, (_, index) => comment(`C${index + 1}`, SOFIAB, index + 5));
    const detail: ItemDetail = {
        ...PR_DETAIL,
        comments: { totalCount: 25, first: comments.slice(0, 2), nodes: comments, olderCursor: null },
        events: {
            totalCount: 10,
            commitCount: 10,
            oldest: [commitAt('a1', MLAINE, 1), commitAt('a2', MLAINE, 2)],
            newest: [commitAt('b1', MLAINE, 50)],
            middle: { after: 'a', before: 'b' },
        },
    };

    const thread = buildThread({ detail });

    // C1 came after commits not read yet, C21–C25 before some: none of them stays out of the fold.
    expect(idsOf(thread)).toEqual(['PRC_a1', 'fold', 'PRC_b1']);
    expect(foldOf(thread)).toEqual(fold({ commits: 7, comments: 25 }));
});

test('the CI line names the commit the detail read its checks with, though the row has moved on to a newer one', () => {
    const thread = buildThread({
        detail: {
            ...pullRequestDetail([], [], { checks: [check('e2e', 'failing', 20)], checkCount: 1 }),
            item: { ...F1_PULL_REQUEST, headRefOid: 'old0000c0ffee' },
        },
    });

    expect(thread.find(entry => entry.kind === 'checksFailed')).toMatchObject({
        id: 'checks:old0000c0ffee',
        commit: { abbreviatedOid: 'old0000' },
    });
});

test('a merge is told once: the close GitHub gives with it, at its time, is not drawn, wherever each was read', () => {
    const detail: ItemDetail = {
        ...PR_DETAIL,
        comments: { totalCount: 0, first: [], nodes: [], olderCursor: null },
        events: {
            totalCount: 3,
            commitCount: 0,
            // The merge in the first page, its close in the newest one.
            oldest: [merged('ME_1', 100)],
            newest: [closed('CE_1', 50), closed('CE_2', 100)],
            middle: null,
        },
    };

    const thread = buildThread({ detail });

    expect(idsOf(thread)).toEqual(['CE_1', 'ME_1']);
    expect(lineOf(thread, 'ME_1').parts.map(part => part.kind)).toEqual(['single']);
});

test("a merged pull request held whole folds as any other: the first 2 above, the band's counts what showing it reveals", () => {
    const detail: ItemDetail = {
        ...PR_DETAIL,
        comments: { totalCount: 25, first: [], nodes: manyComments(25), olderCursor: null },
        events: {
            totalCount: 2,
            commitCount: 0,
            oldest: [],
            newest: [merged('ME_1', 10), closed('CE_1', 10)],
            middle: null,
        },
    };

    const thread = buildThread({ detail });
    const shown = buildThread({ detail, unfolded: true });

    expect(idsOf(thread)).toEqual(['C1', 'C2', 'fold', 'C21', 'C22', 'C23', 'C24', 'C25']);
    expect(foldOf(thread)).toEqual(fold({ comments: 18, otherEvents: 1 }));
    const revealed = shown.slice(2, -5);
    expect(revealed.filter(entry => entry.kind === 'comment')).toHaveLength(18);
    expect(revealed.filter(entry => entry.kind === 'events')).toHaveLength(1);
});

test("the fold's other events count the close a merge came with, held, as GitHub does: once with the merge", () => {
    const detail: ItemDetail = {
        ...PR_DETAIL,
        comments: { totalCount: 0, first: [], nodes: [], olderCursor: null },
        events: {
            // E1, 3 not read, the merge and its close.
            totalCount: 6,
            commitCount: 0,
            oldest: [{ ...base('E1', DKIM, 0), kind: 'pinned' }],
            newest: [merged('ME_1', 100), closed('CE_1', 100)],
            middle: { after: 'a', before: 'b' },
        },
    };

    const thread = buildThread({ detail });

    expect(idsOf(thread)).toEqual(['E1', 'fold', 'ME_1']);
    expect(foldOf(thread)).toEqual(fold({ otherEvents: 3 }));
});

test('shown by the user, a long thread read whole folds no more', () => {
    const many = manyComments(30);
    const thread = buildThread({ detail: issueDetail([], many), unfolded: true });

    expect(idsOf(thread)).toEqual(many.map(entry => entry.id));
});

test('reviews come by when submitted with the threads they started, resolved apart; a code comment alone is an item; a reply carries none', () => {
    // As nuxt/nuxt#36890 had them: a reply to a thread is a review of its own, saying nothing, starting nothing.
    const opened = reviewThread('T1', [
        threadComment('T1-0', SOFIAB, 10, 'R1'),
        threadComment('T1-1', MLAINE, 20, 'R2'),
    ]);
    const resolved = reviewThread('T2', [threadComment('T2-0', SOFIAB, 10, 'R1')], { isResolved: true });
    const alone = reviewThread('T3', [threadComment('T3-0', DKIM, 30, 'R3')]);
    // Its review older than those read.
    const older = reviewThread('T4', [threadComment('T4-0', DKIM, 1, 'R0')]);
    const detail: ItemDetail = {
        ...pullRequestDetail(
            [{ ...base('E1', MLAINE, 50), kind: 'reviewDismissed', reviewer: PNOWAK, message: null }],
            [comment('C1', DKIM, 25)],
        ),
        reviewSummaries: [
            review('R5', PNOWAK, 'DISMISSED', 5, '<p>Not like this.</p>'),
            review('R1', SOFIAB, 'CHANGES_REQUESTED', 10, '<p>Two things.</p>'),
            review('R2', MLAINE, 'COMMENTED', 20),
            review('R3', DKIM, 'COMMENTED', 30),
            review('R4', DKIM, 'APPROVED', 40),
        ],
    };

    const built = buildThread({ detail, reviewThreads: [older, opened, resolved, alone] });

    expect(idsOf(built)).toEqual(['T4', 'R5', 'R1', 'C1', 'T3', 'R4', 'E1']);
    const expected: ThreadReview = {
        kind: 'review',
        id: 'R1',
        review: review('R1', SOFIAB, 'CHANGES_REQUESTED', 10, '<p>Two things.</p>'),
        threads: [opened],
        resolved: [resolved],
    };
    expect(built.find(entry => entry.id === 'R1')).toEqual(expected);
    expect(built.find(entry => entry.id === 'T3')).toEqual({ kind: 'codeComment', id: 'T3', thread: alone });
    expect(built.find(entry => entry.id === 'R5')).toMatchObject({ kind: 'review', threads: [], resolved: [] });
});

test('a draft review shows only to its author, last before the composer; nobody else’s draft comment shows anywhere', () => {
    const draft = reviewThread('D1', [threadComment('D1-0', MLAINE, 60, PENDING_ID, 'PENDING')]);
    const othersDraft = reviewThread('X1', [threadComment('X1-0', DKIM, 61, 'PRR_dkim', 'PENDING')]);
    const replied = reviewThread('T1', [
        threadComment('T1-0', SOFIAB, 10, 'R1'),
        threadComment('T1-1', MLAINE, 62, PENDING_ID, 'PENDING'),
        threadComment('T1-2', DKIM, 63, 'PRR_dkim', 'PENDING'),
    ]);
    const params = {
        detail: {
            ...pullRequestDetail([], []),
            reviewSummaries: [review('R1', SOFIAB, 'COMMENTED', 10, '<p>Hm.</p>')],
        },
        reviewThreads: [draft, othersDraft, replied],
        failedComments: [failedComment(1)],
    };
    const pendingReview = { id: PENDING_ID, commentCount: 2, createdAt: at(60) };

    const own = buildThread({ ...params, pendingReview, viewerLogin: MLAINE.login });

    const expected: ThreadPendingReview = {
        kind: 'pendingReview',
        id: 'pendingReview',
        review: pendingReview,
        threads: [draft],
    };
    expect(idsOf(own)).toEqual(['R1', 'failed:1', 'pendingReview']);
    expect(own.at(-1)).toEqual(expected);
    expect(commentIdsOf(own)).toEqual(['T1-0', 'T1-1', 'D1-0']);

    // Signed in as someone with no draft: none shows, and nobody's draft comments.
    const other = buildThread({ ...params, pendingReview: null, viewerLogin: SOFIAB.login });
    expect(idsOf(other)).toEqual(['R1', 'failed:1']);
    expect(commentIdsOf(other)).toEqual(['T1-0']);

    // Nobody signed in: no draft is anyone's.
    const nobody = buildThread({ ...params, pendingReview, viewerLogin: null });
    expect(idsOf(nobody)).toEqual(['R1', 'failed:1']);
    expect(commentIdsOf(nobody)).toEqual(['T1-0']);
});

test('the oldest review with a thread still open stays below the fold; one all resolved folds, counted as a comment', () => {
    const comments = Array.from({ length: 24 }, (_, index) => comment(`C${index + 1}`, SOFIAB, index + 1));
    const detail: ItemDetail = {
        ...pullRequestDetail([], comments),
        reviewSummaries: [
            review('R0', DKIM, 'COMMENTED', 6.5, '<p>Settled.</p>'),
            review('R1', DKIM, 'CHANGES_REQUESTED', 10.5, '<p>One thing.</p>'),
            review('R2', DKIM, 'COMMENTED', 11.5),
        ],
    };
    const reviewThreads = [
        reviewThread('T0', [threadComment('T0-0', DKIM, 6.5, 'R0')], { isResolved: true }),
        reviewThread('T1', [threadComment('T1-0', DKIM, 10.5, 'R1')]),
        // A code comment still open, after: the review is the oldest.
        reviewThread('T2', [threadComment('T2-0', DKIM, 11.5, 'R2')]),
    ];

    const built = buildThread({ detail, reviewThreads });

    expect(idsOf(built)).toEqual(['C1', 'C2', 'fold', 'R1', 'C11', 'T2', ...comments.slice(11).map(entry => entry.id)]);
    expect(foldOf(built)).toEqual(fold({ comments: 9 }));
});

test('asking for a review someone already gave asks for another review; a remove cancels either', () => {
    const detail: ItemDetail = {
        ...pullRequestDetail(
            [
                { ...base('E0', MLAINE, 5), kind: 'reviewRequested', reviewer: { kind: 'user', user: SOFIAB } },
                { ...base('E1', MLAINE, 50), kind: 'reviewRequested', reviewer: { kind: 'user', user: SOFIAB } },
                { ...base('E2', MLAINE, 51), kind: 'reviewRequested', reviewer: { kind: 'user', user: DKIM } },
                { ...base('E3', MLAINE, 70), kind: 'reviewRequested', reviewer: { kind: 'user', user: SOFIAB } },
                { ...base('E4', MLAINE, 71), kind: 'reviewRequestRemoved', reviewer: { kind: 'user', user: SOFIAB } },
            ],
            [],
        ),
        reviewSummaries: [review('R1', SOFIAB, 'APPROVED', 10)],
    };

    const built = buildThread({ detail });

    expect(idsOf(built)).toEqual(['E0', 'R1', 'E1']);
    expect(lineOf(built, 'E0').parts).toEqual([{ kind: 'reviewRequested', objects: [{ kind: 'user', user: SOFIAB }] }]);
    expect(lineOf(built, 'E1').parts).toEqual([
        { kind: 'reviewRequestedAgain', objects: [{ kind: 'user', user: SOFIAB }] },
        { kind: 'reviewRequested', objects: [{ kind: 'user', user: DKIM }] },
    ]);
});

const PROJECT = { title: 'tasklet Roadmap', url: 'https://github.com/users/mlaine/projects/1' };

function buildIssueThread(events: ThreadEvent[], comments: ItemComment[] = []) {
    return buildThread({ detail: issueDetail(events, comments) });
}

function buildPullRequestThread(events: ThreadEvent[], comments: ItemComment[]) {
    return buildThread({ detail: pullRequestDetail(events, comments) });
}

/** `count` comments by sofiab, a minute apart, `C1` the oldest. */
function manyComments(count: number) {
    return Array.from({ length: count }, (_, index) => comment(`C${index + 1}`, SOFIAB, index + 1));
}

function idsOf(thread: ThreadItem[]) {
    return thread.map(entry => entry.id);
}

function foldOf(thread: ThreadItem[]): ThreadFold {
    const found = thread.find(entry => entry.kind === 'fold');
    if (found?.kind !== 'fold') {
        throw new Error('No fold');
    }

    return found;
}

function fold(counts: Partial<Omit<ThreadFold, 'kind' | 'id'>>): ThreadFold {
    return { kind: 'fold', id: 'fold', commits: 0, comments: 0, otherEvents: 0, ...counts };
}

function failedComment(id: number): FailedComment {
    return { id, itemId: D1_ISSUE.id, body: 'Not sent', reason: { kind: 'offline' }, retrying: false };
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
): PullRequestDetail {
    return {
        ...PR_DETAIL,
        checks: checks?.checks ?? [],
        checkCount: checks?.checkCount ?? 0,
        comments: { totalCount: nodes.length, first: [], nodes, olderCursor: null },
        events: { totalCount: newest.length, commitCount: newest.length, oldest: [], newest, middle: null },
    };
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

function merged(id: string, minutes: number): ThreadEvent {
    return { ...base(id, MLAINE, minutes), kind: 'merged', commit: null, into: 'main' };
}

function closed(id: string, minutes: number): ThreadEvent {
    return { ...base(id, MLAINE, minutes), kind: 'closed', stateReason: null, closer: null, duplicateOf: null };
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
        cancelled: false,
        url: null,
        startedAt: at(completedMinutes ?? 0),
        completedAt: completedMinutes === null ? null : at(completedMinutes),
    };
}

function review(
    id: string,
    author: ItemUser,
    state: ItemReviewSummary['state'],
    minutes: number,
    bodyHtml = '',
): ItemReviewSummary {
    return {
        id,
        url: `https://github.com/kedrzu/githq/pull/1#pullrequestreview-${id}`,
        author,
        state,
        bodyHtml,
        submittedAt: at(minutes),
    };
}

function reviewThread(id: string, comments: ReviewThreadComment[], changes: Partial<ReviewThread> = {}): ReviewThread {
    return {
        id,
        path: 'src/store/schema.ts',
        line: 12,
        startLine: null,
        originalLine: 12,
        originalStartLine: null,
        diffSide: 'RIGHT',
        startDiffSide: null,
        isOutdated: false,
        isResolved: false,
        subjectType: 'LINE',
        viewerCanReply: true,
        viewerCanResolve: true,
        viewerCanUnresolve: false,
        comments,
        ...changes,
    };
}

function threadComment(
    id: string,
    author: ItemUser,
    minutes: number,
    reviewId: string,
    state: ReviewThreadComment['state'] = 'SUBMITTED',
): ReviewThreadComment {
    return {
        id,
        author,
        bodyHTML: `<p>${id}</p>`,
        createdAt: at(minutes),
        url: `https://github.com/kedrzu/githq/pull/1#discussion_${id}`,
        diffHunk: '@@ -1 +1 @@\n+const a = 1;',
        outdated: false,
        state,
        originalCommit: { oid: 'c0ffee00', abbreviatedOid: 'c0ffee0' },
        pullRequestReview: { id: reviewId },
    };
}

/** Every code comment the thread shows, wherever. */
function commentIdsOf(built: ThreadItem[]) {
    return built.flatMap(entry => {
        switch (entry.kind) {
            case 'review':
                return [...entry.threads, ...entry.resolved].flatMap(held => held.comments.map(each => each.id));
            case 'codeComment':
                return entry.thread.comments.map(each => each.id);
            case 'pendingReview':
                return entry.threads.flatMap(held => held.comments.map(each => each.id));
            default:
                return [];
        }
    });
}
