/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own logins, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';
import { createPromise } from '@nzyme/utils/createPromise.js';
import { watch } from 'vue';

import type { FailedTextEdit } from '@/edits/CommentDrafts.js';
import { ItemResolver } from '@/item/ItemResolver.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { createTestSession } from '@/testing/createTestSession.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';
import { samplePullRequestDetailNode } from '@/testing/sampleDetailNodes.js';
import { sampleThread } from '@/testing/sampleThreads.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { uniqueLogin } from '@/testing/uniqueLogin.js';
import { waitUntil } from '@/testing/waitUntil.js';

import { ReviewBlobStore } from '../ReviewBlobStore.js';
import { ReviewFiles } from '../ReviewFiles.js';
import type { PullRequestFiles } from '../ReviewFiles.js';
import type { ReviewThread, ReviewThreadComment } from '../threads/ReviewThread.js';
import type { ReviewCommentStatus, ReviewDiscardedComment } from './ReviewWriting.js';

const REFERENCE = { owner: 'acme', name: 'web', number: 7 };
const PULL_REQUEST = 'PR_7';
const HEAD = 'head-1';
const LINE = { path: 'a.ts', side: 'after', line: 3, startLine: null, threadId: null } as const;
const WRITES = [
    'AddPullRequestReview',
    'SendPullRequestReview',
    'AddPullRequestReviewThread',
    'SubmitPullRequestReview',
    'DeletePullRequestReview',
    'AddPullRequestReviewThreadReply',
    'StartPullRequestReview',
    'ResolveReviewThread',
    'UnresolveReviewThread',
    'UpdatePullRequestReviewComment',
    'DeletePullRequestReviewComment',
];
const REPLY = { path: 'a.ts', side: 'after', line: 3, startLine: null, threadId: 'T_1' } as const;
const DRAFT_TAKEN = 'User can only have one pending review per pull request';

/** A GitHub holding one pull request and the viewer's draft, refusing as the real one does. */
function createGitHub() {
    let threadsRead = 0;
    const github = {
        /** What the list says the head is; a push moves it. */
        head: HEAD,
        draft: null as { id: string; comments: number } | null,
        /** Threads as read. */
        threads: [] as ReviewThread[],
        /** A draft opened on GitHub after the reply's check: it joins it silently. */
        replyJoins: false,
        /** Reading the threads answers with a 502. */
        threadsFail: false,
        refused: new Map<string, string>(),
        threadsRead: () => threadsRead,
        answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
            const refusal = github.refused.get(request.operation);
            if (refusal !== undefined) {
                return { data: null, errors: [{ type: 'UNPROCESSABLE', message: refusal, path: [] }] };
            }

            switch (request.operation) {
                case 'PullRequestReviewFiles':
                    return {
                        data: {
                            repository: {
                                pullRequest: {
                                    id: PULL_REQUEST,
                                    headRefOid: github.head,
                                    baseRefOid: 'base',
                                    changedFiles: 0,
                                    files: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
                                },
                            },
                        },
                    };
                case 'PullRequestReviewThreads':
                    threadsRead++;
                    if (github.threadsFail) {
                        return undefined;
                    }

                    return {
                        data: {
                            repository: {
                                pullRequest: {
                                    reviewThreads: {
                                        pageInfo: { hasNextPage: false, endCursor: null },
                                        nodes: github.threads.map(thread => ({
                                            ...thread,
                                            comments: {
                                                pageInfo: { hasNextPage: false, endCursor: null },
                                                nodes: thread.comments,
                                            },
                                        })),
                                    },
                                },
                            },
                        },
                    };
                case 'ItemDetail':
                    return {
                        data: {
                            node: {
                                ...samplePullRequestDetailNode(PULL_REQUEST, '2026-01-01T00:00:00Z'),
                                headRefOid: github.head,
                                pendingReviews: {
                                    nodes: github.draft
                                        ? [
                                              {
                                                  id: github.draft.id,
                                                  createdAt: '2026-01-01T00:00:00Z',
                                                  comments: { totalCount: github.draft.comments },
                                              },
                                          ]
                                        : [],
                                },
                            },
                        },
                    };
                case 'AddPullRequestReview':
                    return answerAddReview(request);
                case 'StartPullRequestReview':
                    github.draft = { id: 'DRAFT', comments: 0 };
                    return {
                        data: {
                            addPullRequestReview: {
                                pullRequestReview: {
                                    id: 'DRAFT',
                                    createdAt: '2026-01-01T00:00:00Z',
                                },
                            },
                        },
                    };
                case 'AddPullRequestReviewThreadReply': {
                    // What GitHub does: a draft open, whichever way it knows of it, takes the reply in.
                    const joins = github.draft !== null || github.replyJoins;
                    if (github.draft) {
                        github.draft.comments++;
                    }

                    return {
                        data: {
                            addPullRequestReviewThreadReply: {
                                comment: {
                                    pullRequestReview: { id: 'DRAFT', state: joins ? 'PENDING' : 'SUBMITTED' },
                                },
                            },
                        },
                    };
                }
                case 'ResolveReviewThread':
                case 'UnresolveReviewThread': {
                    const isResolved = request.operation === 'ResolveReviewThread';
                    github.threads = github.threads.map(thread =>
                        thread.id === request.variables.threadId ? { ...thread, isResolved } : thread,
                    );
                    return {
                        data: {
                            [isResolved ? 'resolveReviewThread' : 'unresolveReviewThread']: {
                                thread: { id: request.variables.threadId },
                            },
                        },
                    };
                }
                case 'UpdatePullRequestReviewComment':
                    return answerUpdateComment(request);
                case 'DeletePullRequestReviewComment': {
                    const { id } = request.variables;
                    const deleted = github.threads
                        .flatMap(({ comments }) => comments)
                        .find(comment => comment.id === id);
                    if (deleted?.state === 'PENDING' && github.draft) {
                        github.draft.comments--;
                    }

                    github.threads = github.threads.flatMap(thread => {
                        const comments = thread.comments.filter(comment => comment.id !== id);
                        return comments.length > 0 ? [{ ...thread, comments }] : [];
                    });
                    return { data: { deletePullRequestReviewComment: { clientMutationId: null } } };
                }
                case 'AddPullRequestReviewThread':
                    if (github.draft) {
                        github.draft.comments++;
                    }

                    return { data: { addPullRequestReviewThread: { thread: { id: 'T' } } } };
                case 'SendPullRequestReview':
                    return { data: { addPullRequestReview: { pullRequestReview: { id: 'R' } } } };
                case 'ItemByNumber':
                    return { data: { repository: { issueOrPullRequest: { id: PULL_REQUEST } } } };
                case 'SubmitPullRequestReview':
                    github.draft = null;
                    return { data: { submitPullRequestReview: { pullRequestReview: { id: 'R' } } } };
                case 'DeletePullRequestReview':
                    github.draft = null;
                    return { data: { deletePullRequestReview: { pullRequestReview: { id: 'R' } } } };
                default:
                    return undefined;
            }
        },
    };
    return github;

    function answerUpdateComment(request: TestGraphQLRequest): TestGraphQLAnswer {
        const { id, body } = request.variables;
        let updated: ReviewThreadComment | null = null;
        github.threads = github.threads.map(thread => ({
            ...thread,
            comments: thread.comments.map(comment => {
                if (comment.id !== id || typeof body !== 'string') {
                    return comment;
                }

                updated = { ...comment, body, bodyHTML: `<p>${body}</p>`, lastEditedAt: '2026-11-19T12:00:00Z' };
                return updated;
            }),
        }));
        return { data: { updatePullRequestReviewComment: { pullRequestReviewComment: updated } } };
    }

    function answerAddReview(request: TestGraphQLRequest): TestGraphQLAnswer {
        if (github.draft) {
            return { data: null, errors: [{ type: 'UNPROCESSABLE', message: DRAFT_TAKEN, path: [] }] };
        }

        if (request.variables.event === undefined) {
            github.draft = { id: 'DRAFT', comments: 1 };
        }

        return {
            data: {
                addPullRequestReview: {
                    pullRequestReview: {
                        id: 'DRAFT',
                        createdAt: '2026-01-01T00:00:00Z',
                        comments: { totalCount: 1 },
                    },
                },
            },
        };
    }
}

