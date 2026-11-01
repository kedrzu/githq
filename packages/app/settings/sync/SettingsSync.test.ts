/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { ItemStore } from '@/store/ItemStore.js';
import { createTestSession } from '@/testing/createTestSession.js';
import type { TestGraphQLRequest, TestRestAnswer } from '@/testing/createTestSession.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import type { TrackedRepository } from '@/tracking/TrackingTypes.js';

import { parseSettings, serializeSettings } from './SettingsDocument.js';
import type { SettingsDocument, SettingsRepository } from './SettingsDocument.js';
import { SettingsSync } from './SettingsSync.js';

const WEB: TrackedRepository = { nameWithOwner: 'acme/web', id: 'R_web' };
const API: TrackedRepository = { nameWithOwner: 'acme/api', id: 'R_api' };
const DOCS: TrackedRepository = { nameWithOwner: 'acme/docs', id: 'R_docs' };

test('while off it asks GitHub nothing: not at start, not on a change, not when the tab is shown', async () => {
    const { session, tracking, sync } = await open();

    tracking.choose({ repositories: [WEB], projects: [] });
    session.setVisible(false);
    session.setVisible(true);
    await sync.sync();
    await session.clock.advance(0);

    expect(sync.state).toEqual({ state: 'off' });
    expect(rest(session.operations())).toEqual([]);
});

test('turning on with no repository creates it and saves the settings, once GitHub lets the new repository be written', async () => {
    const { session, tracking, sync, github } = await open();
    tracking.choose({ repositories: [WEB, API], projects: [] });

    expect(await sync.inspect()).toEqual({ kind: 'absent' });
    // A new repository refuses its first write for a moment.
    github.refuseNextWrites = 1;
    const turningOn = sync.turnOn();
    await session.clock.advance(1000);
    await turningOn;

    expect(github.created).toBe(true);
    expect(github.file && parseSettings(github.file.text)).toEqual({ kind: 'ok', document: tracking.document });
    expect(sync.state).toMatchObject({ state: 'on', base: tracking.document, sha: github.file?.sha });
});

test('first contact keeps what either side tracks, and what the file untracked ends untracked here (D9)', async () => {
    const { tracking, sync, github } = await open();
    tracking.choose({ repositories: [WEB, API], projects: [] });
    github.repository = { private: true };
    github.writeFile(
        documentOf([
            { ...API, tracking: false },
            { ...DOCS, tracking: true },
        ]),
    );

    const found = await sync.inspect();
    if (found.kind !== 'found') {
        throw new Error(`Expected the file, got ${found.kind}`);
    }

    await sync.turnOn(found);

    const merged = documentOf([
        { ...API, tracking: false },
        { ...DOCS, tracking: true },
        { ...WEB, tracking: true },
    ]);
    expect(tracking.document).toEqual(merged);
    expect(tracking.repositories).toEqual([DOCS, WEB]);
    expect(github.file?.text).toBe(serializeSettings(merged));
    expect(sync.state).toMatchObject({ state: 'on', base: merged, sha: github.file?.sha });
});

test.each([
    ['a repository that is public', { private: false }, documentOf([]), { kind: 'public' }],
    ['a repository without the file', { private: true }, null, { kind: 'foreign' }],
    [
        'a file it cannot read',
        { private: true },
        '{ "version": 1, "repositories": [{}], "projects": [] }',
        { kind: 'unreadable' },
    ],
    ['a file of a newer githq', { private: true }, '{ "version": 3 }', { kind: 'newer', version: 3 }],
] as const)('turning on meets %s: unusable', async (_, repository, file, reason) => {
    const { sync, github } = await open();
    github.repository = repository;
    if (file !== null) {
        github.writeFile(file);
    }

    expect(await sync.inspect()).toEqual({ kind: 'unusable', reason });
});

