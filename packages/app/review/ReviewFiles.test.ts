/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own logins, so their databases never meet.
import 'fake-indexeddb/auto';

import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import { waitUntil } from '@nzyme/utils/waitUntil.js';
import { expect, test } from 'bun:test';
import { computed } from 'vue';

import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import { EDIT_RESERVE } from '@/sync/getAllowancePause.js';
import { createTestSession } from '@/testing/createTestSession.js';
import type { TestGraphQLAnswer, TestGraphQLRequest, TestRestAnswer } from '@/testing/createTestSession.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { getReviewBlobDatabaseName, ReviewBlobStore } from './ReviewBlobStore.js';
import { ReviewFiles } from './ReviewFiles.js';
import { ReviewViewedFailures } from './ReviewViewedFailures.js';
import type { PullRequestFiles, ReviewFile, ReviewFileState } from './ReviewFiles.js';

const REFERENCE = { owner: 'acme', name: 'web', number: 7 };
const BASE_TIP = 'base-tip';
const MERGE_BASE = 'merge-base';
const HEAD = 'head-1';

test('the list comes through all its pages, and a file reads as it is at the merge base and at the head — not at the base branch, which moved on', async () => {
    const github = createGitHub();
    github.file({ path: 'changed.ts', changeType: 'MODIFIED', before: 'forked from', after: 'changed' });
    github.file({ path: 'added.ts', changeType: 'ADDED', after: 'new' });
    github.file({ path: 'deleted.ts', changeType: 'DELETED', before: 'gone' });
    github.file({ path: 'moved.ts', changeType: 'RENAMED', previousPath: 'old.ts', before: 'was', after: 'is' });
    // The base branch's tip has its own version of every file: reading any of them would show here.
    github.blobAt(`${BASE_TIP}:changed.ts`, { text: 'the base moved on' });
    const { model, session } = open(uniqueLogin(), github);

    await settled(model);

    const expected: ReviewFile[] = [
        fileRow('changed.ts', 'MODIFIED'),
        fileRow('added.ts', 'ADDED'),
        fileRow('deleted.ts', 'DELETED'),
        { ...fileRow('moved.ts', 'RENAMED'), previousPath: 'old.ts' },
    ];
    expect(model.list).toEqual({ kind: 'ready' });
    expect(model.files).toEqual(expected);
    expect(model.id).toBe('PR_7');
    expect(model.headRefOid).toBe(HEAD);
    expect(model.changedFiles).toBe(4);
    expect(session.operations().filter(operation => operation === 'PullRequestReviewFiles')).toHaveLength(2);
    expectStates(model, {
        'changed.ts': { kind: 'ready', before: 'forked from', after: 'changed' },
        'added.ts': { kind: 'ready', before: null, after: 'new' },
        'deleted.ts': { kind: 'ready', before: 'gone', after: null },
        'moved.ts': { kind: 'ready', before: 'was', after: 'is' },
    });
});

test('the heavy REST file list is read only for a pull request with a rename or a copy', async () => {
    const github = createGitHub();
    github.file({ path: 'changed.ts', changeType: 'MODIFIED', before: 'a', after: 'b' });
    const { model, session } = open(uniqueLogin(), github);

    await settled(model);

    expect(session.operations()).not.toContain('GET /repos/acme/web/pulls/7/files');
});

test('a truncated blob is read whole over REST, never diffed from its cut text', async () => {
    const github = createGitHub();
    github.file({ path: 'big.ts', changeType: 'MODIFIED', before: 'small', after: 'the whole zażółć text' });
    github.truncate('the whole zażółć text', 'the whole');
    const { model, session } = open(uniqueLogin(), github);

    await settled(model);

    expectStates(model, { 'big.ts': { kind: 'ready', before: 'small', after: 'the whole zażółć text' } });
    expect(session.operations()).toContain(`GET /repos/acme/web/git/blobs/${oidOf('the whole zażółć text')}`);
});

test('a binary, a too large and a submodule file are no errors, and neither of their sides is read', async () => {
    const github = createGitHub();
    github.file({ path: 'image.png', changeType: 'MODIFIED', before: 'text once', after: 'png', binary: true });
    github.file({ path: 'huge.ts', changeType: 'MODIFIED', before: 'small', after: 'huge', byteSize: 1_000_001 });
    github.file({ path: 'nzyme', changeType: 'MODIFIED', before: 'x', after: 'y', submodule: true });
    github.file({ path: 'plain.ts', changeType: 'ADDED', after: 'plain' });
    const { model, session } = open(uniqueLogin(), github);

    await settled(model);

    expectStates(model, {
        'image.png': { kind: 'binary', before: 9, after: 3 },
        'huge.ts': { kind: 'tooLarge', before: 5, after: 1_000_001 },
        nzyme: { kind: 'binary', before: null, after: null },
        'plain.ts': { kind: 'ready', before: null, after: 'plain' },
    });
    expect(textsAsked(session)).toEqual([oidOf('plain')]);
});

test('a file GitHub fails to answer for fails alone, and comes when retried', async () => {
    const github = createGitHub();
    github.file({ path: 'good.ts', changeType: 'ADDED', after: 'good' });
    github.file({ path: 'bad.ts', changeType: 'ADDED', after: 'bad' });
    github.failExpression(`${HEAD}:bad.ts`);
    const { model } = open(uniqueLogin(), github);

    await settled(model);

    expect(model.getState('good.ts')).toEqual({ kind: 'ready', before: null, after: 'good' });
    const bad = model.getState('bad.ts');
    expect(bad.kind === 'failed' && bad.error.message).toContain('Try later');

    github.failExpression(null);
    model.retry('bad.ts');
    await settled(model);

    expect(model.getState('bad.ts')).toEqual({ kind: 'ready', before: null, after: 'bad' });
});

test('a query or merge base GitHub fails on fails only its files; each comes back when retried', async () => {
    const github = createGitHub();
    github.file({ path: 'added.ts', changeType: 'ADDED', after: 'added' });
    github.failNext('ReviewBlobTexts');
    const { model } = open(uniqueLogin(), github);
    await settled(model);
    expect(model.getState('added.ts').kind).toBe('failed');
    model.retry('added.ts');
    await settled(model);
    expect(model.getState('added.ts')).toEqual({ kind: 'ready', before: null, after: 'added' });

    const noBase = createGitHub();
    noBase.file({ path: 'changed.ts', changeType: 'MODIFIED', before: 'a', after: 'b' });
    noBase.failNext(`GET /repos/acme/web/compare/${BASE_TIP}...${HEAD}`);
    const other = open(uniqueLogin(), noBase);
    await settled(other.model);
    expect(other.model.getState('changed.ts').kind).toBe('failed');
    other.model.retry('changed.ts');
    await settled(other.model);
    expect(other.model.getState('changed.ts')).toEqual({ kind: 'ready', before: 'a', after: 'b' });
});

test('a merge base GitHub fails on fails only the files with a before side; the added ones of the same query go on', async () => {
    const github = createGitHub();
    github.file({ path: 'added.ts', changeType: 'ADDED', after: 'added' });
    github.file({ path: 'changed.ts', changeType: 'MODIFIED', before: 'a', after: 'b' });
    github.failNext(`GET /repos/acme/web/compare/${BASE_TIP}...${HEAD}`);
    const { model } = open(uniqueLogin(), github);

    await settled(model);

    expect(model.getState('added.ts')).toEqual({ kind: 'ready', before: null, after: 'added' });
    expect(model.getState('changed.ts').kind).toBe('failed');

    model.retry('changed.ts');
    await settled(model);

    expect(model.getState('changed.ts')).toEqual({ kind: 'ready', before: 'a', after: 'b' });
});

test('a rename GitHub does not name a source for fails alone instead of reading the wrong path', async () => {
    const github = createGitHub();
    github.file({ path: 'moved.ts', changeType: 'RENAMED', before: 'was', after: 'is' });
    github.file({ path: 'other.ts', changeType: 'ADDED', after: 'other' });
    const { model } = open(uniqueLogin(), github);

    await settled(model);

    expect(model.getState('moved.ts').kind).toBe('failed');
    expect(model.getState('other.ts')).toEqual({ kind: 'ready', before: null, after: 'other' });
});