type TestGitHub = ReturnType<typeof createGitHub>;

async function open(github: TestGitHub, login = uniqueLogin()) {
    const session = createTestSession({
        login,
        answer: request => github.answer(request),
        answerRest: request => (request.operation.endsWith('/pulls/7/files') ? { status: 200, body: [] } : undefined),
    });
    setIndexedDbPersistence(session.container);
    const model = session.container.resolve(ReviewFiles).open(REFERENCE);
    if (!model) {
        throw new Error('Signed in, so it opens');
    }

    const details = session.container.resolve(ItemDetailStore);
    await waitUntil(() => model.id !== null && model.threadsState.kind === 'ready', { timeoutMs: 2000 });
    await details.readAgain(PULL_REQUEST);
    return { session, model, login, writes: () => session.operations().filter(name => WRITES.includes(name)) };
}

/** Opened as the item's thread opens it: for its threads alone, with no list of files read. */
async function openThreads(github: TestGitHub) {
    const session = createTestSession({
        login: uniqueLogin(),
        answer: request => github.answer(request),
    });
    setIndexedDbPersistence(session.container);
    const details = session.container.resolve(ItemDetailStore);
    await session.container.resolve(ItemResolver).resolve(REFERENCE);
    await details.readAgain(PULL_REQUEST);
    const model = session.container.resolve(ReviewFiles).openThreads(REFERENCE);
    if (!model) {
        throw new Error('Signed in, so it opens');
    }

    await waitUntil(() => model.threadsState.kind === 'ready', { timeoutMs: 2000 });
    return { session, model, writes: () => session.operations().filter(name => WRITES.includes(name)) };
}

function write(model: PullRequestFiles, text: string) {
    const box = model.writing.open(LINE);
    model.writing.setText(box.id, text);
    return box.id;
}

async function ended(model: PullRequestFiles, id: string) {
    await waitUntil(
        () => {
            const { kind } = model.writing.getStatus(id);
            return kind !== 'sending' && kind !== 'sent' && model.writing.finish.kind !== 'sending';
        },
        { timeoutMs: 2000 },
    );
}

test('a single comment is one request with its commit and event, shows at once, and goes once the threads read again have it', async () => {
    const github = createGitHub();
    const { model, session, writes } = await open(github);
    const id = write(model, ' Why? ');
    const threadsBefore = github.threadsRead();

    model.writing.send(id, 'single');
    expect(model.writing.getStatus(id)).toEqual({ kind: 'sending', way: 'single', body: 'Why?' });
    model.writing.send(id, 'single');

    await waitUntil(() => model.writing.targets.length === 0, { timeoutMs: 2000 });
    expect(writes()).toEqual(['AddPullRequestReview']);
    expect(session.github.requests.find(request => request.operation === 'AddPullRequestReview')?.variables).toEqual({
        pullRequestId: PULL_REQUEST,
        commitOID: HEAD,
        event: 'COMMENT',
        thread: { path: 'a.ts', line: 3, side: 'RIGHT', body: 'Why?' },
    });
    expect(github.threadsRead()).toBeGreaterThan(threadsBefore);
    expect(model.writing.draftOpen).toBe(false);
});

test('a range goes with where it starts, on its side', async () => {
    const { model, session } = await open(createGitHub());
    const box = model.writing.open({ path: 'a.ts', side: 'before', line: 47, startLine: 44, threadId: null });
    model.writing.setText(box.id, 'All of these');

    model.writing.send(box.id, 'single');

    await waitUntil(() => model.writing.targets.length === 0, { timeoutMs: 2000 });
    expect(
        session.github.requests.find(request => request.operation === 'AddPullRequestReview')?.variables.thread,
    ).toEqual({
        path: 'a.ts',
        line: 47,
        side: 'LEFT',
        startLine: 44,
        startSide: 'LEFT',
        body: 'All of these',
    });
});

test('what is typed is back after a reload, and what was sent is not', async () => {
    const github = createGitHub();
    const first = await open(github);
    const kept = write(first.model, 'Not sent yet');
    const sent = first.model.writing.open({ ...LINE, line: 9 });
    first.model.writing.setText(sent.id, 'Sent');
    first.model.writing.send(sent.id, 'single');
    await waitUntil(() => first.model.writing.targets.length === 1, { timeoutMs: 2000 });

    const reloaded = await open(github, first.login);

    await waitUntil(() => reloaded.model.writing.targets.length > 0, { timeoutMs: 2000 });
    expect(reloaded.model.writing.targets).toEqual([{ ...LINE, id: kept, headRefOid: HEAD }]);
    expect(reloaded.model.writing.getText(kept)).toBe('Not sent yet');
});

test('a discarded box leaves the disk; restored, it is back where it was with its text, and kept again', async () => {
    const github = createGitHub();
    const first = await open(github);
    const kept = write(first.model, 'Kept');
    const discarded = first.model.writing.open({ ...LINE, line: 9 });
    first.model.writing.setText(discarded.id, 'Not wanted, or was it');

    first.model.writing.discardBox(discarded.id);

    expect(first.model.writing.targets.map(({ id }) => id)).toEqual([kept]);
    const expected: ReviewDiscardedComment = { target: discarded, text: 'Not wanted, or was it' };
    expect(first.model.writing.discarded).toEqual(expected);
    const reloaded = await open(github, first.login);
    await waitUntil(() => reloaded.model.writing.targets.length > 0, { timeoutMs: 2000 });
    expect(reloaded.model.writing.targets.map(({ id }) => id)).toEqual([kept]);

    expect(first.model.writing.restoreDiscarded()).toEqual(discarded);

    expect(first.model.writing.discarded).toBeNull();
    expect(first.model.writing.getText(discarded.id)).toBe('Not wanted, or was it');
    const again = await open(github, first.login);
    await waitUntil(() => again.model.writing.targets.length === 2, { timeoutMs: 2000 });
    expect(again.model.writing.getText(discarded.id)).toBe('Not wanted, or was it');
    expect(first.model.writing.restoreDiscarded()).toBeNull();
});

test('restored where a box was opened since, the text goes into that box, after a blank line, and no second one opens', async () => {
    const github = createGitHub();
    const { model } = await open(github);
    const { writing } = model;
    const first = write(model, 'Not wanted, or was it');
    writing.discardBox(first);
    const again = writing.open(LINE);
    writing.setText(again.id, 'Started over');

    expect(writing.restoreDiscarded()).toEqual(again);

    expect(writing.targets).toEqual([again]);
    expect(writing.getText(again.id)).toBe('Started over\n\nNot wanted, or was it');

    const replyBox = writing.open(REPLY);
    writing.setText(replyBox.id, 'Agreed');
    writing.discardBox(replyBox.id);
    const empty = writing.open(REPLY);

    expect(writing.restoreDiscarded()).toEqual(empty);

    expect(writing.targets).toEqual([again, empty]);
    expect(writing.getText(empty.id)).toBe('Agreed');
});

