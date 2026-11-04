/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own logins, so their databases never meet.
import 'fake-indexeddb/auto';

import { waitUntil } from '@nzyme/utils/waitUntil.js';
import { expect, test } from 'bun:test';
import { watch } from 'vue';

import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { createTestSession } from '@/testing/createTestSession.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';
import { samplePullRequestDetailNode } from '@/testing/sampleDetailNodes.js';
import { sampleThread } from '@/testing/sampleThreads.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { ReviewFiles } from '../ReviewFiles.js';
import type { PullRequestFiles } from '../ReviewFiles.js';
import type { ReviewThread } from '../threads/ReviewThread.js';
import type { ReviewCommentStatus } from './ReviewWriting.js';

const REFERENCE = { owner: 'acme', name: 'web', number: 7 };
const PULL_REQUEST = 'PR_7';
const HEAD = 'head-1';
const LINE = { path: 'a.ts', side: 'after', line: 3, startLine: null, threadId: null } as const;
const WRITES = [
    'AddPullRequestReview',
    'AddPullRequestReviewThread',
    'SubmitPullRequestReview',
    'DeletePullRequestReview',
    'AddPullRequestReviewThreadReply',
    'StartPullRequestReview',
    'ResolveReviewThread',
    'UnresolveReviewThread',
];
const REPLY = { path: 'a.ts', side: 'after', line: 3, startLine: null, threadId: 'T_1' } as const;
const DRAFT_TAKEN = 'User can only have one pending review per pull request';

/** A GitHub holding one pull request and the viewer's draft, refusing as the real one does. */
function createGitHub() {
    let threadsRead = 0;
    const github = {
        draft: null as { id: string; comments: number } | null,
        /** Threads as read. */
        threads: [] as ReviewThread[],
        /** A draft opened on GitHub after the reply's check: it joins it silently. */
        replyJoins: false,
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
                                    headRefOid: HEAD,
                                    baseRefOid: 'base',
                                    changedFiles: 0,
                                    files: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
                                },
                            },
                        },
                    };
                case 'PullRequestReviewThreads':
                    threadsRead++;
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
                case 'AddPullRequestReviewThread':
                    if (github.draft) {
                        github.draft.comments++;
                    }

                    return { data: { addPullRequestReviewThread: { thread: { id: 'T' } } } };
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

async function open(github: TestGitHub, login = `user-${crypto.randomUUID()}`) {
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
    expect(reloaded.model.writing.targets).toEqual([{ ...LINE, id: kept }]);
    expect(reloaded.model.writing.getText(kept)).toBe('Not sent yet');
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
    const release = hold(session);
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

async function aMoment() {
    await new Promise(resolve => {
        setTimeout(resolve, 20);
    });
}

function hold(session: ReturnType<typeof createTestSession>) {
    let release = () => {};
    const held = new Promise<void>(resolve => {
        release = resolve;
    });
    session.github.holdIf = request => (request.operation === 'AddPullRequestReview' ? held : null);
    return release;
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

test('after signing out nothing more goes out, a reply or a resolve', async () => {
    const github = createGitHub();
    github.threads = [sampleThread()];
    const { model, session, writes } = await open(github);
    const id = reply(model, 'Agreed');
    session.signOutFromAnotherTab();

    model.writing.send(id, 'single');
    model.writing.setResolved('T_1', true);
    await Bun.sleep(50);

    expect(writes()).toEqual([]);
    expect(model.writing.getText(id)).toBe('');
});