test("a list GitHub won't give shows its error, and opening the pull request again reads it anew", async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'ADDED', after: 'a' });
    github.failNext('PullRequestReviewFiles');
    const { model, files } = open(uniqueLogin(), github);

    await waitUntil(() => model.list.kind === 'failed', { timeoutMs: 2000 });
    expect(model.files).toEqual([]);

    expect(files.open(REFERENCE)).toBe(model);
    await settled(model);

    expect(model.getState('a.ts')).toEqual({ kind: 'ready', before: null, after: 'a' });
});

test('contents kept on disk are not asked of GitHub again by the same user, but are by another', async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'MODIFIED', before: 'before', after: 'after' });
    const alice = uniqueLogin();
    const first = open(alice, github);
    await settled(first.model);
    expect(textsAsked(first.session)).toEqual([oidOf('before'), oidOf('after')]);
    await waitUntilKept(alice, oidOf('after'));

    const reloaded = open(alice, github);
    await settled(reloaded.model);

    expect(reloaded.model.getState('a.ts')).toEqual({ kind: 'ready', before: 'before', after: 'after' });
    expect(reloaded.session.operations()).not.toContain('ReviewBlobTexts');

    const other = open(uniqueLogin(), github);
    await settled(other.model);
    expect(textsAsked(other.session)).toEqual([oidOf('before'), oidOf('after')]);
});

test('signing out takes the contents off the disk and out of the model, and an answer arriving later brings nothing back', async () => {
    const github = createGitHub();
    github.file({ path: 'secret.ts', changeType: 'ADDED', after: 'secret' });
    github.file({ path: 'late.ts', changeType: 'ADDED', after: 'late' });
    const login = uniqueLogin();
    const { model, session } = open(login, github);
    session.container.resolve(ItemStore);
    let release = () => {};
    const held = new Promise<void>(resolve => {
        release = resolve;
    });
    await waitUntil(() => session.operations().includes('ReviewBlobOids'), { timeoutMs: 2000 });
    session.github.holdIf = request => (request.operation === 'ReviewBlobTexts' ? held : null);
    await waitUntil(() => session.operations().includes('ReviewBlobTexts'), { timeoutMs: 2000 });
    // The database exists: the oids' step opened it.
    await waitUntil(async () => (await databaseNames()).includes(getReviewBlobDatabaseName(login)), {
        timeoutMs: 2000,
    });

    session.signOutFromAnotherTab();

    expect(model.files).toEqual([]);
    expect(model.getState('secret.ts')).toEqual({ kind: 'waiting' });
    await waitUntil(async () => !(await databaseNames()).includes(getReviewBlobDatabaseName(login)), {
        timeoutMs: 2000,
    });

    release();
    await session.clock.advance(100);

    expect(model.getState('secret.ts')).toEqual({ kind: 'waiting' });
    expect(await databaseNames()).not.toContain(getReviewBlobDatabaseName(login));
    expect(session.container.resolve(ReviewFiles).open(REFERENCE)).toBeNull();
});

test('texts are asked in the order of the list, 3 queries at a time, and a jump goes next', async () => {
    const github = createGitHub({ pageSize: 200 });
    for (let index = 0; index < 200; index++) {
        github.file({ path: `file-${index}.ts`, changeType: 'ADDED', after: `text ${index}` });
    }

    const held: (() => void)[] = [];
    const { model, session } = open(uniqueLogin(), github, request =>
        request.operation === 'ReviewBlobTexts'
            ? new Promise<void>(resolve => {
                  held.push(resolve);
              })
            : null,
    );
    await waitUntil(() => textQueries(session).length === 3, { timeoutMs: 2000 });
    await session.clock.advance(0);

    expect(textQueries(session)).toHaveLength(3);
    expect(textQueries(session)[0]?.[0]).toBe(oidOf('text 0'));
    expect(textQueries(session)[1]?.[0]).toBe(oidOf('text 40'));

    model.prioritize('file-199.ts');
    held[0]?.();
    await waitUntil(() => session.github.requests.filter(isOidQuery).length === 4, { timeoutMs: 2000 });
    const oidQueries = session.github.requests.filter(isOidQuery);
    expect(oidQueries[3]?.variables.e0).toBe(`${HEAD}:file-199.ts`);

    session.github.holdIf = null;
    for (const release of held) {
        release();
    }

    await settled(model);
    expect(model.getState('file-199.ts')).toEqual({ kind: 'ready', before: null, after: 'text 199' });
    expect(model.getState('file-100.ts')).toEqual({ kind: 'ready', before: null, after: 'text 100' });
});

test('a query asks at most 50 texts, however many files have got that far', async () => {
    const github = createGitHub({ pageSize: 200 });
    for (let index = 0; index < 200; index++) {
        github.file({ path: `file-${index}.ts`, changeType: 'ADDED', after: `text ${index}` });
    }

    const held: (() => void)[] = [];
    const { model, session } = open(uniqueLogin(), github, request =>
        isOidQuery(request)
            ? new Promise<void>(resolve => {
                  held.push(resolve);
              })
            : null,
    );
    await waitUntil(() => held.length === 3, { timeoutMs: 2000 });

    // The freed place goes to the oids of the file jumped to, so the texts of two queries wait for the next one.
    model.prioritize('file-199.ts');
    held[0]?.();
    await waitUntil(() => held.length === 4, { timeoutMs: 2000 });
    held[1]?.();
    await waitUntil(() => textQueries(session).length > 0, { timeoutMs: 2000 });

    expect(textQueries(session)[0]).toEqual(Array.from({ length: 50 }, (_, index) => oidOf(`text ${index}`)));

    session.github.holdIf = null;
    for (const release of held) {
        release();
    }

    await settled(model);
});

test('a query keeps its answer under about 2 MB', async () => {
    const github = createGitHub({ pageSize: 100 });
    for (let index = 0; index < 5; index++) {
        github.file({ path: `file-${index}.ts`, changeType: 'ADDED', after: `text ${index}`, byteSize: 900_000 });
    }

    const { model, session } = open(uniqueLogin(), github);
    await settled(model);

    expect(textQueries(session).map(oids => oids.length)).toEqual([2, 2, 1]);
});

test('oid expressions are asked 40 at a time, 3 queries at once, and a jump asked before the list arrives goes first', async () => {
    const github = createGitHub({ pageSize: 100 });
    for (let index = 0; index < 90; index++) {
        github.file({ path: `file-${index}.ts`, changeType: 'MODIFIED', before: `was ${index}`, after: `is ${index}` });
    }

    const held: (() => void)[] = [];
    const { model, session } = open(uniqueLogin(), github, request =>
        isOidQuery(request)
            ? new Promise<void>(resolve => {
                  held.push(resolve);
              })
            : null,
    );
    model.prioritize('file-89.ts');
    await waitUntil(() => held.length === 3, { timeoutMs: 2000 });
    await session.clock.advance(0);
    expect(held).toHaveLength(3);

    session.github.holdIf = null;
    for (const release of held) {
        release();
    }

    await settled(model);

    const oidQueries = session.github.requests.filter(isOidQuery);
    expect(oidQueries.map(request => Object.keys(request.variables).length - 2).toSorted()).toEqual([
        20, 40, 40, 40, 40,
    ]);
    expect(oidQueries[0]?.variables.e0).toBe(`${MERGE_BASE}:file-89.ts`);
});

test('the merge base is asked once for a pull request, and opening it again reuses all unless its head moved', async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'MODIFIED', before: 'before', after: 'after' });
    const { model, files, session } = open(uniqueLogin(), github);
    await settled(model);

    expect(files.open(REFERENCE)).toBe(model);
    await session.clock.advance(50);

    expect(model.getState('a.ts')).toEqual({ kind: 'ready', before: 'before', after: 'after' });
    expect(session.operations().filter(operation => operation.includes('/compare/'))).toHaveLength(1);
    expect(session.github.requests.filter(isOidQuery)).toHaveLength(1);

    github.moveHead('head-2');
    github.blobAt('head-2:a.ts', { text: 'pushed' });
    expect(files.open(REFERENCE)).toBe(model);
    await waitUntil(() => model.headRefOid === 'head-2', { timeoutMs: 2000 });
    await settled(model);

    expect(model.getState('a.ts')).toEqual({ kind: 'ready', before: 'before', after: 'pushed' });
});