test('a stale "no draft": GitHub refuses the single comment, the text stays, the draft is read, and it goes once, into the draft', async () => {
    const github = createGitHub();
    const { model, writes } = await open(github);
    expect(model.writing.draftOpen).toBe(false);
    github.draft = { id: 'ON_GITHUB', comments: 2 };
    const id = write(model, 'Keep me');

    model.writing.send(id, 'single');
    await ended(model, id);

    expect(model.writing.getStatus(id)).toEqual({ kind: 'failed', failure: { kind: 'refused', message: DRAFT_TAKEN } });
    expect(model.writing.getText(id)).toBe('Keep me');
    await waitUntil(() => model.writing.draftOpen, { timeoutMs: 2000 });
    expect(model.writing.draftCount).toBe(2);
    expect(writes()).toEqual(['AddPullRequestReview']);

    model.writing.send(id, 'joinDraft');
    await waitUntil(() => model.writing.targets.length === 0, { timeoutMs: 2000 });

    expect(writes()).toEqual(['AddPullRequestReview', 'AddPullRequestReviewThread']);
    expect(github.draft.comments).toBe(3);
});

test('a comment waits for the draft the one before it starts, and joins it', async () => {
    const github = createGitHub();
    const { model, writes } = await open(github);
    const first = write(model, 'Starts it');
    const second = model.writing.open({ ...LINE, line: 9 });
    model.writing.setText(second.id, 'Joins it');

    model.writing.send(first, 'startDraft');
    expect(model.writing.draftOpen).toBe(true);
    model.writing.send(second.id, 'joinDraft');
    expect(model.writing.draftCount).toBe(2);

    await waitUntil(() => model.writing.targets.length === 0, { timeoutMs: 2000 });

    expect(writes()).toEqual(['AddPullRequestReview', 'AddPullRequestReviewThread']);
    expect(github.draft?.comments).toBe(2);
    expect(model.writing.draftCount).toBe(2);
});

test('the second key adds the comment and submits as a comment review; refused, the toolbar says so, the comment is safe in the draft, and Try again sends the same', async () => {
    const github = createGitHub();
    github.draft = { id: 'DRAFT', comments: 3 };
    const { model, session, writes } = await open(github);
    github.refused.set('SubmitPullRequestReview', 'Nope');
    const id = write(model, 'One more');

    model.writing.send(id, 'joinAndSubmit');
    await waitUntil(() => model.writing.finish.kind === 'failed', { timeoutMs: 2000 });

    expect(model.writing.finish).toMatchObject({ failure: { kind: 'refused', message: 'Nope' } });
    expect(writes()).toEqual(['AddPullRequestReviewThread', 'SubmitPullRequestReview']);
    expect(github.draft?.comments).toBe(4);
    await waitUntil(() => model.writing.targets.length === 0, { timeoutMs: 2000 });

    github.refused.clear();
    model.writing.retry();
    await waitUntil(() => model.writing.finish.kind === 'idle', { timeoutMs: 2000 });

    expect(
        session.github.requests.findLast(request => request.operation === 'SubmitPullRequestReview')?.variables,
    ).toEqual({ pullRequestReviewId: 'DRAFT', event: 'COMMENT' });
    expect(github.draft).toBeNull();
});

test('a refused approval keeps the choice and the draft; sent, the dialog is empty again', async () => {
    const github = createGitHub();
    github.draft = { id: 'DRAFT', comments: 1 };
    const { model } = await open(github);
    github.refused.set('SubmitPullRequestReview', 'Can not approve your own pull request');
    const choice = { event: 'APPROVE', body: 'Good' } as const;
    model.writing.setSubmission(choice);

    model.writing.submit(choice);
    await waitUntil(() => model.writing.finish.kind === 'failed', { timeoutMs: 2000 });

    expect(model.writing.finish).toMatchObject({
        finish: { kind: 'submit', choice },
        failure: { message: 'Can not approve your own pull request' },
    });
    expect(model.writing.submission).toEqual(choice);
    expect(model.writing.draftOpen).toBe(true);

    github.refused.clear();
    model.writing.submit(choice);
    await waitUntil(() => model.writing.finish.kind === 'idle', { timeoutMs: 2000 });

    expect(model.writing.submission).toEqual({ event: 'COMMENT', body: '' });
    expect(model.writing.draftOpen).toBe(false);
});

test('discarding deletes the draft; refused, it says so and the draft stays', async () => {
    const github = createGitHub();
    github.draft = { id: 'DRAFT', comments: 1 };
    const { model, writes } = await open(github);
    github.refused.set('DeletePullRequestReview', 'Nope');

    model.writing.discard();
    await waitUntil(() => model.writing.finish.kind === 'failed', { timeoutMs: 2000 });
    expect(model.writing.draftOpen).toBe(true);

    github.refused.clear();
    model.writing.retry();
    await waitUntil(() => model.writing.finish.kind === 'idle', { timeoutMs: 2000 });

    expect(writes()).toEqual(['DeletePullRequestReview', 'DeletePullRequestReview']);
    expect(model.writing.draftOpen).toBe(false);
});

test('signing out: what waits goes nowhere, what was typed leaves memory and the disk, and nothing brings it back', async () => {
    const github = createGitHub();
    const { model, session, login, writes } = await open(github);
    const release = holdOperation(session, 'AddPullRequestReview');
    const first = write(model, 'Holding the queue');
    const second = model.writing.open({ ...LINE, line: 9 });
    model.writing.setText(second.id, 'Waiting behind it');
    model.writing.send(first, 'single');
    model.writing.send(second.id, 'single');
    await waitUntil(() => writes().length === 1, { timeoutMs: 2000 });

    session.signOutFromAnotherTab();
    release();
    await aMoment();

    expect(writes()).toEqual(['AddPullRequestReview']);
    expect(model.writing.targets).toEqual([]);
    model.writing.setText(second.id, 'Too late');
    expect(model.writing.getText(second.id)).toBe('');

    const again = await open(github, login);
    await aMoment();
    expect(again.model.writing.targets).toEqual([]);
});

test('an approval with no draft is one request naming the head read, with no threads', async () => {
    const github = createGitHub();
    const { model, session, writes } = await open(github);

    model.writing.submit({ event: 'APPROVE', body: '' });
    await waitUntil(() => writes().length === 1 && model.writing.finish.kind === 'idle', { timeoutMs: 2000 });

    expect(writes()).toEqual(['SendPullRequestReview']);
    expect(session.github.requests.find(request => request.operation === 'SendPullRequestReview')?.variables).toEqual({
        pullRequestId: PULL_REQUEST,
        commitOID: HEAD,
        event: 'APPROVE',
    });
});