test.each([
    ['unreadable', '{ "version": 1, "repositories": "acme/web", "projects": [] }', { kind: 'unreadable' }],
    ['newer', '{ "version": 2, "repositories": [], "projects": [] }', { kind: 'newer', version: 2 }],
] as const)('a file that became %s stops syncing and is never written over', async (_, text, reason) => {
    const { session, tracking, sync, github } = await turnedOn();
    github.writeFile(text);

    tracking.track({ repository: DOCS });
    await sync.sync();
    session.setVisible(false);
    session.setVisible(true);
    tracking.untrack({ kind: 'repository', nameWithOwner: 'acme/web' });
    await session.clock.advance(0);

    expect(sync.state).toMatchObject({ state: 'stopped', reason });
    expect(github.file?.text).toBe(text);
    expect(writes(session.operations())).toEqual([]);
});

test('turned off, it writes nothing and leaves the repository; the settings stay here', async () => {
    const { session, tracking, sync, github } = await turnedOn();
    const saved = github.file?.text;

    sync.turnOff();
    tracking.track({ repository: DOCS });
    session.setVisible(false);
    session.setVisible(true);
    await session.clock.advance(0);

    expect(sync.state).toEqual({ state: 'off', repositoryLeft: true });
    expect(tracking.repositories).toEqual([WEB, DOCS]);
    expect(github.file?.text).toBe(saved);
    expect(rest(session.operations())).toEqual([]);
});

test('a change here is saved at once; one made elsewhere is taken in when the tab is shown, for free when none was', async () => {
    const { session, tracking, sync, github } = await turnedOn();

    tracking.track({ repository: API });
    await session.clock.advance(0);
    expect(github.file && parseSettings(github.file.text)).toEqual({ kind: 'ok', document: tracking.document });

    // Shown again with nothing changed: a read — the write gave no ETag — then conditional reads, 304s.
    session.setVisible(true);
    await session.clock.advance(0);
    session.setVisible(true);
    await session.clock.advance(0);
    expect(github.answered.slice(-2)).toEqual([200, 304]);

    // Another device tracks docs.
    github.writeFile(
        documentOf([
            { ...WEB, tracking: true },
            { ...API, tracking: true },
            { ...DOCS, tracking: true },
        ]),
    );
    const before = session.operations().length;
    session.setVisible(true);
    await session.clock.advance(0);
    expect(tracking.repositories).toEqual([WEB, API, DOCS]);
    expect(writes(session.operations().slice(before))).toEqual([]);
    expect(sync.state).toMatchObject({ state: 'on', sha: github.file?.sha });
});

test('a write refused for a newer file reads it again and merges: what another device added meanwhile survives', async () => {
    const { session, tracking, sync, github } = await turnedOn();
    // Another device tracks docs between this tab's read and its write.
    github.beforeNextWrite = () =>
        github.writeFile(
            documentOf([
                { ...WEB, tracking: true },
                { ...DOCS, tracking: true },
            ]),
        );

    tracking.track({ repository: API });
    await session.clock.advance(0);

    const both = documentOf([
        { ...WEB, tracking: true },
        { ...DOCS, tracking: true },
        { ...API, tracking: true },
    ]);
    expect(github.answered).toContain(409);
    expect(github.file?.text).toBe(serializeSettings(both));
    expect(tracking.document).toEqual(both);
    expect(sync.state).toMatchObject({ state: 'on', base: both, sha: github.file?.sha });
});

test('a write whose answer was lost merges to no change on the next sync', async () => {
    const { session, tracking, sync, github } = await turnedOn();
    github.loseNextWriteAnswer = true;

    tracking.track({ repository: API });
    await session.clock.advance(0);
    const written = github.file?.text;
    expect(written).toBe(serializeSettings(tracking.document));
    expect(sync.state).toMatchObject({ state: 'on' });

    const before = session.operations().length;
    session.setVisible(true);
    await session.clock.advance(0);

    expect(writes(session.operations().slice(before))).toEqual([]);
    expect(github.file?.text).toBe(written);
    expect(tracking.repositories).toEqual([WEB, API]);
    expect(sync.state).toMatchObject({ state: 'on', base: tracking.document, sha: github.file?.sha });
});