test("a file's expanded lines stay through a read of the same head and go when the author changes the file (D14)", async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'MODIFIED', before: 'before', after: 'after' });
    const { model, files, session } = open(uniqueLogin(), github);
    await settled(model);
    expect(model.getExpandedLines('a.ts')).toEqual([]);

    model.expandLines('a.ts', { start: 10, end: 30 });
    model.expandLines('a.ts', { start: 30, end: 50 });
    const lines = model.getExpandedLines('a.ts');
    expect(lines).toEqual([{ start: 10, end: 50 }]);
    // The same array: the rows built for it are kept.
    expect(model.getExpandedLines('a.ts')).toBe(lines);

    files.open(REFERENCE);
    await session.clock.advance(50);
    expect(model.getExpandedLines('a.ts')).toBe(lines);

    github.moveHead('head-2');
    github.blobAt('head-2:a.ts', { text: 'pushed' });
    files.open(REFERENCE);
    await waitUntil(() => model.headRefOid === 'head-2', { timeoutMs: 2000 });
    await settled(model);

    expect(model.getExpandedLines('a.ts')).toEqual([]);
});

test('many files arriving tell of it once a frame, not once a file', async () => {
    const github = createGitHub({ pageSize: 250 });
    for (let index = 0; index < 225; index++) {
        github.file({ path: `file-${index}.ts`, changeType: 'ADDED', after: `text ${index}` });
    }

    let release = () => {};
    const held = new Promise<void>(resolve => {
        release = resolve;
    });
    const { model, session } = open(uniqueLogin(), github, request => (isOidQuery(request) ? held : null));
    await waitUntil(() => model.list.kind === 'ready', { timeoutMs: 2000 });
    await waitUntil(() => session.github.requests.some(isOidQuery), { timeoutMs: 2000 });
    const version = model.version;
    const firstState = computed(() => model.getState('file-0.ts').kind);
    expect(firstState.value).toBe('loading');

    // The clock stands still, so no frame comes while they all arrive.
    release();
    await waitUntil(() => model.files.every(file => model.getState(file.path).kind === 'ready'), { timeoutMs: 5000 });
    expect(model.version).toBe(version);
    expect(firstState.value).toBe('loading');

    await session.clock.advance(16);

    expect(model.version).toBe(version + 1);
    expect(firstState.value).toBe('ready');
});

test('a rate-limit refusal pauses what is missing instead of failing it; nothing is asked until GitHub said, then it carries on by itself', async () => {
    const github = createGitHub({ pageSize: 100 });
    for (let index = 0; index < 1000; index++) {
        github.file({ path: `file-${index}.ts`, changeType: 'ADDED', after: `text ${index}` });
    }

    github.rateLimit('ReviewBlobTexts');
    const { model, session } = open(uniqueLogin(), github);

    await settled(model);

    const until = model.pausedUntil;
    expect(until).toBe(session.clock.now() + 60_000);
    expect(model.files.every(file => model.getState(file.path).kind === 'paused')).toBe(true);
    expect(model.getState('file-999.ts')).toEqual({ kind: 'paused', until: until ?? 0 });
    // Only what was on its way when the first refusal came; all of them would take 20.
    const asked = session.operations().length;
    expect(textQueries(session).length).toBeLessThan(8);

    github.rateLimit(null);
    model.prioritize('file-999.ts');
    await session.clock.advance(59_000);
    expect(session.operations()).toHaveLength(asked);

    await session.clock.advance(1000);
    await settled(model);

    expect(model.pausedUntil).toBeNull();
    expect(model.getState('file-999.ts')).toEqual({ kind: 'ready', before: null, after: 'text 999' });
    expect(model.getState('file-0.ts')).toEqual({ kind: 'ready', before: null, after: 'text 0' });
});

test("GraphQL down to what's kept for edits pauses reading until its reset, without a refusal: viewed marks go through, nothing else is asked, and no reload is needed", async () => {
    const github = createGitHub({ pageSize: 100 });
    for (let index = 0; index < 100; index++) {
        github.file({ path: `file-${index}.ts`, changeType: 'ADDED', after: `text ${index}` });
    }

    let release = () => {};
    const heldList = new Promise<void>(resolve => {
        release = resolve;
    });
    const { model, session } = open(uniqueLogin(), github, request =>
        request.operation === 'PullRequestReviewFiles' ? heldList : null,
    );
    await waitUntil(() => reviewOperations(session).length === 1, { timeoutMs: 2000 });
    // The list's answer says only the reserve is left: no file is to be asked for.
    session.github.graphqlRemaining = EDIT_RESERVE;
    session.github.holdIf = null;
    release();
    await waitUntil(() => model.pausedUntil !== null && model.listComplete, { timeoutMs: 2000 });
    await session.clock.advance(0);

    expect(model.pausedUntil).toBe(session.clock.now() + 3_600_000);
    expect(model.files.map(file => model.getState(file.path).kind)).toEqual(model.files.map(() => 'paused'));
    expect(reviewOperations(session)).toEqual(['PullRequestReviewFiles']);
    const asked = reviewOperations(session).length;

    // A jump and opening it again ask nothing...
    model.prioritize('file-99.ts');
    expect(session.container.resolve(ReviewFiles).open(REFERENCE)).toBe(model);
    await session.clock.advance(1000);
    expect(reviewOperations(session)).toHaveLength(asked);

    // ...but the edit goes straight through, and tells of no refusal.
    model.setViewed(['file-0.ts'], true);
    await waitUntil(() => github.markedViewed.length === 1, { timeoutMs: 2000 });
    expect(session.container.resolve(ReviewViewedFailures).latest).toBeNull();
    expect(viewedOf(model, 'file-0.ts')).toBe('VIEWED');
    await session.clock.advance(1000);
    expect(reviewOperations(session).filter(operation => operation !== 'MarkFilesViewed')).toHaveLength(asked);

    session.github.graphqlRemaining = 5000;
    // Each answer says a reset a little later, as GitHub's own do: past the last of them.
    await session.clock.advance(3_600_000);
    await settled(model);

    expect(model.pausedUntil).toBeNull();
    expect(model.getState('file-99.ts')).toEqual({ kind: 'ready', before: null, after: 'text 99' });
    expect(model.getState('file-1.ts')).toEqual({ kind: 'ready', before: null, after: 'text 1' });
    // And the list asked for while paused is read after all.
    expect(session.operations().filter(operation => operation === 'PullRequestReviewFiles')).toHaveLength(2);
});

test('REST, its own bucket, used up pauses reading too; what the disk holds comes all the same, and what it lacks at the reset', async () => {
    const login = uniqueLogin();
    const github = createGitHub();
    github.file({ path: 'kept.ts', changeType: 'MODIFIED', before: 'a', after: 'b' });
    const first = open(login, github);
    await settled(first.model);
    await waitUntilKept(login, oidOf('b'));
    await first.session.clock.advance(100);

    // A new file on GitHub, next to the one read before.
    github.file({ path: 'new.ts', changeType: 'MODIFIED', before: 'c', after: 'd' });
    const { model, session } = open(login, github);
    session.container.resolve(GitHubRateLimitStore).update({
        resource: 'core',
        limit: 5000,
        remaining: 0,
        resetAt: new Date(session.clock.now() + 600_000),
    });

    await waitUntil(() => model.getState('kept.ts').kind === 'ready', { timeoutMs: 2000 });
    expect(reviewOperations(session)).toEqual([]);

    await session.clock.advance(600_000);
    await settled(model);

    expect(model.pausedUntil).toBeNull();
    expect(model.getState('new.ts')).toEqual({ kind: 'ready', before: 'c', after: 'd' });
});

test("a list that can't be read for the allowance says it is paused, and reads itself at the reset", async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'ADDED', after: 'a' });
    github.rateLimit('PullRequestReviewFiles');
    const { model, session } = open(uniqueLogin(), github);

    await waitUntil(() => model.list.kind === 'paused', { timeoutMs: 2000 });
    github.rateLimit(null);
    const asked = session.operations().length;
    await session.clock.advance(59_000);
    expect(session.operations()).toHaveLength(asked);

    await session.clock.advance(1000);
    await settled(model);

    expect(model.list).toEqual({ kind: 'ready' });
    expect(model.getState('a.ts')).toEqual({ kind: 'ready', before: null, after: 'a' });
});