test('a review refused with no draft stays said, the draft read again or not, and Try again sends the same', async () => {
    const github = createGitHub();
    const { model, session, writes } = await open(github);
    github.refused.set('SendPullRequestReview', 'Review Can not approve your own pull request');
    const reads = session.operations().filter(name => name === 'ItemDetail').length;

    model.writing.submit({ event: 'APPROVE', body: 'Reads well' });
    await waitUntil(() => session.operations().filter(name => name === 'ItemDetail').length > reads, {
        timeoutMs: 2000,
    });
    await aMoment();

    expect(model.writing.finish).toMatchObject({
        kind: 'failed',
        failure: { kind: 'refused', message: 'Review Can not approve your own pull request' },
    });
    expect(model.writing.submission.body).toBe('');

    github.refused.clear();
    model.writing.retry();
    await waitUntil(() => model.writing.finish.kind === 'idle', { timeoutMs: 2000 });
    expect(writes()).toEqual(['SendPullRequestReview', 'SendPullRequestReview']);
});

test('a dialog review refused against a draft gone elsewhere stays red, and Try again sends it with no draft', async () => {
    const github = createGitHub();
    github.draft = { id: 'DRAFT', comments: 1 };
    const { model, session, writes } = await open(github);
    github.draft = null;
    github.refused.set('SubmitPullRequestReview', 'Could not comment pull request review.');
    const reads = session.operations().filter(name => name === 'ItemDetail').length;

    model.writing.submit({ event: 'APPROVE', body: 'Reads well' });
    await waitUntil(() => session.operations().filter(name => name === 'ItemDetail').length > reads, {
        timeoutMs: 2000,
    });
    await waitUntil(() => !model.writing.draftOpen, { timeoutMs: 2000 });
    await aMoment();

    expect(model.writing.finish).toMatchObject({
        kind: 'failed',
        failure: { kind: 'refused', message: 'Could not comment pull request review.' },
        draftId: 'DRAFT',
    });

    github.refused.clear();
    model.writing.retry();
    await waitUntil(() => model.writing.finish.kind === 'idle', { timeoutMs: 2000 });

    expect(writes()).toEqual(['SubmitPullRequestReview', 'SendPullRequestReview']);
    expect(session.github.requests.find(request => request.operation === 'SendPullRequestReview')?.variables).toEqual({
        pullRequestId: PULL_REQUEST,
        commitOID: HEAD,
        event: 'APPROVE',
        body: 'Reads well',
    });
});

test('no answer to a review, and the draft gone: it got there, so nothing is red and the choice is empty', async () => {
    const github = createGitHub();
    github.draft = { id: 'DRAFT', comments: 1 };
    const { model, session } = await open(github);
    const choice = { event: 'APPROVE', body: 'Good' } as const;
    model.writing.setSubmission(choice);
    github.draft = null;
    session.github.holdIf = request =>
        request.operation === 'SubmitPullRequestReview' ? Promise.reject(new TypeError('Failed to fetch')) : null;

    model.writing.submit(choice);
    await waitUntil(() => session.operations().includes('SubmitPullRequestReview'), { timeoutMs: 2000 });
    await waitUntil(() => model.writing.finish.kind === 'idle', { timeoutMs: 2000 });

    expect(model.writing.submission).toEqual({ event: 'COMMENT', body: '' });
});

test('a comment ahead of a submit refused: nothing is sent, it says why, and Try again sends without that comment', async () => {
    const github = createGitHub();
    const { model, writes } = await open(github);
    github.refused.set('AddPullRequestReview', 'Line is outside the diff');
    const id = write(model, 'Refused');

    model.writing.send(id, 'startDraft');
    model.writing.submit({ event: 'APPROVE', body: '' });
    await waitUntil(() => model.writing.finish.kind === 'failed', { timeoutMs: 2000 });
    await aMoment();

    expect(writes()).toEqual(['AddPullRequestReview']);
    expect(model.writing.finish).toMatchObject({ failure: { kind: 'commentRefused' }, draftId: null });
    expect(model.writing.getText(id)).toBe('Refused');

    model.writing.retry();
    await waitUntil(() => model.writing.finish.kind === 'idle', { timeoutMs: 2000 });

    expect(writes()).toEqual(['AddPullRequestReview', 'SendPullRequestReview']);
    expect(model.writing.getStatus(id).kind).toBe('failed');
});

test('Try again with a different draft open now does nothing: only the dialog submits a draft not seen', async () => {
    const github = createGitHub();
    const { model, session, writes } = await open(github);
    github.refused.set('SendPullRequestReview', 'Nope');

    model.writing.submit({ event: 'APPROVE', body: '' });
    await waitUntil(() => model.writing.finish.kind === 'failed', { timeoutMs: 2000 });
    github.refused.clear();
    github.draft = { id: 'ELSEWHERE', comments: 2 };
    await session.container.resolve(ItemDetailStore).readAgain(PULL_REQUEST);

    expect(model.writing.canRetry).toBe(false);
    expect(model.writing.canDismiss).toBe(true);
    model.writing.retry();
    await aMoment();

    expect(writes()).toEqual(['SendPullRequestReview']);
    expect(model.writing.finish.kind).toBe('failed');
});

test('Dismiss puts the failure away and keeps the choice; with the draft still open there is nothing to dismiss', async () => {
    const github = createGitHub();
    github.draft = { id: 'DRAFT', comments: 1 };
    const { model, session } = await open(github);
    github.refused.set('SubmitPullRequestReview', 'Nope');
    const choice = { event: 'APPROVE', body: 'Good' } as const;
    model.writing.setSubmission(choice);

    model.writing.submit(choice);
    await waitUntil(() => model.writing.finish.kind === 'failed', { timeoutMs: 2000 });
    expect(model.writing.canDismiss).toBe(false);
    model.writing.dismiss();
    expect(model.writing.finish.kind).toBe('failed');

    github.draft = null;
    await session.container.resolve(ItemDetailStore).readAgain(PULL_REQUEST);
    expect(model.writing.canDismiss).toBe(true);
    model.writing.dismiss();

    expect(model.writing.finish.kind).toBe('idle');
    expect(model.writing.submission).toEqual(choice);
});

test("a draft of the reader's own clears a failure sent against none; joining the draft it was sent against keeps it", async () => {
    const github = createGitHub();
    const { model } = await open(github);
    github.refused.set('SendPullRequestReview', 'Nope');

    model.writing.submit({ event: 'APPROVE', body: '' });
    await waitUntil(() => model.writing.finish.kind === 'failed', { timeoutMs: 2000 });

    const first = write(model, 'Starts a draft');
    model.writing.send(first, 'startDraft');
    await waitUntil(() => model.writing.targets.length === 0, { timeoutMs: 2000 });
    expect(model.writing.finish.kind).toBe('idle');

    github.refused.set('SubmitPullRequestReview', 'Nope');
    model.writing.submit({ event: 'APPROVE', body: '' });
    await waitUntil(() => model.writing.finish.kind === 'failed', { timeoutMs: 2000 });

    const second = write(model, 'Joins it');
    model.writing.send(second, 'joinDraft');
    await waitUntil(() => model.writing.targets.length === 0, { timeoutMs: 2000 });
    expect(model.writing.finish).toMatchObject({ kind: 'failed', draftId: 'DRAFT' });
    expect(github.draft?.comments).toBe(2);
});

test('GitHub refusing with an empty message leaves the reason to the app', async () => {
    const github = createGitHub();
    const { model } = await open(github);
    github.refused.set('SendPullRequestReview', '');

    model.writing.submit({ event: 'COMMENT', body: '' });
    await waitUntil(() => model.writing.finish.kind === 'failed', { timeoutMs: 2000 });

    expect(model.writing.finish).toMatchObject({ failure: { kind: 'refused', message: null } });
});