test('GitHub out of reach leaves syncing on, and the next trigger saves what is left', async () => {
    const { session, tracking, sync, github } = await turnedOn();
    github.down = true;

    tracking.track({ repository: API });
    await session.clock.advance(0);
    expect(sync.state).toMatchObject({ state: 'on' });

    github.down = false;
    session.setVisible(true);
    await session.clock.advance(0);
    expect(github.file && parseSettings(github.file.text)).toEqual({ kind: 'ok', document: tracking.document });
});

test('a write GitHub refuses stops syncing with its message', async () => {
    const { session, tracking, sync, github } = await turnedOn();
    github.refuseWrites = 'Repository access blocked';

    tracking.track({ repository: API });
    await session.clock.advance(0);

    expect(sync.state).toMatchObject({
        state: 'stopped',
        reason: { kind: 'refused', message: 'Repository access blocked' },
    });
});

test('a deleted repository stops syncing, and trying again never creates it', async () => {
    const { session, tracking, sync, github } = await turnedOn();
    github.repository = null;
    github.file = null;

    session.setVisible(true);
    await session.clock.advance(0);
    expect(sync.state).toMatchObject({ state: 'stopped', reason: { kind: 'deleted' } });

    await sync.retry();
    tracking.track({ repository: API });
    await session.clock.advance(0);

    expect(sync.state).toMatchObject({ state: 'stopped', reason: { kind: 'deleted' } });
    expect(session.operations()).not.toContain('POST /user/repos');
    expect(writes(session.operations())).toEqual([]);
});

test('trying again once the file is readable goes on from the version this device last saw', async () => {
    const { session, tracking, sync, github } = await turnedOn();
    github.writeFile('not json');
    tracking.track({ repository: API });
    await session.clock.advance(0);
    expect(sync.state).toMatchObject({ state: 'stopped', reason: { kind: 'unreadable' } });

    // Fixed by hand on github.com, untracking web there.
    github.writeFile(documentOf([{ ...WEB, tracking: false }]));
    await sync.retry();

    // web: untracked there, api: tracked here since — both kept.
    const merged = documentOf([
        { ...WEB, tracking: false },
        { ...API, tracking: true },
    ]);
    expect(tracking.document).toEqual(merged);
    expect(github.file?.text).toBe(serializeSettings(merged));
    expect(sync.state).toMatchObject({ state: 'on', base: merged });
});

test('coming back to the tab reads the file once, though it is shown and focused both', async () => {
    const { session, github } = await turnedOn();

    session.setVisible(true);
    session.focus();
    await session.clock.advance(0);
    expect(github.answered.slice(-1)).toEqual([200]);
    const reads = github.answered.length;

    // Focused alone — a window beside another — it reads too.
    session.focus();
    await session.clock.advance(0);
    expect(github.answered.length).toBe(reads + 1);
});

test('creating the repository refused, trying again creates it', async () => {
    const { session, tracking, sync, github } = await open();
    tracking.choose({ repositories: [WEB], projects: [] });
    github.refuseCreate = 'Repository creation failed.';

    await sync.turnOn();
    expect(sync.state).toEqual({
        state: 'stopped',
        reason: { kind: 'refused', message: 'Repository creation failed.' },
    });
    expect(github.created).toBe(false);

    github.refuseCreate = null;
    await sync.retry();
    await session.clock.advance(0);

    expect(github.created).toBe(true);
    expect(github.file && parseSettings(github.file.text)).toEqual({ kind: 'ok', document: tracking.document });
    expect(sync.state).toMatchObject({ state: 'on', sha: github.file?.sha });
});