test('a viewed mark GitHub dropped since the last visit is named, from what the disk kept, until it is marked again or a new read says otherwise; the rest are not', async () => {
    const login = uniqueLogin();
    const github = createGitHub();
    github.file({ path: 'pushed.ts', changeType: 'ADDED', after: 'one' });
    github.file({ path: 'other.ts', changeType: 'ADDED', after: 'two' });
    github.file({ path: 'never.ts', changeType: 'ADDED', after: 'three' });
    github.setViewed('pushed.ts', 'VIEWED');
    github.setViewed('other.ts', 'VIEWED');
    const first = open(login, github);
    await settled(first.model);
    expect(first.model.lostViewed.size).toBe(0);
    await waitUntil(
        async () => (await ReviewBlobStore.create().readFileList(login, LIST_KEY))?.files[0]?.viewed === 'VIEWED',
        { timeoutMs: 2000 },
    );

    // A push: GitHub drops the mark of a file it changed, and of one never viewed there is nothing to say.
    github.moveHead('head-2');
    github.setViewed('pushed.ts', 'DISMISSED');
    github.setViewed('never.ts', 'DISMISSED');
    const { model, session } = open(login, github);
    await settled(model);

    expect([...model.lostViewed]).toEqual(['pushed.ts']);
    expect(model.lostViewedNotice).toBe(true);

    model.dismissLostViewedNotice();
    expect(model.lostViewedNotice).toBe(false);
    expect([...model.lostViewed]).toEqual(['pushed.ts']);

    model.setViewed(['pushed.ts'], true);
    expect(model.lostViewed.size).toBe(0);
    await waitUntil(() => github.markedViewed.length === 1, { timeoutMs: 2000 });
    expect(session.operations()).toContain('MarkFilesViewed');
});

test('a push seen by opening the same model again names the marks it dropped too', async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'ADDED', after: 'one' });
    github.setViewed('a.ts', 'VIEWED');
    const { model, files } = open(uniqueLogin(), github);
    await settled(model);

    github.moveHead('head-2');
    github.setViewed('a.ts', 'DISMISSED');
    files.open(REFERENCE);
    await waitUntil(() => model.lostViewed.size === 1, { timeoutMs: 2000 });

    expect([...model.lostViewed]).toEqual(['a.ts']);
});

test('how far the files are counts those that show content; a jump is named until its file arrives', async () => {
    const github = createGitHub();
    github.file({ path: 'bun.lock', changeType: 'MODIFIED', before: 'x', after: 'y' });
    github.file({ path: 'a.ts', changeType: 'ADDED', after: 'a' });
    github.file({ path: 'b.ts', changeType: 'ADDED', after: 'b' });
    let release = () => {};
    const heldTexts = new Promise<void>(resolve => {
        release = resolve;
    });
    const { model, session } = open(uniqueLogin(), github, request =>
        request.operation === 'ReviewBlobTexts' ? heldTexts : null,
    );

    await waitUntil(() => textQueries(session).length > 0, { timeoutMs: 2000 });
    await session.clock.advance(20);
    model.prioritize('b.ts');
    await session.clock.advance(20);
    expect(model.progress).toEqual({ here: 0, total: 2 });
    expect(model.fetchingFirst).toBe('b.ts');

    release();
    await settled(model);

    expect(model.progress).toEqual({ here: 2, total: 2 });
    expect(model.fetchingFirst).toBeNull();
});

test('the list shows from its first page, what is known is fetched right away and the rest appends in order, nothing started over', async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'MODIFIED', before: 'a0', after: 'a1' });
    github.file({ path: 'b.ts', changeType: 'ADDED', after: 'b1' });
    github.file({ path: 'c.ts', changeType: 'ADDED', after: 'c1' });
    let release = () => {};
    const secondPage = new Promise<void>(resolve => {
        release = resolve;
    });
    const { model, session } = open(uniqueLogin(), github, request =>
        request.operation === 'PullRequestReviewFiles' && request.variables.after ? secondPage : null,
    );

    await waitUntil(() => model.getState('b.ts').kind === 'ready', { timeoutMs: 2000 });
    expect(model.list).toEqual({ kind: 'ready' });
    expect(model.files.map(file => file.path)).toEqual(['a.ts', 'b.ts']);
    expect(model.changedFiles).toBe(3);
    expect(model.listComplete).toBe(false);
    expect(session.operations().some(operation => operation.includes('/compare/'))).toBe(true);
    const first = model.getState('a.ts');

    release();
    await settled(model);

    expect(model.files.map(file => file.path)).toEqual(['a.ts', 'b.ts', 'c.ts']);
    expect(model.listComplete).toBe(true);
    expect(model.getState('a.ts')).toBe(first);
    expect(model.getState('c.ts')).toEqual({ kind: 'ready', before: null, after: 'c1' });
});

test('a later page failing leaves what came, says the list is not whole, warns, and opening again reads the rest', async () => {
    const github = createGitHub();
    for (const path of ['a.ts', 'b.ts', 'c.ts']) {
        github.file({ path, changeType: 'ADDED', after: path });
    }

    let failed = false;
    const { model, files, session } = open(uniqueLogin(), github, request => {
        if (request.operation === 'PullRequestReviewFiles' && request.variables.after && !failed) {
            failed = true;
            github.failNext('PullRequestReviewFiles');
        }

        return null;
    });

    await waitUntil(() => session.logs.some(log => log.level === 'warn'), { timeoutMs: 2000 });
    expect(model.list).toEqual({ kind: 'ready' });
    expect(model.files.map(file => file.path)).toEqual(['a.ts', 'b.ts']);
    expect(model.listComplete).toBe(false);

    files.open(REFERENCE);
    await settled(model);

    expect(model.files.map(file => file.path)).toEqual(['a.ts', 'b.ts', 'c.ts']);
});

test('a renamed file waits for where it came from without holding up the others, and fails alone when that cannot be read; a retry reads it again', async () => {
    const github = createGitHub();
    github.file({ path: 'plain.ts', changeType: 'ADDED', after: 'plain' });
    github.file({ path: 'moved.ts', changeType: 'RENAMED', previousPath: 'old.ts', before: 'was', after: 'is' });
    let release = () => {};
    const renames = new Promise<void>(resolve => {
        release = resolve;
    });
    const { model } = open(uniqueLogin(), github, request =>
        request.operation === 'GET /repos/acme/web/pulls/7/files' ? renames : null,
    );

    await waitUntil(() => model.getState('plain.ts').kind === 'ready', { timeoutMs: 2000 });
    expect(model.getState('moved.ts')).toEqual({ kind: 'waiting' });

    github.failNext('GET /repos/acme/web/pulls/7/files');
    release();
    await settled(model);

    expect(model.list).toEqual({ kind: 'ready' });
    expect(model.getState('moved.ts').kind).toBe('failed');
    expect(model.getState('plain.ts')).toEqual({ kind: 'ready', before: null, after: 'plain' });

    model.retry('moved.ts');
    await settled(model);

    expect(model.getState('moved.ts')).toEqual({ kind: 'ready', before: 'was', after: 'is' });
    expect(model.files.find(file => file.path === 'moved.ts')?.previousPath).toBe('old.ts');
});

test('a pull request read before draws its list and code from the disk with GitHub silent, where renames came from included', async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'MODIFIED', before: 'before', after: 'after' });
    github.file({ path: 'moved.ts', changeType: 'RENAMED', previousPath: 'old.ts', before: 'was', after: 'is' });
    github.file({ path: 'huge.ts', changeType: 'MODIFIED', before: 'small', after: 'huge', byteSize: 1_000_001 });
    const login = uniqueLogin();
    const first = open(login, github);
    await settled(first.model);
    await waitUntilAllKept(login, [`${HEAD}:huge.ts`, `${MERGE_BASE}:old.ts`], oidOf('is'));

    const silent = createSilentHold();
    const reloaded = open(login, github, silent.hold);
    await settled(reloaded.model);

    expect(reloaded.model.list).toEqual({ kind: 'ready' });
    expect(reloaded.model.id).toBe('PR_7');
    expect(reloaded.model.headRefOid).toBe(HEAD);
    expect(reloaded.model.listComplete).toBe(true);
    expectStates(reloaded.model, {
        'a.ts': { kind: 'ready', before: 'before', after: 'after' },
        'moved.ts': { kind: 'ready', before: 'was', after: 'is' },
        'huge.ts': { kind: 'tooLarge', before: 5, after: 1_000_001 },
    });
    // Only the list's check behind it, which GitHub has not answered.
    expect(reviewOperations(reloaded.session)).toEqual(['PullRequestReviewFiles']);

    silent.release();
    await waitUntil(() => reviewOperations(reloaded.session).length === 2, { timeoutMs: 2000 });
    await reloaded.session.clock.advance(0);
    expect(reviewOperations(reloaded.session)).toEqual(['PullRequestReviewFiles', 'PullRequestReviewFiles']);
});