test('discarding with no draft sends nothing', async () => {
    const github = createGitHub();
    const { model, writes } = await open(github);

    model.writing.discard();
    await aMoment();

    expect(model.writing.finish.kind).toBe('idle');
    expect(writes()).toEqual([]);
});

test('after a discard a read still listing the pending comments shows none, keeps none on disk, until a draft opens again', async () => {
    const github = createGitHub();
    github.draft = { id: 'DRAFT', comments: 2 };
    github.threads = [threadOf('T_1', ['SUBMITTED', 'PENDING']), threadOf('T_2', ['PENDING'])];
    const { model, session, login } = await open(github);
    expect(model.threads.map(thread => thread.id)).toEqual(['T_1', 'T_2']);

    model.writing.discard();
    await waitUntil(() => model.writing.finish.kind === 'idle' && !model.writing.draftOpen, { timeoutMs: 2000 });
    await aMoment();

    expect(model.threads.map(({ id, comments }) => [id, comments.length])).toEqual([['T_1', 1]]);
    const kept = await session.container.resolve(ReviewBlobStore).readThreads(login, 'acme/web/7');
    expect(kept?.map(({ id, comments }) => [id, comments.length])).toEqual([['T_1', 1]]);

    const box = write(model, 'Again');
    model.writing.send(box, 'startDraft');
    await ended(model, box);
    await waitUntil(() => model.threads.length === 2, { timeoutMs: 2000 });
});

test('a pending comment read before a draft is known still shows, for no discard took it', async () => {
    const github = createGitHub();
    github.threads = [threadOf('T_1', ['PENDING'])];
    const { model } = await open(github);

    expect(model.writing.draftOpen).toBe(false);
    expect(model.threads).toHaveLength(1);
});

test("a draft can be discarded before the first page of the list: its id is the item's", async () => {
    const github = createGitHub();
    github.draft = { id: 'DRAFT', comments: 1 };
    const session = createTestSession({
        login: uniqueLogin(),
        answer: request => github.answer(request),
    });
    setIndexedDbPersistence(session.container);
    session.github.holdIf = request =>
        request.operation === 'PullRequestReviewFiles' ? new Promise<void>(() => {}) : null;
    await session.container.resolve(ItemResolver).resolve(REFERENCE);
    await session.container.resolve(ItemDetailStore).readAgain(PULL_REQUEST);
    const model = session.container.resolve(ReviewFiles).open(REFERENCE);
    if (!model) {
        throw new Error('Signed in, so it opens');
    }

    expect(model.id).toBeNull();
    expect(model.writing.draftOpen).toBe(true);

    model.writing.discard();
    await waitUntil(() => session.operations().includes('DeletePullRequestReview'), { timeoutMs: 2000 });
});

test('no answer to a comment reads the threads too: one that got there shows beside the text kept', async () => {
    const github = createGitHub();
    const { model, session } = await open(github);
    const id = write(model, 'It may have gone');
    session.github.holdIf = request =>
        request.operation === 'AddPullRequestReview' ? Promise.reject(new TypeError('Failed to fetch')) : null;
    const before = github.threadsRead();
    github.threads = [sampleThread()];

    model.writing.send(id, 'single');
    await waitUntil(() => model.writing.getStatus(id).kind === 'failed', { timeoutMs: 2000 });
    await waitUntil(() => github.threadsRead() > before && model.threads.length === 1, { timeoutMs: 2000 });

    expect(model.writing.getStatus(id)).toEqual({ kind: 'failed', failure: { kind: 'notReached' } });
    expect(model.writing.getText(id)).toBe('It may have gone');
});

test('a thread resolved whose read failed can be opened again: the new toggle goes and draws over the old', async () => {
    const github = createGitHub();
    github.threads = [sampleThread()];
    const { model, writes } = await open(github);
    github.threadsFail = true;

    model.writing.setResolved('T_1', true);
    await waitUntil(() => writes().length === 1 && model.threadsState.kind !== 'ready', { timeoutMs: 2000 });
    await aMoment();
    expect(model.threads[0]?.isResolved).toBe(true);

    model.writing.setResolved('T_1', false);
    expect(model.threads[0]?.isResolved).toBe(false);
    await waitUntil(() => writes().length === 2, { timeoutMs: 2000 });

    expect(writes()).toEqual(['ResolveReviewThread', 'UnresolveReviewThread']);
    github.threadsFail = false;
    model.writing.setResolved('T_1', true);
    await waitUntil(() => writes().length === 3, { timeoutMs: 2000 });
    await waitUntil(() => model.threads[0]?.isResolved === true, { timeoutMs: 2000 });
});

test('no answer to a resolve that got there: read again the thread shows it, and nothing says it failed', async () => {
    const github = createGitHub();
    github.threads = [sampleThread()];
    const { model, session } = await open(github);
    github.threads = [sampleThread({ isResolved: true })];
    session.github.holdIf = request =>
        request.operation === 'ResolveReviewThread' ? Promise.reject(new TypeError('Failed to fetch')) : null;
    const before = github.threadsRead();

    model.writing.setResolved('T_1', true);
    await waitUntil(() => github.threadsRead() > before && model.threads[0]?.isResolved === true, {
        timeoutMs: 2000,
    });
    await aMoment();

    expect(model.writing.getResolveFailure('T_1')).toBeNull();
});

test('no answer to a resolve that did not get there: the failure stays', async () => {
    const github = createGitHub();
    github.threads = [sampleThread()];
    const { model, session } = await open(github);
    session.github.holdIf = request =>
        request.operation === 'ResolveReviewThread' ? Promise.reject(new TypeError('Failed to fetch')) : null;

    model.writing.setResolved('T_1', true);
    await waitUntil(() => model.writing.getResolveFailure('T_1') !== null, { timeoutMs: 2000 });
    await aMoment();

    expect(model.writing.getResolveFailure('T_1')).toEqual({ kind: 'notReached' });
});

test('signed out while a reply checks for a draft: the reply does not go', async () => {
    const github = createGitHub();
    github.threads = [sampleThread()];
    const { model, session, writes } = await open(github);
    const id = reply(model, 'Agreed');
    const release = holdOperation(session, 'ItemDetail');

    model.writing.send(id, 'single');
    await waitUntil(() => session.github.requests.at(-1)?.operation === 'ItemDetail', { timeoutMs: 2000 });
    session.signOutFromAnotherTab();
    release();
    await aMoment();

    expect(writes()).toEqual([]);
});

test('signed out while a reply starts its draft: the reply does not go, and the empty draft does', async () => {
    const github = createGitHub();
    github.threads = [sampleThread()];
    const { model, session, writes } = await open(github);
    const id = reply(model, 'Agreed');
    const release = holdOperation(session, 'StartPullRequestReview');

    model.writing.send(id, 'startDraft');
    await waitUntil(() => writes().length === 1, { timeoutMs: 2000 });
    session.signOutFromAnotherTab();
    release();
    await aMoment();

    expect(writes()).toEqual(['StartPullRequestReview', 'DeletePullRequestReview']);
});