test('a write refused with a 422 that is not about the version stops syncing, and is not tried again', async () => {
    const { session, tracking, sync, github } = await turnedOn();
    github.refuseWritesWith422 = 'Repository rule violations found';

    tracking.track({ repository: API });
    await session.clock.advance(0);

    expect(sync.state).toMatchObject({
        state: 'stopped',
        reason: { kind: 'refused', message: 'Repository rule violations found' },
    });
    expect(writes(session.operations())).toEqual([`PUT /repos/${github.login}/githq-settings/contents/settings.json`]);
});

test('answers for a session that ended are dropped', async () => {
    const { session, tracking, github } = await turnedOn();
    github.writeFile(
        documentOf([
            { ...WEB, tracking: true },
            { ...DOCS, tracking: true },
        ]),
    );
    // Another user, syncing too, signs in on this browser while this one's read is under way.
    const other = `user-${crypto.randomUUID()}`;
    const theirs = documentOf([{ ...API, tracking: true }]);
    session.localStorage.set(
        `githq.settings.${other}`,
        JSON.stringify({
            chosen: true,
            document: theirs,
            saving: { state: 'on', base: theirs, sha: 'theirs', etag: '"theirs"', syncedAt: 0 },
        }),
    );
    let release = () => {};
    session.github.hold = new Promise(resolve => {
        release = resolve;
    });

    session.setVisible(true);
    await Promise.resolve();
    session.signInFromAnotherTab(other);
    await tracking.ready();
    release();
    session.github.hold = null;
    await session.clock.advance(0);

    // The first user's file did not reach the other's settings, nor was anything written for either.
    expect(tracking.document).toEqual(theirs);
    expect(writes(session.operations())).toEqual([]);
});

/** The fake settings repository of one user, behind the REST answers of the test session. */
interface SettingsGitHub {
    /** `null`: there is none. */
    repository: { private: boolean } | null;
    file: { text: string; sha: string } | null;
    created: boolean;
    /** The statuses answered to the settings file's reads and writes, in order. */
    readonly answered: number[];
    /** Writes refused with a 409 as a repository just created refuses them. */
    refuseNextWrites: number;
    /** Run before the next write is answered — another device writing first. */
    beforeNextWrite: (() => void) | null;
    /** The next write is done, but its answer does not arrive. */
    loseNextWriteAnswer: boolean;
    /** Every request fails with a 502. */
    down: boolean;
    /** Writes refused with a 403 and this message. */
    refuseWrites: string | null;
    /** Writes refused with a 422 and this message — not the one for a missing `sha`. */
    refuseWritesWith422: string | null;
    /** Creating the repository refused with a 422 and this message. */
    refuseCreate: string | null;
    readonly login: string;
    /** Another device (or a hand edit) writes the file. */
    writeFile(content: SettingsDocument | string): void;
}

async function open(login = `user-${crypto.randomUUID()}`) {
    const github = createSettingsGitHub(login);
    const session = createTestSession({
        login,
        answer: () => undefined,
        answerRest: request => github.answer(request),
    });
    setIndexedDbPersistence(session.container);
    session.container.resolve(ItemStore);
    const tracking = session.container.resolve(TrackingStore);
    const sync = session.container.resolve(SettingsSync);
    await tracking.ready();
    await session.clock.advance(0);
    return { session, tracking, sync, github: github.state, login };
}

/** Signed in with web tracked and syncing on, saved to a new repository; GitHub's requests so far forgotten. */
async function turnedOn() {
    const opened = await open();
    opened.tracking.choose({ repositories: [WEB], projects: [] });
    await opened.sync.turnOn();
    await opened.session.clock.advance(0);
    opened.session.github.requests.length = 0;
    return opened;
}

