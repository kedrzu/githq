/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own logins, so their databases never meet.
import 'fake-indexeddb/auto';

import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import { waitUntil } from '@nzyme/utils/waitUntil.js';
import { expect, test } from 'bun:test';
import { computed } from 'vue';

import { ItemStore } from '@/store/ItemStore.js';
import { createTestSession } from '@/testing/createTestSession.js';
import type { TestGraphQLAnswer, TestGraphQLRequest, TestRestAnswer } from '@/testing/createTestSession.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { getReviewBlobDatabaseName, ReviewBlobStore } from './ReviewBlobStore.js';
import { ReviewFiles } from './ReviewFiles.js';
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
        'image.png': { kind: 'binary' },
        'huge.ts': { kind: 'tooLarge' },
        nzyme: { kind: 'binary' },
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

test('texts are asked in the order of the list, at most 50 in a query and 3 queries at a time, and a jump goes next', async () => {
    const github = createGitHub();
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
    expect(textQueries(session)[0]).toEqual(Array.from({ length: 50 }, (_, index) => oidOf(`text ${index}`)));
    expect(textQueries(session)[1]?.[0]).toBe(oidOf('text 50'));

    model.prioritize('file-199.ts');
    held[0]?.();
    await waitUntil(() => textQueries(session).length === 4, { timeoutMs: 2000 });
    expect(textQueries(session)[3]?.[0]).toBe(oidOf('text 199'));
    expect(textQueries(session)[3]?.[1]).toBe(oidOf('text 150'));

    session.github.holdIf = null;
    for (const release of held) {
        release();
    }

    await settled(model);
    expect(model.getState('file-199.ts')).toEqual({ kind: 'ready', before: null, after: 'text 199' });
    expect(model.getState('file-100.ts')).toEqual({ kind: 'ready', before: null, after: 'text 100' });
});

test('a query keeps its answer under about 2 MB', async () => {
    const github = createGitHub();
    for (let index = 0; index < 5; index++) {
        github.file({ path: `file-${index}.ts`, changeType: 'ADDED', after: `text ${index}`, byteSize: 900_000 });
    }

    const { model, session } = open(uniqueLogin(), github);
    await settled(model);

    expect(textQueries(session).map(oids => oids.length)).toEqual([2, 2, 1]);
});

test('oid expressions are asked 100 at a time, and a jump asked before the list arrives goes first', async () => {
    const github = createGitHub();
    for (let index = 0; index < 60; index++) {
        github.file({ path: `file-${index}.ts`, changeType: 'MODIFIED', before: `was ${index}`, after: `is ${index}` });
    }

    const { model, session } = open(uniqueLogin(), github);
    model.prioritize('file-59.ts');
    await settled(model);

    const oidQueries = session.github.requests.filter(request => request.operation === 'ReviewBlobOids');
    expect(oidQueries.map(request => Object.keys(request.variables).length - 2)).toEqual([100, 20]);
    expect(oidQueries[0]?.variables.e0).toBe(`${MERGE_BASE}:file-59.ts`);
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
    expect(session.operations().filter(operation => operation === 'ReviewBlobOids')).toHaveLength(1);

    github.moveHead('head-2');
    github.blobAt('head-2:a.ts', { text: 'pushed' });
    expect(files.open(REFERENCE)).toBe(model);
    await waitUntil(() => model.headRefOid === 'head-2', { timeoutMs: 2000 });
    await settled(model);

    expect(model.getState('a.ts')).toEqual({ kind: 'ready', before: 'before', after: 'pushed' });
});

test('many files arriving tell of it once a frame, not once a file', async () => {
    const github = createGitHub();
    for (let index = 0; index < 225; index++) {
        github.file({ path: `file-${index}.ts`, changeType: 'ADDED', after: `text ${index}` });
    }

    let release = () => {};
    const held = new Promise<void>(resolve => {
        release = resolve;
    });
    const { model, session } = open(uniqueLogin(), github, request =>
        request.operation === 'ReviewBlobOids' ? held : null,
    );
    await waitUntil(() => model.list.kind === 'ready', { timeoutMs: 2000 });
    const lastState = computed(() => model.getState('file-224.ts').kind);
    expect(lastState.value).toBe('loading');

    // The clock stands still, so no frame comes while they all arrive.
    release();
    await waitUntil(() => model.files.every(file => model.getState(file.path).kind === 'ready'), { timeoutMs: 5000 });
    expect(model.version).toBe(0);
    expect(lastState.value).toBe('loading');

    await session.clock.advance(16);

    expect(model.version).toBe(1);
    expect(lastState.value).toBe('ready');
});