test('a push: the box says so, text and place kept, sends once on the new head; with the head the same it never says so', async () => {
    const github = createGitHub();
    const { model, session, writes } = await open(github);
    const id = write(model, 'Why?');
    expect(model.writing.hasCodeChanged(id)).toBe(false);

    await push(github, session, model);

    expect(model.writing.hasCodeChanged(id)).toBe(true);
    expect(model.writing.getText(id)).toBe('Why?');
    expect(model.writing.targets[0]?.line).toBe(LINE.line);

    model.writing.send(id, 'single');
    model.writing.send(id, 'single');
    await waitUntil(() => model.writing.targets.length === 0, { timeoutMs: 2000 });

    expect(writes()).toEqual(['AddPullRequestReview']);
    expect(session.github.requests.find(request => request.operation === 'AddPullRequestReview')?.variables).toEqual({
        pullRequestId: PULL_REQUEST,
        commitOID: 'head-2',
        event: 'COMMENT',
        thread: { path: 'a.ts', line: 3, side: 'RIGHT', body: 'Why?' },
    });
});

test('a box kept on disk says so on a newer head, and typing there does not make the old head the new one', async () => {
    const github = createGitHub();
    const { model, login } = await open(github);
    const id = write(model, 'Half a');
    // Written to disk behind the key press.
    await Bun.sleep(50);
    github.head = 'head-2';

    const { model: again } = await open(github, login);
    await waitUntil(() => again.writing.targets.length > 0 && again.headRefOid === 'head-2', { timeoutMs: 2000 });

    expect(again.writing.getText(id)).toBe('Half a');
    expect(again.writing.hasCodeChanged(id)).toBe(true);

    again.writing.setText(id, 'Half a thought');
    await Bun.sleep(50);
    const { model: third } = await open(github, login);
    await waitUntil(() => third.writing.targets.length > 0 && third.headRefOid === 'head-2', { timeoutMs: 2000 });

    expect(third.writing.getText(id)).toBe('Half a thought');
    expect(third.writing.hasCodeChanged(id)).toBe(true);
});

test('changing the range takes the head of now, on disk too; the same range is no new look', async () => {
    const github = createGitHub();
    const { model, session, login } = await open(github);
    const id = write(model, 'Why?');
    await push(github, session, model);

    model.writing.setRange(id, LINE.startLine, LINE.line);
    expect(model.writing.hasCodeChanged(id)).toBe(true);

    model.writing.setRange(id, 2, LINE.line);
    expect(model.writing.hasCodeChanged(id)).toBe(false);
    expect(model.writing.getText(id)).toBe('Why?');

    await Bun.sleep(50);
    const { model: again } = await open(github, login);
    await waitUntil(() => again.writing.targets.length > 0, { timeoutMs: 2000 });
    expect(again.writing.hasCodeChanged(id)).toBe(false);
});

test('a head not known yet says nothing, and a range changed meanwhile keeps the head remembered', async () => {
    const github = createGitHub();
    const { model, login } = await open(github);
    const id = write(model, 'Why?');
    await Bun.sleep(50);
    github.head = 'head-2';

    const session = createTestSession({ login, answer: request => github.answer(request) });
    setIndexedDbPersistence(session.container);
    const blobs = session.container.resolve(ReviewBlobStore);
    await blobs.readCommentBoxes(login, 'acme/web/7');
    await blobs.deleteFileList(login, 'acme/web/7');
    const release = holdOperation(session, 'PullRequestReviewFiles');
    const again = session.container.resolve(ReviewFiles).open(REFERENCE);
    if (!again) {
        throw new Error('Signed in, so it opens');
    }

    await waitUntil(() => again.writing.targets.length > 0, { timeoutMs: 2000 });
    expect(again.headRefOid).toBeNull();
    expect(again.writing.hasCodeChanged(id)).toBe(false);

    again.writing.setRange(id, 2, LINE.line);
    expect(again.writing.hasCodeChanged(id)).toBe(false);

    release();
    await waitUntil(() => again.headRefOid === 'head-2', { timeoutMs: 2000 });
    expect(again.writing.hasCodeChanged(id)).toBe(true);
});

test('a reply through a push says nothing: it follows its thread', async () => {
    const github = createGitHub();
    const { model, session } = await open(github);
    const id = reply(model, 'Agreed');

    await push(github, session, model);

    expect(model.writing.hasCodeChanged(id)).toBe(false);
});

/** GitHub's head moves on and the pull request, opened again, reads it. */
async function push(github: TestGitHub, session: ReturnType<typeof createTestSession>, model: PullRequestFiles) {
    github.head = 'head-2';
    session.container.resolve(ReviewFiles).open(REFERENCE);
    await waitUntil(() => model.headRefOid === 'head-2', { timeoutMs: 2000 });
}

function holdOperation(session: ReturnType<typeof createTestSession>, operation: string) {
    let release = () => {};
    const held = new Promise<void>(resolve => {
        release = resolve;
    });
    session.github.holdIf = request => (request.operation === operation ? held : null);
    return release;
}

function threadOf(id: string, states: readonly ReviewThreadComment['state'][]) {
    const [sample] = sampleThread().comments;
    if (!sample) {
        throw new Error('The sample has comments');
    }

    return sampleThread({
        id,
        comments: states.map((state, index) => ({ ...sample, id: `${id}_${index}`, state })),
    });
}

async function aMoment() {
    await new Promise(resolve => {
        setTimeout(resolve, 20);
    });
}

function reply(model: PullRequestFiles, text: string) {
    const box = model.writing.open(REPLY);
    model.writing.setText(box.id, text);
    return box.id;
}

test('a reply with no draft goes out at once, in one request, asked only after checking for a draft', async () => {
    const github = createGitHub();
    const { model, session, writes } = await open(github);
    const id = reply(model, ' Agreed ');

    model.writing.send(id, 'single');
    expect(model.writing.getStatus(id)).toEqual({ kind: 'sending', way: 'single', body: 'Agreed' });
    model.writing.send(id, 'single');

    await waitUntil(() => model.writing.targets.length === 0, { timeoutMs: 2000 });
    expect(writes()).toEqual(['AddPullRequestReviewThreadReply']);
    expect(
        session.github.requests.find(request => request.operation === 'AddPullRequestReviewThreadReply')?.variables,
    ).toEqual({ pullRequestReviewThreadId: 'T_1', body: 'Agreed' });
    expect(model.writing.draftOpen).toBe(false);
});

test('a reply meant to go now, with a draft the model did not know of, is not sent: the box says why and its keys join now', async () => {
    const github = createGitHub();
    const { model, writes } = await open(github);
    const id = reply(model, 'Agreed');
    github.draft = { id: 'ELSEWHERE', comments: 2 };

    model.writing.send(id, 'single');
    await ended(model, id);

    expect(writes()).toEqual([]);
    expect(model.writing.getStatus(id)).toEqual({ kind: 'failed', failure: { kind: 'draftFound' } });
    expect(model.writing.getText(id)).toBe('Agreed');
    expect(model.writing.draftOpen).toBe(true);
});

test('a reply GitHub says joined a draft after all shows as in the draft, which the toolbar counts', async () => {
    const github = createGitHub();
    const { model } = await open(github);
    const id = reply(model, 'Agreed');
    github.replyJoins = true;

    const seen: ReviewCommentStatus[] = [];
    watch(
        () => model.writing.getStatus(id),
        status => seen.push(status),
        { flush: 'sync' },
    );

    model.writing.send(id, 'single');
    await waitUntil(() => model.writing.targets.length === 0, { timeoutMs: 2000 });

    expect(seen).toContainEqual({ kind: 'sent', way: 'joinDraft', body: 'Agreed' });
});