test('a viewed mark changed on github.com updates a kept list without starting anything over, and is what the next open starts from', async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'MODIFIED', before: 'before', after: 'after' });
    const login = uniqueLogin();
    const first = open(login, github);
    await settled(first.model);
    await waitUntilAllKept(login, [`${HEAD}:a.ts`], oidOf('after'));

    github.setViewed('a.ts', 'VIEWED');
    const second = open(login, github);
    await settled(second.model);
    const state = second.model.getState('a.ts');
    await waitUntil(() => second.model.files[0]?.viewed === 'VIEWED', { timeoutMs: 2000 });
    await second.session.clock.advance(50);

    expect(second.model.getState('a.ts')).toBe(state);
    expect(reviewOperations(second.session)).toEqual(['PullRequestReviewFiles']);

    await waitUntil(
        async () => (await ReviewBlobStore.create().readFileList(login, LIST_KEY))?.files[0]?.viewed === 'VIEWED',
        { timeoutMs: 2000 },
    );
    const silent = createSilentHold();
    const third = open(login, github, silent.hold);
    await settled(third.model);
    expect(third.model.files[0]?.viewed).toBe('VIEWED');
    silent.release();
});

test('a pull request that moved shows what is new once GitHub answers, asking only for what the disk does not know', async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'MODIFIED', before: 'before', after: 'after' });
    github.file({ path: 'new.ts', changeType: 'ADDED', after: 'new' });
    const login = uniqueLogin();
    const first = open(login, github);
    await settled(first.model);
    await waitUntilAllKept(login, [`${MERGE_BASE}:a.ts`, `${HEAD}:a.ts`], oidOf('after'));

    github.moveHead('head-2');
    github.blobAt('head-2:a.ts', { text: 'pushed' });
    github.blobAt('head-2:new.ts', { text: 'new' });
    const silent = createSilentHold();
    const moved = open(login, github, silent.hold);
    await settled(moved.model);
    expect(moved.model.headRefOid).toBe(HEAD);
    expect(moved.model.getState('a.ts')).toEqual({ kind: 'ready', before: 'before', after: 'after' });

    silent.release();
    await waitUntil(() => moved.model.headRefOid === 'head-2', { timeoutMs: 2000 });
    expect(moved.model.list).toEqual({ kind: 'ready' });
    await settled(moved.model);

    expect(moved.model.getState('a.ts')).toEqual({ kind: 'ready', before: 'before', after: 'pushed' });
    const asked = moved.session.github.requests
        .filter(isOidQuery)
        .flatMap(request => variablesOf(request, 'e').map(([, expression]) => expression));
    expect(asked.toSorted()).toEqual(['head-2:a.ts', 'head-2:new.ts']);
});

test('a push in the middle of reading the list starts it over at the new head', async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'ADDED', after: 'a' });
    github.file({ path: 'b.ts', changeType: 'ADDED', after: 'b' });
    github.file({ path: 'c.ts', changeType: 'ADDED', after: 'c' });
    github.blobAt('head-2:a.ts', { text: 'pushed' });
    github.blobAt('head-2:b.ts', { text: 'b' });
    github.blobAt('head-2:c.ts', { text: 'c' });
    const { model } = open(uniqueLogin(), github, request => {
        if (request.operation === 'PullRequestReviewFiles' && request.variables.after) {
            github.moveHead('head-2');
        }

        return null;
    });

    await waitUntil(() => model.headRefOid === 'head-2', { timeoutMs: 2000 });
    await settled(model);

    expect(model.files.map(file => file.path)).toEqual(['a.ts', 'b.ts', 'c.ts']);
    expect(model.getState('a.ts')).toEqual({ kind: 'ready', before: null, after: 'pushed' });
});

test('a base whose tip moved on starts nothing over while the merge base stays; a new merge base shows what is new', async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'MODIFIED', before: 'before', after: 'after' });
    const { model, files, session } = open(uniqueLogin(), github);
    await settled(model);
    const state = model.getState('a.ts');

    github.moveBase('base-tip-2', MERGE_BASE);
    files.open(REFERENCE);
    await waitUntil(() => session.operations().includes('GET /repos/acme/web/compare/base-tip-2...head-1'), {
        timeoutMs: 2000,
    });
    await session.clock.advance(50);

    expect(model.getState('a.ts')).toBe(state);
    expect(session.github.requests.filter(isOidQuery)).toHaveLength(1);

    github.moveBase('base-tip-3', 'merge-base-2');
    github.blobAt('merge-base-2:a.ts', { text: 'rebased onto' });
    files.open(REFERENCE);
    await waitUntil(() => model.getState('a.ts') !== state, { timeoutMs: 2000 });
    await settled(model);

    expect(model.getState('a.ts')).toEqual({ kind: 'ready', before: 'rebased onto', after: 'after' });
});

test('a refresh that fails keeps the list shown and warns; nothing kept, the failure shows', async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'ADDED', after: 'a' });
    const login = uniqueLogin();
    const first = open(login, github);
    await settled(first.model);
    await waitUntilAllKept(login, [`${HEAD}:a.ts`], oidOf('a'));

    github.failNext('PullRequestReviewFiles');
    const second = open(login, github);

    await waitUntil(() => second.session.logs.some(log => log.level === 'warn'), { timeoutMs: 2000 });
    expect(second.model.list).toEqual({ kind: 'ready' });
    await settled(second.model);
    expect(second.model.getState('a.ts')).toEqual({ kind: 'ready', before: null, after: 'a' });
});

test('GitHub answering NOT_FOUND hides the kept code and its list, and opening again asks anew', async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'ADDED', after: 'a' });
    const login = uniqueLogin();
    const first = open(login, github);
    await settled(first.model);
    await waitUntilAllKept(login, [`${HEAD}:a.ts`], oidOf('a'));

    github.refuseNext('PullRequestReviewFiles', 'NOT_FOUND');
    const second = open(login, github);
    await waitUntil(() => second.model.list.kind === 'gone', { timeoutMs: 2000 });

    expect(second.model.files).toEqual([]);
    expect(second.model.getState('a.ts')).toEqual({ kind: 'waiting' });

    second.files.open(REFERENCE);
    await waitUntil(() => second.model.list.kind === 'ready' && second.model.files.length === 1, { timeoutMs: 2000 });

    github.refuseNext('PullRequestReviewFiles', 'NOT_FOUND');
    second.files.open(REFERENCE);
    await waitUntil(() => second.model.list.kind === 'gone', { timeoutMs: 2000 });
    github.failNext('PullRequestReviewFiles');
    const third = open(login, github);
    await waitUntil(() => third.model.list.kind === 'failed', { timeoutMs: 2000 });
    expect(third.model.files).toEqual([]);
});

test('GitHub answering FORBIDDEN, as for an organisation restricting apps, keeps what is kept showing', async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'ADDED', after: 'a' });
    const login = uniqueLogin();
    const first = open(login, github);
    await settled(first.model);
    await waitUntilAllKept(login, [`${HEAD}:a.ts`], oidOf('a'));

    github.refuseNext('PullRequestReviewFiles', 'FORBIDDEN');
    const second = open(login, github);

    await waitUntil(() => second.session.logs.some(log => log.level === 'warn'), { timeoutMs: 2000 });
    expect(second.model.list).toEqual({ kind: 'ready' });
    await settled(second.model);
    expect(second.model.getState('a.ts')).toEqual({ kind: 'ready', before: null, after: 'a' });
});

test('signing out with every kind of answer on its way: the kept list, oids and merge base stay off the disk', async () => {
    const github = createGitHub();
    github.file({ path: 'a.ts', changeType: 'MODIFIED', before: 'before', after: 'after' });
    github.file({ path: 'b.ts', changeType: 'ADDED', after: 'b' });
    github.file({ path: 'c.ts', changeType: 'ADDED', after: 'c' });
    const login = uniqueLogin();
    const silent = createSilentHold(
        request => request.operation !== 'PullRequestReviewFiles' || !!request.variables.after,
    );
    const { model, session } = open(login, github, silent.hold);
    session.container.resolve(ItemStore);
    await waitUntil(() => session.operations().some(operation => operation.includes('/compare/')), {
        timeoutMs: 2000,
    });
    await waitUntil(async () => (await databaseNames()).includes(getReviewBlobDatabaseName(login)), {
        timeoutMs: 2000,
    });

    session.signOutFromAnotherTab();
    await waitUntil(async () => !(await databaseNames()).includes(getReviewBlobDatabaseName(login)), {
        timeoutMs: 2000,
    });

    silent.release();
    await session.clock.advance(100);

    expect(model.files).toEqual([]);
    expect(await databaseNames()).not.toContain(getReviewBlobDatabaseName(login));
});