test('a rate-limit refusal fails what is waiting instead of asking on; a retry asks again', async () => {
    const github = createGitHub();
    for (let index = 0; index < 1000; index++) {
        github.file({ path: `file-${index}.ts`, changeType: 'ADDED', after: `text ${index}` });
    }

    github.rateLimit('ReviewBlobTexts');
    const { model, session } = open(uniqueLogin(), github);

    await settled(model);

    expect(model.files.every(file => model.getState(file.path).kind === 'failed')).toBe(true);
    // Only what was on its way when the first refusal came; all of them would take 20.
    const asked = textQueries(session).length;
    expect(asked).toBeLessThan(8);

    github.rateLimit(null);
    model.retry('file-999.ts');
    await settled(model);

    expect(model.getState('file-999.ts')).toEqual({ kind: 'ready', before: null, after: 'text 999' });
    expect(textQueries(session)).toHaveLength(asked + 1);
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
    /** A commit at both sides, as a submodule has. */
    readonly submodule?: boolean;
}

interface TestBlob {
    readonly text: string;
    readonly isBinary?: boolean;
    readonly byteSize?: number;
}

/** A fake GitHub over one pull request: a page holds at most 2 files. */
function createGitHub() {
    const files: TestFile[] = [];
    const objects = new Map<string, TestBlob | 'submodule'>();
    const blobs = new Map<string, TestBlob>();
    const truncated = new Map<string, string>();
    const failing = new Set<string>();
    let failedExpression: string | null = null;
    let rateLimited: string | null = null;
    let head = HEAD;

    return {
        file,
        blobAt,
        truncate: (text: string, cut: string) => truncated.set(oidOf(text), cut),
        failExpression: (expression: string | null) => {
            failedExpression = expression;
        },
        failNext: (operation: string) => failing.add(operation),
        rateLimit: (operation: string | null) => {
            rateLimited = operation;
        },
        moveHead: (oid: string) => {
            head = oid;
        },
        answer,
        answerRest,
    };

    function file(testFile: TestFile) {
        files.push(testFile);
        if (testFile.submodule) {
            objects.set(`${HEAD}:${testFile.path}`, 'submodule');
            objects.set(`${MERGE_BASE}:${testFile.path}`, 'submodule');
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
            default:
                return undefined;
        }
    }

    function answerList(request: TestGraphQLRequest) {
        const start = Number(request.variables.after ?? 0);
        const end = start + 2;
        return {
            repository: {
                pullRequest: {
                    id: 'PR_7',
                    headRefOid: head,
                    baseRefOid: BASE_TIP,
                    changedFiles: files.length,
                    files: {
                        pageInfo: { hasNextPage: end < files.length, endCursor: String(end) },
                        nodes: files.slice(start, end).map(({ path, changeType }) => ({
                            path,
                            changeType,
                            additions: 1,
                            deletions: 2,
                            viewerViewedState: 'UNVIEWED',
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
            } else if (object === 'submodule') {
                repository[alias] = {};
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

        if (request.operation === `GET /repos/acme/web/compare/${BASE_TIP}...${head}`) {
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

/** Waits until no file has anything left to come. */
async function settled(model: PullRequestFiles) {
    await waitUntil(
        () => {
            const kinds = model.files.map(file => model.getState(file.path).kind);
            return model.list.kind === 'ready' && kinds.every(kind => kind !== 'waiting' && kind !== 'loading');
        },
        { timeoutMs: 5000 },
    );
}

/** Written behind, so a reload may have to wait for it. */
async function waitUntilKept(login: string, oid: string) {
    const store = ReviewBlobStore.create();
    await waitUntil(async () => (await store.read(login, [oid])).has(oid), { timeoutMs: 2000 });
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

function uniqueLogin() {
    return `user-${crypto.randomUUID()}`;
}

async function databaseNames() {
    const databases = await indexedDB.databases();
    return databases.map(database => database.name);
}