test('a reply sent goes the moment the threads read hold it, not once the draft is read too: it never shows twice', async () => {
    const github = createGitHub();
    github.threads = [threadOf('T_1', ['SUBMITTED'])];
    const { model, session, writes } = await open(github);
    const id = reply(model, 'Agreed');
    github.threads = [threadOf('T_1', ['SUBMITTED', 'SUBMITTED'])];
    const draftRead = createPromise();
    // The draft read after the reply went, not the check before it.
    session.github.holdIf = request =>
        request.operation === 'ItemDetail' && writes().length > 0 ? draftRead.promise : null;

    model.writing.send(id, 'single');
    await waitUntil(() => model.threads[0]?.comments.length === 2, { timeoutMs: 2000 });
    await aMoment();

    expect(model.writing.targets).toEqual([]);
    draftRead.resolve();
});

test('a reply joining the open draft names it, so that a draft gone by then refuses it rather than publishing it', async () => {
    const github = createGitHub();
    github.draft = { id: 'DRAFT', comments: 2 };
    const { model, session } = await open(github);
    const id = reply(model, 'Agreed');

    model.writing.send(id, 'joinDraft');
    await waitUntil(() => model.writing.targets.length === 0, { timeoutMs: 2000 });

    expect(
        session.github.requests.find(request => request.operation === 'AddPullRequestReviewThreadReply')?.variables,
    ).toEqual({ pullRequestReviewThreadId: 'T_1', body: 'Agreed', pullRequestReviewId: 'DRAFT' });
    expect(github.draft.comments).toBe(3);
});

test('a reply starting a draft takes two requests; refused, the empty draft goes and the text stays', async () => {
    const github = createGitHub();
    const { model, writes } = await open(github);
    const id = reply(model, 'Agreed');
    github.refused.set('AddPullRequestReviewThreadReply', 'Thread is locked');

    model.writing.send(id, 'startDraft');
    await ended(model, id);

    expect(writes()).toEqual(['StartPullRequestReview', 'AddPullRequestReviewThreadReply', 'DeletePullRequestReview']);
    expect(model.writing.getStatus(id)).toEqual({
        kind: 'failed',
        failure: { kind: 'refused', message: 'Thread is locked' },
    });
    expect(model.writing.getText(id)).toBe('Agreed');
    expect(model.writing.draftOpen).toBe(false);

    github.refused.clear();
    model.writing.send(id, 'startDraft');
    await waitUntil(() => model.writing.targets.length === 0, { timeoutMs: 2000 });
    expect(github.draft).toEqual({ id: 'DRAFT', comments: 1 });
});

test('opened for its threads alone, a reply starts a draft on the head GitHub has now, not the one the item was read with', async () => {
    const github = createGitHub();
    github.threads = [sampleThread()];
    const { model, session, writes } = await openThreads(github);
    github.head = 'head-2';
    const id = reply(model, 'Agreed');

    model.writing.send(id, 'startDraft');
    await waitUntil(() => model.writing.targets.length === 0, { timeoutMs: 2000 });

    expect(writes()).toEqual(['StartPullRequestReview', 'AddPullRequestReviewThreadReply']);
    expect(session.github.requests.find(request => request.operation === 'StartPullRequestReview')?.variables).toEqual({
        pullRequestId: PULL_REQUEST,
        commitOID: 'head-2',
    });
});

test('opened for its threads alone, a review sent with no draft names the head GitHub has now', async () => {
    const github = createGitHub();
    const { model, session, writes } = await openThreads(github);
    github.head = 'head-2';

    model.writing.submit({ event: 'APPROVE', body: '' });
    await waitUntil(() => writes().length === 1 && model.writing.finish.kind === 'idle', { timeoutMs: 2000 });

    expect(session.github.requests.find(request => request.operation === 'SendPullRequestReview')?.variables).toEqual({
        pullRequestId: PULL_REQUEST,
        commitOID: 'head-2',
        event: 'APPROVE',
    });
});

test('a reply box left with text comes back on its thread after a reload', async () => {
    const github = createGitHub();
    const { model, login } = await open(github);
    reply(model, 'Half a thought');
    await waitUntil(() => model.writing.hasText, { timeoutMs: 2000 });
    // Written to disk behind the key press.
    await Bun.sleep(50);

    const { model: again } = await open(github, login);
    await waitUntil(() => again.writing.targets.length > 0, { timeoutMs: 2000 });

    expect(again.writing.targets[0]?.threadId).toBe('T_1');
});

test('resolving shows at once, goes at once beside an open draft, and a refusal puts the thread back and says so', async () => {
    const github = createGitHub();
    github.draft = { id: 'DRAFT', comments: 2 };
    github.threads = [sampleThread()];
    const { model, writes } = await open(github);
    await waitUntil(() => model.threads.length === 1, { timeoutMs: 2000 });
    github.refused.set('ResolveReviewThread', 'Not allowed');

    model.writing.setResolved('T_1', true);
    expect(model.threads[0]?.isResolved).toBe(true);
    await waitUntil(() => model.threads[0]?.isResolved === false, { timeoutMs: 2000 });
    expect(model.writing.getResolveFailure('T_1')).toEqual({ kind: 'refused', message: 'Not allowed' });

    github.refused.clear();
    model.writing.setResolved('T_1', true);
    expect(model.writing.getResolveFailure('T_1')).toBeNull();
    await waitUntil(() => github.threads[0]?.isResolved === true, { timeoutMs: 2000 });
    await waitUntil(() => writes().length === 2, { timeoutMs: 2000 });

    expect(model.threads[0]?.isResolved).toBe(true);
    expect(github.draft).toEqual({ id: 'DRAFT', comments: 2 });
    expect(writes()).toEqual(['ResolveReviewThread', 'ResolveReviewThread']);
});

test('a thread resolved here names the viewer at once; once read again, it names whoever GitHub says resolved it since', async () => {
    const github = createGitHub();
    github.threads = [sampleThread()];
    const { session, model, login, writes } = await open(github);
    await waitUntil(() => model.threads.length === 1, { timeoutMs: 2000 });

    model.writing.setResolved('T_1', true);
    expect(model.threads[0]).toMatchObject({ isResolved: true, resolvedBy: { login } });
    // The threads read after the write: this GitHub names no one.
    await waitUntil(() => writes().length === 1 && model.threads[0]?.resolvedBy === null, { timeoutMs: 2000 });

    // hubot unresolves it and resolves it again on github.com.
    const hubot = { login: 'hubot' };
    github.threads = [{ ...sampleThread(), isResolved: true, resolvedBy: hubot }];
    session.container.resolve(ReviewFiles).open(REFERENCE);
    await waitUntil(() => model.threads[0]?.resolvedBy?.login === 'hubot', { timeoutMs: 2000 });

    expect(model.threads[0]).toMatchObject({ isResolved: true, resolvedBy: hubot });
});

test('after signing out nothing more goes out: a reply, a resolve, an edit or a delete', async () => {
    const github = createGitHub();
    github.threads = [sampleThread()];
    const { model, session, writes } = await open(github);
    const id = reply(model, 'Agreed');
    session.signOutFromAnotherTab();

    model.writing.send(id, 'single');
    model.writing.setResolved('T_1', true);
    model.writing.editComment('C_1', 'Edited');
    model.writing.deleteComment('C_2');
    await Bun.sleep(50);

    expect(writes()).toEqual([]);
    expect(model.writing.getText(id)).toBe('');
});

