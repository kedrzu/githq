import { waitUntil } from '@nzyme/utils/waitUntil.js';
import { expect, test } from 'bun:test';

import { createTestSession } from '@/testing/createTestSession.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';

import { ChangelogStore } from './ChangelogStore.js';

const WAIT = { intervalMs: 1, timeoutMs: 1000 };
const STABLE_BUILD = { version: '0.2.0', commit: 'abc' };
const DEVELOPMENT_BUILD = { version: '0.3.0-dev.214', commit: 'abc' };
const RELEASES = 'RepositoryReleases';
const COMMITS = 'CommitSubjects';

test('reads when the section opens and not before, and an opening while it reads adds nothing', async () => {
    const { store, asked } = start(() => releases([release('v0.2.0')]));
    expect(asked()).toEqual([]);
    expect(store.read.kind).toBe('idle');

    store.open(STABLE_BUILD);
    store.open(STABLE_BUILD);
    await waitUntil(() => store.read.kind === 'loaded', WAIT);

    expect(asked()).toEqual([RELEASES]);
});

test('another opening reads again behind what is shown, and a corrected description arrives', async () => {
    let description = '<p>First</p>';
    const { store, asked, session } = start(() => releases([release('v0.2.0', { descriptionHTML: description })]));
    store.open(STABLE_BUILD);
    await waitUntil(() => store.read.kind === 'loaded', WAIT);

    description = '<p>Corrected</p>';
    const held = Promise.withResolvers<void>();
    session.github.hold = held.promise;
    store.open(STABLE_BUILD);
    store.open(STABLE_BUILD);
    await waitUntil(() => asked().length === 2, WAIT);
    expect(store.read).toMatchObject({ kind: 'loaded', answer: { releases: [{ bodyHtml: '<p>First</p>' }] } });

    held.resolve();
    await waitUntil(
        () => store.read.kind === 'loaded' && store.read.answer.releases[0]?.bodyHtml === '<p>Corrected</p>',
        WAIT,
    );
    expect(asked()).toEqual([RELEASES, RELEASES]);
});

test('a refresh that fails leaves what is shown', async () => {
    let refuse = false;
    const { store, asked } = start(() => (refuse ? undefined : releases([release('v0.2.0')])));
    store.open(STABLE_BUILD);
    await waitUntil(() => store.read.kind === 'loaded', WAIT);

    refuse = true;
    store.open(STABLE_BUILD);
    await waitUntil(() => asked().length === 2, WAIT);
    await Bun.sleep(5);

    expect(store.read).toMatchObject({ kind: 'loaded', answer: { releases: [{ tagName: 'v0.2.0' }] } });
});

test('offline an opening with something shown asks nothing and leaves it', async () => {
    const { store, asked, session } = start(() => releases([release('v0.2.0')]));
    store.open(STABLE_BUILD);
    await waitUntil(() => store.read.kind === 'loaded', WAIT);

    session.setOnline(false);
    store.open(STABLE_BUILD);

    expect(store.read.kind).toBe('loaded');
    expect(asked()).toHaveLength(1);
});

test('the first read shows that it is loading', () => {
    const { store } = start(() => releases([]));

    store.open(STABLE_BUILD);

    expect(store.read.kind).toBe('loading');
});

test('a failed read, a rate limit among them, says so and is tried again on the next opening', async () => {
    let refuse = true;
    const { store, asked } = start(() =>
        refuse
            ? { data: null, errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] }
            : releases([release('v0.2.0')]),
    );

    store.open(STABLE_BUILD);
    await waitUntil(() => store.read.kind === 'failed', WAIT);

    refuse = false;
    store.open(STABLE_BUILD);
    await waitUntil(() => store.read.kind === 'loaded', WAIT);
    expect(asked()).toHaveLength(2);
});

test('offline it asks nothing, waits, and reads by itself once back', async () => {
    const { store, asked, session } = start(() => releases([]));
    session.setOnline(false);

    store.open(STABLE_BUILD);
    expect(store.read.kind).toBe('offline');
    expect(asked()).toEqual([]);

    session.setOnline(true);
    await waitUntil(() => store.read.kind === 'loaded', WAIT);
    expect(asked()).toHaveLength(1);
});