function createSettingsGitHub(login: string) {
    const repositoryPath = `/repos/${login}/githq-settings`;
    const filePath = `${repositoryPath}/contents/settings.json`;
    let version = 0;

    const state: SettingsGitHub = {
        repository: null,
        file: null,
        created: false,
        answered: [],
        refuseNextWrites: 0,
        beforeNextWrite: null,
        loseNextWriteAnswer: false,
        down: false,
        refuseWrites: null,
        refuseWritesWith422: null,
        refuseCreate: null,
        login,
        writeFile: content => {
            state.file = {
                text: typeof content === 'string' ? content : serializeSettings(content),
                sha: `sha${++version}`,
            };
        },
    };

    return { state, answer };

    function answer(request: TestGraphQLRequest): TestRestAnswer | undefined {
        if (state.down) {
            return undefined;
        }

        switch (request.operation) {
            case `GET ${repositoryPath}`:
                return state.repository
                    ? { status: 200, body: { private: state.repository.private, node_id: 'R_settings' } }
                    : { status: 404, body: { message: 'Not Found' } };
            case 'POST /user/repos':
                if (state.refuseCreate !== null) {
                    return { status: 422, body: { message: state.refuseCreate } };
                }

                state.repository = { private: true };
                state.created = true;
                return { status: 201, body: { name: 'githq-settings' } };
            case `GET ${filePath}`:
                return record(readFile(request));
            case `PUT ${filePath}`:
                return record(writeFile(request));
            default:
                return undefined;
        }
    }

    function readFile(request: TestGraphQLRequest): TestRestAnswer | undefined {
        if (!state.repository || !state.file) {
            return { status: 404, body: { message: 'Not Found' } };
        }

        const etag = `"${state.file.sha}"`;
        if (request.variables.ifNoneMatch === etag) {
            return { status: 304, etag };
        }

        const bytes = new TextEncoder().encode(state.file.text);
        const content = btoa(Array.from(bytes, byte => String.fromCodePoint(byte)).join(''));
        return { status: 200, etag, body: { encoding: 'base64', content, sha: state.file.sha } };
    }

    function writeFile(request: TestGraphQLRequest): TestRestAnswer | undefined {
        if (!state.repository) {
            return { status: 404, body: { message: 'Not Found' } };
        }

        if (state.refuseWrites !== null) {
            return { status: 403, body: { message: state.refuseWrites } };
        }

        if (state.refuseWritesWith422 !== null) {
            return { status: 422, body: { message: state.refuseWritesWith422 } };
        }

        if (state.refuseNextWrites > 0) {
            state.refuseNextWrites--;
            return { status: 409, body: { message: 'Git Repository is empty.' } };
        }

        state.beforeNextWrite?.();
        state.beforeNextWrite = null;

        const body = request.variables.body;
        if (typeof body !== 'object' || body === null || !('content' in body) || typeof body.content !== 'string') {
            return { status: 422, body: { message: 'Invalid request' } };
        }

        const sha = 'sha' in body ? body.sha : undefined;
        if (state.file && sha === undefined) {
            return { status: 422, body: { message: '"sha" wasn\'t supplied.' } };
        }

        if (sha !== undefined && sha !== state.file?.sha) {
            return { status: 409, body: { message: `settings.json does not match ${JSON.stringify(sha)}` } };
        }

        const binary = atob(body.content);
        state.writeFile(new TextDecoder().decode(Uint8Array.from(binary, char => char.codePointAt(0) ?? 0)));
        if (state.loseNextWriteAnswer) {
            state.loseNextWriteAnswer = false;
            return undefined;
        }

        return { status: 200, body: { content: { sha: state.file?.sha } } };
    }

    function record(result: TestRestAnswer | undefined) {
        state.answered.push(result?.status ?? 502);
        return result;
    }
}

function documentOf(repositories: SettingsRepository[]): SettingsDocument {
    return { version: 1, repositories, projects: [] };
}

function rest(operations: string[]) {
    return operations.filter(operation => /^(?:GET|POST|PUT) /.test(operation));
}

function writes(operations: string[]) {
    return operations.filter(operation => operation.startsWith('PUT ') || operation.startsWith('POST '));
}