test('an edit shows at once, outlives a threads read made before GitHub answers, and then shows as GitHub answered it', async () => {
    const github = createGitHub();
    github.threads = [sampleThread()];
    const { session, model, writes } = await open(github);
    const release = holdOperation(session, 'UpdatePullRequestReviewComment');

    model.writing.editComment('C_1', 'Edited');
    expect(model.writing.getCommentEdit('C_1')).toBe('Edited');
    expect(model.threads[0]?.comments[0]?.body).toBe('Edited');

    await waitUntil(() => writes().length === 1, { timeoutMs: 2000 });
    const before = github.threadsRead();
    session.container.resolve(ReviewFiles).open(REFERENCE);
    await waitUntil(() => github.threadsRead() > before && model.threadsState.kind === 'ready', { timeoutMs: 2000 });
    await aMoment();
    expect(model.writing.getCommentEdit('C_1')).toBe('Edited');
    expect(model.threads[0]?.comments[0]?.body).toBe('Edited');

    release();
    await waitUntil(() => model.writing.getCommentEdit('C_1') === null, { timeoutMs: 2000 });
    expect(model.threads[0]?.comments[0]).toMatchObject({ body: 'Edited', bodyHTML: '<p>Edited</p>' });
    expect(
        session.github.requests.find(request => request.operation === 'UpdatePullRequestReviewComment')?.variables,
    ).toEqual({ id: 'C_1', body: 'Edited' });
    await aMoment();
    expect(model.threads[0]?.comments[0]?.bodyHTML).toBe('<p>Edited</p>');
    expect(model.writing.failedEdits).toEqual([]);
});

test('a refused edit shows what GitHub holds again and keeps its text and why for its editor, until let go', async () => {
    const github = createGitHub();
    github.threads = [sampleThread()];
    const { model } = await open(github);
    const [read] = sampleThread().comments;
    github.refused.set('UpdatePullRequestReviewComment', 'Not allowed');

    model.writing.editComment('C_1', 'Edited');
    await waitUntil(() => model.writing.failedEdits.length > 0, { timeoutMs: 2000 });

    const failed: FailedTextEdit[] = [
        { itemId: PULL_REQUEST, commentId: 'C_1', body: 'Edited', reason: { kind: 'refused', message: 'Not allowed' } },
    ];
    expect(model.writing.failedEdits).toEqual(failed);
    expect(model.writing.getCommentEdit('C_1')).toBeNull();
    expect(model.threads[0]?.comments[0]).toEqual(read);

    model.writing.discardFailedEdit('C_1');
    expect(model.writing.failedEdits).toEqual([]);
});

test('an edit refused without a word is one GitHub dropped, and one not answered is offline', async () => {
    const github = createGitHub();
    github.threads = [sampleThread()];
    const { model, session } = await open(github);
    github.refused.set('UpdatePullRequestReviewComment', '');

    model.writing.editComment('C_1', 'Edited');
    await waitUntil(() => model.writing.failedEdits.length > 0, { timeoutMs: 2000 });
    expect(model.writing.failedEdits[0]?.reason).toEqual({ kind: 'dropped' });

    github.refused.clear();
    session.github.holdIf = request =>
        request.operation === 'UpdatePullRequestReviewComment'
            ? Promise.reject(new TypeError('Failed to fetch'))
            : null;
    model.writing.editComment('C_2', 'Edited too');
    await waitUntil(() => model.writing.failedEdits.length === 2, { timeoutMs: 2000 });
    await aMoment();

    expect(model.writing.failedEdits[1]).toMatchObject({ commentId: 'C_2', reason: { kind: 'offline' } });
});

test('a delete hides the comment at once, and its thread with its last; refused, it is back with why', async () => {
    const github = createGitHub();
    github.threads = [sampleThread()];
    const { session, model, writes } = await open(github);
    const release = holdOperation(session, 'DeletePullRequestReviewComment');

    model.writing.deleteComment('C_1');
    expect(model.threads[0]?.comments.map(({ id }) => id)).toEqual(['C_2']);
    release();
    await waitUntil(() => github.threads[0]?.comments.length === 1, { timeoutMs: 2000 });
    await aMoment();
    expect(model.threads[0]?.comments.map(({ id }) => id)).toEqual(['C_2']);

    github.refused.set('DeletePullRequestReviewComment', 'Not allowed');
    model.writing.deleteComment('C_2');
    expect(model.threads).toEqual([]);
    await waitUntil(() => model.writing.getDeleteFailure('T_1') !== null, { timeoutMs: 2000 });
    await aMoment();

    expect(model.writing.getDeleteFailure('T_1')).toEqual({ kind: 'refused', message: 'Not allowed' });
    expect(model.threads[0]?.comments.map(({ id }) => id)).toEqual(['C_2']);
    expect(writes()).toEqual(['DeletePullRequestReviewComment', 'DeletePullRequestReviewComment']);
});

test("a pending comment deleted counts out of the draft at once, back in on a refusal; the draft's last takes the emptied draft with it", async () => {
    const github = createGitHub();
    github.draft = { id: 'DRAFT', comments: 2 };
    github.threads = [threadOf('T_1', ['PENDING', 'PENDING'])];
    const { model, session, writes } = await open(github);
    await waitUntil(() => model.writing.draftCount === 2, { timeoutMs: 2000 });
    github.refused.set('DeletePullRequestReviewComment', 'Not allowed');
    // The draft read after the refusal waits: the count is back before it.
    const release = holdOperation(session, 'ItemDetail');

    model.writing.deleteComment('T_1_0');
    expect(model.writing.draftCount).toBe(1);
    await waitUntil(() => model.writing.getDeleteFailure('T_1') !== null, { timeoutMs: 2000 });
    expect(model.writing.draftCount).toBe(2);
    expect(model.threads[0]?.comments).toHaveLength(2);

    release();
    session.github.holdIf = null;
    await aMoment();
    github.refused.clear();
    model.writing.deleteComment('T_1_0');
    expect(model.writing.getDeleteFailure('T_1')).toBeNull();
    await waitUntil(() => github.threads[0]?.comments.length === 1, { timeoutMs: 2000 });
    model.writing.deleteComment('T_1_1');
    expect(model.writing.draftCount).toBe(0);
    expect(model.threads).toEqual([]);
    await waitUntil(() => github.draft === null, { timeoutMs: 2000 });
    await aMoment();

    expect(writes()).toEqual([
        'DeletePullRequestReviewComment',
        'DeletePullRequestReviewComment',
        'DeletePullRequestReviewComment',
        'DeletePullRequestReview',
    ]);
    expect(model.writing.draftOpen).toBe(false);
});

test('a pending comment deleted with others left in the draft leaves the draft', async () => {
    const github = createGitHub();
    github.draft = { id: 'DRAFT', comments: 2 };
    github.threads = [threadOf('T_1', ['PENDING']), threadOf('T_2', ['PENDING'])];
    const { model, writes } = await open(github);
    await waitUntil(() => model.writing.draftCount === 2, { timeoutMs: 2000 });

    model.writing.deleteComment('T_1_0');
    await waitUntil(() => model.threads.length === 1 && writes().length === 1, { timeoutMs: 2000 });
    await aMoment();

    expect(github.draft).toEqual({ id: 'DRAFT', comments: 1 });
    expect(model.writing.draftCount).toBe(1);
    expect(writes()).toEqual(['DeletePullRequestReviewComment']);
});