test('losing the connection while reading waits for it too, instead of failing', async () => {
    const { store, session } = start(() => {
        session.setOnline(false);
        return undefined;
    });

    store.open(STABLE_BUILD);
    await waitUntil(() => store.read.kind === 'offline', WAIT);
});

test('a Development build reads from its own commit back to a Stable tag, and names that Stable', async () => {
    const { store, asked, session } = start(({ operation }) =>
        operation === RELEASES
            ? releases([release('v0.2.0', { tagCommit: { oid: 'tagged' } })])
            : commits([
                  { oid: 'abc', message: 'feat: new (#3)' },
                  { oid: 'tagged', message: 'chore: release' },
              ]),
    );

    store.open(DEVELOPMENT_BUILD);
    await waitUntil(() => store.read.kind === 'loaded', WAIT);

    expect(store.read).toMatchObject({
        answer: { development: { since: '0.2.0', subjects: ['feat: new (#3)'], limited: false } },
    });
    expect(asked()).toEqual([RELEASES, COMMITS]);
    expect(session.github.requests.at(-1)?.variables).toMatchObject({ from: 'abc' });
});

test('a newer Stable tagged on a later commit is never met: the walk stops at the older one it does meet', async () => {
    let pages = 0;
    const { store } = start(({ operation }) => {
        if (operation === RELEASES) {
            return releases([
                release('v0.2.1', { tagCommit: { oid: 'later-than-the-build' } }),
                release('v0.2.0', { tagCommit: { oid: 'behind-the-build' } }),
            ]);
        }

        pages++;
        return commits([
            { oid: 'abc', message: 'feat: new' },
            { oid: 'behind-the-build', message: 'chore: release' },
        ]);
    });

    store.open(DEVELOPMENT_BUILD);
    await waitUntil(() => store.read.kind === 'loaded', WAIT);

    expect(store.read).toMatchObject({
        answer: { development: { since: '0.2.0', subjects: ['feat: new'], limited: false } },
    });
    expect(pages).toBe(1);
});

test('meeting no Stable tag ends at three pages, cut short and named after none, even with a Stable out there', async () => {
    let pages = 0;
    const { store } = start(({ operation }) => {
        if (operation === RELEASES) {
            return releases([release('v0.2.1', { tagCommit: { oid: 'later-than-the-build' } })]);
        }

        pages++;
        return commits([{ oid: `sha-${pages}`, message: 'fix: one' }], `cursor-${pages}`);
    });

    store.open(DEVELOPMENT_BUILD);
    await waitUntil(() => store.read.kind === 'loaded', WAIT);

    expect(pages).toBe(3);
    expect(store.read).toMatchObject({ answer: { development: { since: null, limited: true } } });
});

test('a local build, with no commit, reads from main', async () => {
    const { store, session } = start(({ operation }) => (operation === RELEASES ? releases([]) : commits([])));

    store.open({ version: '0.1.0-dev.5', commit: null });
    await waitUntil(() => store.read.kind === 'loaded', WAIT);

    expect(session.github.requests.find(request => request.operation === COMMITS)?.variables).toMatchObject({
        from: 'main',
    });
});

function release(tagName: string, fields: object = {}) {
    return {
        tagName,
        isDraft: false,
        isPrerelease: false,
        publishedAt: '2026-11-03T10:00:00Z',
        descriptionHTML: '<p>Changes</p>',
        tagCommit: { oid: `commit-of-${tagName}` },
        ...fields,
    };
}

function releases(nodes: readonly object[]): TestGraphQLAnswer {
    return { data: { repository: { releases: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } } } };
}

function commits(nodes: readonly object[], next?: string): TestGraphQLAnswer {
    return {
        data: {
            repository: {
                object: {
                    history: { pageInfo: { hasNextPage: next !== undefined, endCursor: next ?? null }, nodes },
                },
            },
        },
    };
}

function start(answer: (request: TestGraphQLRequest) => TestGraphQLAnswer | undefined) {
    const session = createTestSession({ login: 'mlaine', answer });
    return {
        session,
        store: session.container.resolve(ChangelogStore),
        // The session asks who is signed in by itself.
        asked: () => session.github.requests.flatMap(({ operation }) => (operation === 'Viewer' ? [] : [operation])),
    };
}