test('a lock file, a generated and a very large file are neither read nor asked about until opened; opening one fetches it next', async () => {
    const github = createGitHub({ pageSize: 10 });
    github.blobAt(`${HEAD}:.gitattributes`, { text: '*.gen.ts linguist-generated\n' });
    github.file({ path: 'bun.lock', changeType: 'MODIFIED', before: 'lock a', after: 'lock b' });
    github.file({ path: 'src/api.gen.ts', changeType: 'MODIFIED', before: 'gen a', after: 'gen b' });
    github.file({ path: 'data.json', changeType: 'ADDED', after: 'big', additions: 3000 });
    github.file({ path: 'almost.json', changeType: 'ADDED', after: 'almost', additions: 2997 });
    const { model, session } = open(uniqueLogin(), github);

    await settled(model);

    expect(model.getCollapse('bun.lock')).toBe('lockFile');
    expect(model.getCollapse('src/api.gen.ts')).toBe('generated');
    expect(model.getCollapse('data.json')).toBe('large');
    expect(model.getCollapse('almost.json')).toBeNull();
    expect(oidExpressions(session).toSorted()).toEqual([`${HEAD}:.gitattributes`, `${HEAD}:almost.json`]);
    expect(textsAsked(session).toSorted()).toEqual(
        [oidOf('*.gen.ts linguist-generated\n'), oidOf('almost')].toSorted(),
    );

    model.setCollapsed('bun.lock', false);
    await settled(model);

    expect(model.getState('bun.lock')).toEqual({ kind: 'ready', before: 'lock a', after: 'lock b' });
    expect(textsAsked(session)).toContain(oidOf('lock b'));
    expect(textsAsked(session)).not.toContain(oidOf('gen b'));
    expect(textsAsked(session)).not.toContain(oidOf('big'));
});

test('a jump to a collapsed file fetches nothing of it: only opening does', async () => {
    const github = createGitHub();
    github.file({ path: 'yarn.lock', changeType: 'ADDED', after: 'lock' });
    const { model, session } = open(uniqueLogin(), github);
    await settled(model);

    model.prioritize('yarn.lock');
    await session.clock.advance(50);

    expect(textsAsked(session)).toEqual([]);
    expect(model.getState('yarn.lock')).toEqual({ kind: 'waiting' });
});

test('until .gitattributes is read no file can be fetched, and one that may be generated never shows open', async () => {
    const github = createGitHub({ pageSize: 10 });
    github.blobAt(`${HEAD}:.gitattributes`, { text: 'dist/** linguist-generated\n' });
    github.file({ path: 'dist/app.js', changeType: 'ADDED', after: 'built' });
    github.file({ path: 'src/app.ts', changeType: 'ADDED', after: 'written' });
    github.file({ path: 'go.sum', changeType: 'ADDED', after: 'sums' });
    const hold = createSilentHold(
        request => request.operation === 'ReviewBlobOids' && request.variables.e0 === `${HEAD}:.gitattributes`,
    );
    const { model, session } = open(uniqueLogin(), github, hold.hold);
    await waitUntil(() => model.listComplete && session.operations().includes('ReviewBlobOids'), { timeoutMs: 2000 });
    await session.clock.advance(50);

    expect(model.getCollapse('dist/app.js')).toBe('undecided');
    expect(model.getCollapse('src/app.ts')).toBe('undecided');
    // Its name says already.
    expect(model.getCollapse('go.sum')).toBe('lockFile');
    expect(oidExpressions(session)).toEqual([`${HEAD}:.gitattributes`]);

    hold.release();
    await settled(model);

    expect(model.getCollapse('dist/app.js')).toBe('generated');
    expect(model.getState('dist/app.js')).toEqual({ kind: 'waiting' });
    expect(model.getCollapse('src/app.ts')).toBeNull();
    expect(model.getState('src/app.ts')).toEqual({ kind: 'ready', before: null, after: 'written' });
});

test('.gitattributes is read once per head, then from the disk; failing to read it collapses nothing and holds nothing up', async () => {
    const github = createGitHub();
    github.blobAt(`${HEAD}:.gitattributes`, { text: '*.gen.ts linguist-generated\n' });
    github.file({ path: 'a.gen.ts', changeType: 'ADDED', after: 'generated' });
    github.file({ path: 'a.ts', changeType: 'ADDED', after: 'plain' });
    const login = uniqueLogin();
    const first = open(login, github);
    await settled(first.model);
    await waitUntilKept(login, oidOf('*.gen.ts linguist-generated\n'));
    await waitUntilAllKept(login, [`${HEAD}:a.ts`], oidOf('plain'));

    const reloaded = open(login, github);
    await settled(reloaded.model);

    expect(reloaded.model.getCollapse('a.gen.ts')).toBe('generated');
    expect(reloaded.session.operations()).not.toContain('ReviewBlobOids');

    github.failNext('ReviewBlobOids');
    const failing = open(uniqueLogin(), github);
    await settled(failing.model);

    expect(failing.model.getCollapse('a.gen.ts')).toBeNull();
    expect(failing.model.getState('a.gen.ts')).toEqual({ kind: 'ready', before: null, after: 'generated' });
});

test('a file collapsed by hand before its turn is not fetched, one collapsed once read opens again at once, and either keeps the reason it has', async () => {
    const github = createGitHub({ pageSize: 10 });
    github.file({ path: 'read.ts', changeType: 'ADDED', after: 'read' });
    github.file({ path: 'later.ts', changeType: 'ADDED', after: 'later' });
    github.file({ path: 'bun.lock', changeType: 'ADDED', after: 'lock' });
    const hold = createSilentHold(request => request.operation === 'ReviewBlobOids');
    const { model, session } = open(uniqueLogin(), github, hold.hold);

    await waitUntil(() => model.listComplete, { timeoutMs: 2000 });
    model.setCollapsed('later.ts', true);
    expect(model.getCollapse('later.ts')).toBe('byHand');
    hold.release();
    await settled(model);

    expect(textsAsked(session)).toEqual([oidOf('read')]);

    model.setCollapsed('read.ts', true);
    const asked = session.github.requests.length;
    model.setCollapsed('read.ts', false);

    expect(model.getState('read.ts')).toEqual({ kind: 'ready', before: null, after: 'read' });
    expect(session.github.requests).toHaveLength(asked);

    model.setCollapsed('bun.lock', false);
    expect(model.getCollapse('bun.lock')).toBeNull();
    expect(model.getCollapseReason('bun.lock')).toBe('lockFile');
    model.setCollapsed('bun.lock', true);
    expect(model.getCollapse('bun.lock')).toBe('lockFile');
});

test('viewed marks show at once and go to GitHub together, however many; a failed request puts them back and says so', async () => {
    const github = createGitHub({ pageSize: 10 });
    github.file({ path: 'a.ts', changeType: 'ADDED', after: 'a' });
    github.file({ path: 'b.ts', changeType: 'ADDED', after: 'b' });
    const { model, session } = open(uniqueLogin(), github);
    await settled(model);

    model.setViewed(['a.ts', 'b.ts'], true);

    expect(viewedOf(model, 'a.ts')).toBe('VIEWED');
    expect(viewedOf(model, 'b.ts')).toBe('VIEWED');
    await waitUntil(() => github.markedViewed.length === 1, { timeoutMs: 2000 });
    expect(github.markedViewed[0]).toEqual({ pullRequestId: 'PR_7', p0: 'a.ts', p1: 'b.ts' });

    github.setViewed('a.ts', 'VIEWED');
    github.setViewed('b.ts', 'VIEWED');
    github.failNext('MarkFilesViewed');
    model.setViewed(['a.ts', 'b.ts'], false);
    expect(viewedOf(model, 'a.ts')).toBe('UNVIEWED');
    const failures = session.container.resolve(ReviewViewedFailures);
    await waitUntil(() => failures.latest !== null, { timeoutMs: 2000 });

    // Back to what GitHub said last, and the list read again in case any of the request did go through.
    expect(viewedOf(model, 'a.ts')).toBe('VIEWED');
    expect(viewedOf(model, 'b.ts')).toBe('VIEWED');
    expect(failures.latest?.message).toBe('Server Error');
});

