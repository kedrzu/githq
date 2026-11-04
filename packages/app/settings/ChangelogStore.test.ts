import { waitUntil } from '@nzyme/utils/waitUntil.js';
import { expect, test } from 'bun:test';

import { createTestSession } from '@/testing/createTestSession.js';
import type { TestGraphQLRequest, TestRestAnswer } from '@/testing/createTestSession.js';

import { ChangelogStore } from './ChangelogStore.js';

const WAIT = { intervalMs: 1, timeoutMs: 1000 };
const STABLE_BUILD = { version: '0.2.0', commit: 'abc' };
const DEVELOPMENT_BUILD = { version: '0.3.0-dev.214', commit: 'abc' };
const RELEASE = { tag_name: 'v0.2.0', draft: false, prerelease: false, published_at: '2026-11-03T10:00:00Z' };
const RELEASES = 'GET /repos/kedrzu/githq/releases';
const COMMITS = 'GET /repos/kedrzu/githq/commits';

test('reads when the section opens and not before, and a second opening reuses the answer', async () => {
    const { store, asked } = start(() => ({ status: 200, body: [RELEASE] }));
    expect(asked()).toEqual([]);
    expect(store.read.kind).toBe('idle');

    store.open(STABLE_BUILD);
    store.open(STABLE_BUILD);
    await waitUntil(() => store.read.kind === 'loaded', WAIT);
    store.open(STABLE_BUILD);

    expect(asked()).toEqual([RELEASES]);
});

test('a failed read, a rate limit among them, says so and is tried again on the next opening', async () => {
    let refuse = true;
    const { store, asked } = start(() =>
        refuse ? { status: 403, body: { message: 'API rate limit exceeded' } } : { status: 200, body: [RELEASE] },
    );

    store.open(STABLE_BUILD);
    await waitUntil(() => store.read.kind === 'failed', WAIT);

    refuse = false;
    store.open(STABLE_BUILD);
    await waitUntil(() => store.read.kind === 'loaded', WAIT);
    expect(asked()).toHaveLength(2);
});

test('offline it asks nothing, waits, and reads by itself once back', async () => {
    const { store, asked, session } = start(() => ({ status: 200, body: [] }));
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
        return { status: 502, body: { message: 'Bad Gateway' } };
    });

    store.open(STABLE_BUILD);
    await waitUntil(() => store.read.kind === 'offline', WAIT);
});

test('a Development build reads its commits from its own commit, back to the last Stable tag', async () => {
    const { store, asked, session } = start(({ operation }) => {
        if (operation === RELEASES) {
            return { status: 200, body: [RELEASE] };
        }

        if (operation === `${COMMITS}/v0.2.0`) {
            return { status: 200, body: { sha: 'tagged' } };
        }

        return {
            status: 200,
            body: [
                { sha: 'abc', commit: { message: 'feat: new (#3)' } },
                { sha: 'tagged', commit: { message: 'chore: release' } },
            ],
        };
    });

    store.open(DEVELOPMENT_BUILD);
    await waitUntil(() => store.read.kind === 'loaded', WAIT);

    expect(store.read).toMatchObject({
        answer: { development: { since: '0.2.0', subjects: ['feat: new (#3)'], limited: false } },
    });
    expect(asked()).toEqual([RELEASES, `${COMMITS}/v0.2.0`, COMMITS]);
    expect(session.github.requests.at(-1)?.variables).toMatchObject({ sha: 'abc' });
});

test('a local build, with no commit and no Stable to read to, reads from main, up to three pages', async () => {
    let pages = 0;
    const { store, session } = start(({ operation }) => {
        if (operation === RELEASES) {
            return { status: 200, body: [] };
        }

        pages++;
        return {
            status: 200,
            body: [{ sha: `sha-${pages}`, commit: { message: 'fix: one' } }],
            link: `<https://api.github.com/repos/kedrzu/githq/commits?sha=main&per_page=100&page=${pages + 1}>; rel="next"`,
        };
    });

    store.open({ version: '0.1.0-dev.5', commit: null });
    await waitUntil(() => store.read.kind === 'loaded', WAIT);

    expect(session.github.requests.find(request => request.operation === COMMITS)?.variables).toMatchObject({
        sha: 'main',
    });
    expect(pages).toBe(3);
    expect(store.read).toMatchObject({ answer: { development: { since: null, limited: true } } });
});

function start(answerRest: (request: TestGraphQLRequest) => TestRestAnswer) {
    const session = createTestSession({ login: 'mlaine', answer: () => undefined, answerRest });
    return {
        session,
        store: session.container.resolve(ChangelogStore),
        asked: () =>
            session.github.requests.flatMap(({ operation }) => (operation.startsWith('GET /') ? [operation] : [])),
    };
}