test('a failed mark goes back to what GitHub last said, a dismissed one too', async () => {
    const github = createGitHub({ pageSize: 10 });
    github.file({ path: 'a.ts', changeType: 'ADDED', after: 'a' });
    github.setViewed('a.ts', 'DISMISSED');
    const { model, session } = open(uniqueLogin(), github);
    await settled(model);

    github.failNext('MarkFilesViewed');
    model.setViewed(['a.ts'], true);
    expect(viewedOf(model, 'a.ts')).toBe('VIEWED');
    const failures = session.container.resolve(ReviewViewedFailures);
    await waitUntil(() => failures.latest !== null, { timeoutMs: 2000 });

    expect(viewedOf(model, 'a.ts')).toBe('DISMISSED');
    expect(failures.latest?.paths).toEqual(['a.ts']);
});

test('marks set while a request is on its way go next, in order, and the last one set is what stays', async () => {
    const github = createGitHub({ pageSize: 10 });
    github.file({ path: 'a.ts', changeType: 'ADDED', after: 'a' });
    const hold = createSilentHold(request => request.operation === 'MarkFilesViewed');
    const { model, session } = open(uniqueLogin(), github, hold.hold);
    await settled(model);

    model.setViewed(['a.ts'], true);
    await waitUntil(() => session.operations().includes('MarkFilesViewed'), { timeoutMs: 2000 });
    model.setViewed(['a.ts'], false);
    expect(viewedOf(model, 'a.ts')).toBe('UNVIEWED');
    await session.clock.advance(50);
    expect(session.operations().filter(operation => operation === 'MarkFilesViewed')).toHaveLength(1);

    hold.release();
    await waitUntil(() => github.markedViewed.length === 2, { timeoutMs: 2000 });

    const mutations = session.github.requests.filter(request => request.operation === 'MarkFilesViewed');
    expect(mutations.map(request => request.variables.p0)).toEqual(['a.ts', 'a.ts']);
    expect(viewedOf(model, 'a.ts')).toBe('UNVIEWED');
});

test('a re-read list has the last word when nothing is on its way, but not over a mark on its way or one set after it was asked for', async () => {
    const github = createGitHub({ pageSize: 10 });
    github.file({ path: 'a.ts', changeType: 'ADDED', after: 'a' });
    github.file({ path: 'b.ts', changeType: 'ADDED', after: 'b' });
    const { model, files, session } = open(uniqueLogin(), github);
    await settled(model);

    // Marked on github.com.
    github.setViewed('b.ts', 'VIEWED');
    files.open(REFERENCE);
    await waitUntil(() => viewedOf(model, 'b.ts') === 'VIEWED', { timeoutMs: 2000 });

    // On its way: the list doesn't know yet.
    const mutation = createSilentHold(request => request.operation === 'MarkFilesViewed');
    session.github.holdIf = mutation.hold;
    model.setViewed(['a.ts'], true);
    await waitUntil(() => session.operations().includes('MarkFilesViewed'), { timeoutMs: 2000 });
    const reads = () => session.operations().filter(operation => operation === 'PullRequestReviewFiles').length;
    const before = reads();
    files.open(REFERENCE);
    await waitUntil(() => reads() === before + 1, { timeoutMs: 2000 });
    await session.clock.advance(20);
    expect(viewedOf(model, 'a.ts')).toBe('VIEWED');
    mutation.release();
    await waitUntil(() => github.markedViewed.length === 1, { timeoutMs: 2000 });

    // Asked for before the mark was set, answered after it was done.
    const list = createSilentHold(request => request.operation === 'PullRequestReviewFiles');
    session.github.holdIf = list.hold;
    files.open(REFERENCE);
    await waitUntil(() => reads() === before + 2, { timeoutMs: 2000 });
    session.github.holdIf = null;
    model.setViewed(['b.ts'], false);
    await waitUntil(() => github.markedViewed.length === 2, { timeoutMs: 2000 });
    await session.clock.advance(20);
    list.release();
    await session.clock.advance(20);
    await Bun.sleep(20);
    expect(viewedOf(model, 'b.ts')).toBe('UNVIEWED');

    // Nothing on its way any more: what GitHub says stands.
    github.setViewed('b.ts', 'VIEWED');
    files.open(REFERENCE);
    await waitUntil(() => viewedOf(model, 'b.ts') === 'VIEWED', { timeoutMs: 2000 });
});

interface TestFile {
    readonly path: string;
    readonly changeType: ReviewFile['changeType'];
    readonly previousPath?: string;
    readonly before?: string;
    readonly after?: string;
    /** The head side says it is binary. */
    readonly binary?: boolean;
    /** The head side's size, when it should not be its text's. */
    readonly byteSize?: number;
    /** A commit at both sides, as a submodule has: GitHub answers it like nothing at that path. */
    readonly submodule?: boolean;
    /** How many lines it adds, when more than the list's usual 1. */
    readonly additions?: number;
}

/** The key the list of {@link REFERENCE} is kept under. */
const LIST_KEY = 'acme/web/7';

interface TestBlob {
    readonly text: string;
    readonly isBinary?: boolean;
    readonly byteSize?: number;
}

/** A fake GitHub over one pull request: a page holds at most `pageSize` files, 2 unless told, to show page after page. */
function createGitHub({ pageSize = 2 }: { pageSize?: number } = {}) {
    const files: TestFile[] = [];
    const objects = new Map<string, TestBlob>();
    const blobs = new Map<string, TestBlob>();
    const truncated = new Map<string, string>();
    const failing = new Set<string>();
    const refusing = new Map<string, string>();
    let failedExpression: string | null = null;
    let rateLimited: string | null = null;
    const viewed = new Map<string, ReviewFile['viewed']>();
    const markedViewed: Readonly<Record<string, unknown>>[] = [];
    let head = HEAD;
    let base = BASE_TIP;
    let mergeBase = MERGE_BASE;

    return {
        file,
        blobAt,
        truncate: (text: string, cut: string) => truncated.set(oidOf(text), cut),
        failExpression: (expression: string | null) => {
            failedExpression = expression;
        },
        failNext: (operation: string) => failing.add(operation),
        refuseNext: (operation: string, type: string) => refusing.set(operation, type),
        rateLimit: (operation: string | null) => {
            rateLimited = operation;
        },
        moveHead: (oid: string) => {
            head = oid;
        },
        moveBase: (oid: string, newMergeBase: string) => {
            base = oid;
            mergeBase = newMergeBase;
        },
        setViewed: (path: string, state: ReviewFile['viewed']) => viewed.set(path, state),
        markedViewed,
        answer,
        answerRest,
    };

    function file(testFile: TestFile) {
        files.push(testFile);
        if (testFile.submodule) {
            return;
        }

        if (testFile.before !== undefined) {
            blobAt(`${MERGE_BASE}:${testFile.previousPath ?? testFile.path}`, { text: testFile.before });
        }

        if (testFile.after !== undefined) {
            const { binary, byteSize } = testFile;
            blobAt(`${HEAD}:${testFile.path}`, {
                text: testFile.after,
                ...(binary ? { isBinary: true } : {}),
                ...(byteSize === undefined ? {} : { byteSize }),
            });
        }
    }

    function blobAt(expression: string, blob: TestBlob) {
        objects.set(expression, blob);
        blobs.set(oidOf(blob.text), blob);
    }

    function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
        if (failing.delete(request.operation)) {
            return undefined;
        }

        const refusal = refusing.get(request.operation);
        if (refusal !== undefined) {
            refusing.delete(request.operation);
            return { data: { repository: null }, errors: [{ type: refusal, message: `${refusal} by GitHub` }] };
        }

        if (rateLimited === request.operation) {
            return { data: null, errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] };
        }

        switch (request.operation) {
            case 'PullRequestReviewFiles':
                return { data: answerList(request) };
            case 'ReviewBlobOids':
                return answerOids(request);
            case 'ReviewBlobTexts':
                return { data: answerTexts(request) };
            case 'MarkFilesViewed':
                markedViewed.push(request.variables);
                return { data: {} };
            default:
                return undefined;
        }
    }

    function answerList(request: TestGraphQLRequest) {
        const start = Number(request.variables.after ?? 0);
        const end = start + pageSize;
        return {
            repository: {
                pullRequest: {
                    id: 'PR_7',
                    headRefOid: head,
                    baseRefOid: base,
                    changedFiles: files.length,
                    files: {
                        pageInfo: { hasNextPage: end < files.length, endCursor: String(end) },
                        nodes: files.slice(start, end).map(({ path, changeType, additions = 1 }) => ({
                            path,
                            changeType,
                            additions,
                            deletions: 2,
                            viewerViewedState: viewed.get(path) ?? 'UNVIEWED',
                        })),
                    },
                },
            },
        };
    }

    function answerOids(request: TestGraphQLRequest): TestGraphQLAnswer {
        const repository: Record<string, unknown> = {};
        const failures: GitHubGraphQLErrorEntry[] = [];
        for (const [name, expression] of variablesOf(request, 'e')) {
            const alias = `b${name}`;
            const object = objects.get(expression);
            if (expression === failedExpression) {
                repository[alias] = null;
                failures.push({ type: 'SERVICE_UNAVAILABLE', message: 'Try later', path: ['repository', alias] });
            } else {
                repository[alias] = object
                    ? { oid: oidOf(object.text), byteSize: sizeOf(object), isBinary: object.isBinary ?? false }
                    : null;
            }
        }

        return failures.length > 0 ? { data: { repository }, errors: failures } : { data: { repository } };
    }

    function answerTexts(request: TestGraphQLRequest) {
        const repository: Record<string, unknown> = {};
        for (const [name, oid] of variablesOf(request, 'o')) {
            const blob = blobs.get(oid);
            const cut = truncated.get(oid);
            repository[`b${name}`] = blob && {
                oid,
                text: cut ?? blob.text,
                isTruncated: cut !== undefined,
                isBinary: blob.isBinary ?? false,
                byteSize: sizeOf(blob),
            };
        }

        return { repository };
    }

    function answerRest(request: TestGraphQLRequest): TestRestAnswer | undefined {
        if (failing.delete(request.operation)) {
            return undefined;
        }

        const compared = /^GET \/repos\/acme\/web\/compare\/([^.]+)\.\.\.(.+)$/.exec(request.operation);
        if (compared?.[1] === base && compared[2] === head) {
            return { status: 200, body: { merge_base_commit: { sha: mergeBase }, commits: [] } };
        }

        // An earlier base of the same head is still a commit GitHub can compare; one that has not moved with it forked here.
        if (compared?.[2] === head) {
            return { status: 200, body: { merge_base_commit: { sha: MERGE_BASE }, commits: [] } };
        }

        if (request.operation === 'GET /repos/acme/web/pulls/7/files') {
            const renamed = files.filter(({ previousPath }) => previousPath !== undefined);
            return {
                status: 200,
                body: renamed.map(({ path, previousPath }) => ({
                    filename: path,
                    previous_filename: previousPath,
                    patch: '@@',
                })),
            };
        }

        const blobPrefix = 'GET /repos/acme/web/git/blobs/';
        if (request.operation.startsWith(blobPrefix)) {
            const blob = blobs.get(request.operation.slice(blobPrefix.length));
            return (
                blob && {
                    status: 200,
                    body: { encoding: 'base64', content: Buffer.from(blob.text).toString('base64') },
                }
            );
        }

        return undefined;
    }
}

function open(login: string, github: ReturnType<typeof createGitHub>, holdIf?: TestHold) {
    const session = createTestSession({ login, answer: github.answer, answerRest: github.answerRest });
    setIndexedDbPersistence(session.container);
    if (holdIf) {
        session.github.holdIf = holdIf;
    }

    const files = session.container.resolve(ReviewFiles);
    const model = files.open(REFERENCE);
    if (!model) {
        throw new Error('Signed in, so it opens');
    }

    return { session, files, model };
}

type TestHold = (request: TestGraphQLRequest) => Promise<void> | null;
type TestSession = ReturnType<typeof createTestSession>;

function fileRow(path: string, changeType: ReviewFile['changeType']): ReviewFile {
    return { path, previousPath: null, changeType, additions: 1, deletions: 2, viewed: 'UNVIEWED' };
}

function expectStates(model: PullRequestFiles, expected: Record<string, ReviewFileState>) {
    expect(Object.fromEntries(model.files.map(file => [file.path, model.getState(file.path)]))).toEqual(expected);
}

/** Waits until no open file has anything left to come. */
async function settled(model: PullRequestFiles) {
    await waitUntil(
        () => {
            // A collapsed file has nothing to come; one that may yet be has it all.
            const shown = model.files.filter(file => model.getCollapse(file.path) === null);
            const kinds = shown.map(file => model.getState(file.path).kind);
            return (
                model.list.kind === 'ready' &&
                model.listComplete &&
                model.files.every(file => model.getCollapse(file.path) !== 'undecided') &&
                kinds.every(kind => kind !== 'waiting' && kind !== 'loading')
            );
        },
        { timeoutMs: 5000 },
    );
}

/** Written behind, so a reload may have to wait for it. */
async function waitUntilKept(login: string, oid: string) {
    const store = ReviewBlobStore.create();
    await waitUntil(async () => (await store.read(login, [oid])).has(oid), { timeoutMs: 2000 });
}

/**
 * Waits until a reload would find what the first read kept: the list, the merge base, the expressions and a blob, all
 * written behind.
 */
async function waitUntilAllKept(login: string, expressions: readonly string[], oid: string) {
    const store = ReviewBlobStore.create();
    const keys = [...expressions, `${HEAD}:.gitattributes`].map(expression => `acme/web:${expression}`);
    await waitUntil(
        async () => {
            const resolutions = await store.readResolutions(login, keys);
            const blobs = await store.read(login, [oid]);
            return (
                resolutions.size === keys.length &&
                blobs.size === 1 &&
                (await store.readFileList(login, LIST_KEY)) !== undefined
            );
        },
        { timeoutMs: 2000 },
    );
}

/** Holds GitHub's answers to what `applies` says, every request if not told, until released. */
function createSilentHold(applies: (request: TestGraphQLRequest) => boolean = () => true) {
    let release = () => {};
    const held = new Promise<void>(resolve => {
        release = resolve;
    });
    return {
        hold: (request: TestGraphQLRequest) => (applies(request) ? held : null),
        release: () => release(),
    };
}

/** What the review asked of GitHub: not who is signed in, which the session asks in its own time. */
function reviewOperations(session: TestSession) {
    return session.operations().filter(operation => operation !== 'Viewer');
}

/** A query for the oids of a pull request's files, not of what collapses them. */
function isOidQuery(request: TestGraphQLRequest) {
    return request.operation === 'ReviewBlobOids' && !String(request.variables.e0).endsWith(':.gitattributes');
}

function oidOf(text: string) {
    return Buffer.from(text).toString('hex');
}

function sizeOf(blob: TestBlob) {
    return blob.byteSize ?? new TextEncoder().encode(blob.text).length;
}

function variablesOf(request: TestGraphQLRequest, prefix: string): [string, string][] {
    const found: [string, string][] = [];
    for (const [name, value] of Object.entries(request.variables)) {
        const index =
            name.startsWith(prefix) && /^\d+$/.test(name.slice(prefix.length)) ? name.slice(prefix.length) : null;
        if (index !== null && typeof value === 'string') {
            found.push([index, value]);
        }
    }

    return found;
}

function textQueries(session: TestSession) {
    return session.github.requests
        .filter(request => request.operation === 'ReviewBlobTexts')
        .map(request => variablesOf(request, 'o').map(([, oid]) => oid));
}

function textsAsked(session: TestSession) {
    return textQueries(session).flat();
}

function oidExpressions(session: TestSession) {
    return session.github.requests
        .filter(request => request.operation === 'ReviewBlobOids')
        .flatMap(request => variablesOf(request, 'e').map(([, expression]) => expression));
}

function viewedOf(model: PullRequestFiles, path: string) {
    return model.files.find(file => file.path === path)?.viewed;
}

function uniqueLogin() {
    return `user-${crypto.randomUUID()}`;
}

async function databaseNames() {
    const databases = await indexedDB.databases();
    return databases.map(database => database.name);
}
