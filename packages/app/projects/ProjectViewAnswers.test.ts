/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import type { Container } from '@nzyme/ioc/Container.js';
import { createPromise } from '@nzyme/utils/createPromise.js';

import { ItemStore } from '@/store/ItemStore.js';
import { EDIT_RESERVE } from '@/sync/getAllowancePause.js';
import { createTestSession } from '@/testing/createTestSession.js';
import type { TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestTabs } from '@/testing/createTestTabs.js';
import { worldProjectItem } from '@/testing/createTrackingWorld.js';
import { sampleIssueNode } from '@/testing/sampleRowNodes.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import type { TrackedProject } from '@/tracking/TrackingTypes.js';

import { ProjectStore } from './ProjectStore.js';
import { ANSWER_INTERVAL_MS, ProjectViewAnswers } from './ProjectViewAnswers.js';

const VIEW = { projectId: 'PVT_1', filter: 'reviewers:octocat', term: 'reviewers:octocat' };
const ROADMAP: TrackedProject = { id: 'PVT_1', owner: 'acme', ownerKind: 'org', number: 1, title: 'Roadmap' };

test('K6: GitHub is asked with the view’s filter while it is shown, again every interval; its items come in too', async () => {
    const issue = sampleIssueNode('I_1', { repository: 'acme/web', number: 1, updatedAt: '2026-10-26T10:00:00Z' });
    const session = createTestSession({
        login: `user-${crypto.randomUUID()}`,
        answer: ({ operation, variables }) =>
            operation === 'ProjectItems' && variables.query === VIEW.filter
                ? {
                      data: {
                          node: {
                              items: {
                                  totalCount: 1,
                                  pageInfo: { hasNextPage: false, endCursor: null },
                                  nodes: [worldProjectItem('PVTI_1', issue, 'O_todo')],
                              },
                          },
                      },
                  }
                : undefined,
    });
    setIndexedDbPersistence(session.container);
    const items = session.container.resolve(ItemStore);
    const projects = session.container.resolve(ProjectStore);
    const answers = session.container.resolve(ProjectViewAnswers);
    await items.ready();
    await track(session.container);

    expect(answers.get(VIEW.projectId, VIEW.filter).ids).toBeNull();
    answers.show(VIEW);
    // Shown again (its page came back) while GitHub is asked: still asked once.
    const stop = answers.show({ ...VIEW });
    await session.clock.advance(0);

    expect(asked()).toBe(1);
    expect([...(answers.get(VIEW.projectId, VIEW.filter).ids ?? [])]).toEqual(['PVTI_1']);
    expect(answers.getFreshness(VIEW)).toEqual({ kind: 'answered', term: VIEW.term, checkedAt: session.clock.now() });
    expect(projects.getStoredItem('PVTI_1')?.contentId).toBe('I_1');
    expect(items.get('I_1')?.title).toBe('Issue I_1');

    await session.clock.advance(ANSWER_INTERVAL_MS);
    expect(asked()).toBe(2);

    stop();
    await session.clock.advance(ANSWER_INTERVAL_MS * 3);
    expect(asked()).toBe(2);
    expect(answers.shown).toBeNull();

    function asked() {
        return session.github.requests.filter(request => request.operation === 'ProjectItems').length;
    }
});

test('K6: a tab opening a view the syncing tab has an answer for shows it at once, without asking GitHub again', async () => {
    const tabs = createTestTabs();
    const login = `user-${crypto.randomUUID()}`;
    const issue = sampleIssueNode('I_1', { repository: 'acme/web', number: 1, updatedAt: '2026-10-26T10:00:00Z' });
    const answer = (request: TestGraphQLRequest) =>
        request.operation === 'ProjectItems'
            ? {
                  data: {
                      node: {
                          items: {
                              totalCount: 1,
                              pageInfo: { hasNextPage: false, endCursor: null },
                              nodes: [worldProjectItem('PVTI_1', issue, 'O_todo')],
                          },
                      },
                  },
              }
            : undefined;
    const syncing = createTestSession({ login, answer, tabs });
    setIndexedDbPersistence(syncing.container);
    await syncing.container.resolve(ItemStore).ready();
    await track(syncing.container);
    const syncingAnswers = syncing.container.resolve(ProjectViewAnswers);
    syncingAnswers.show(VIEW);
    await syncing.clock.advance(0);
    expect(syncingAnswers.get(VIEW.projectId, VIEW.filter).ids).toEqual(new Set(['PVTI_1']));

    const opened = createTestSession({ login, answer, tabs });
    setIndexedDbPersistence(opened.container);
    await opened.container.resolve(ItemStore).ready();
    const openedAnswers = opened.container.resolve(ProjectViewAnswers);
    await opened.clock.advance(0);
    openedAnswers.show(VIEW);
    await syncing.clock.advance(0);
    await opened.clock.advance(0);

    expect(openedAnswers.get(VIEW.projectId, VIEW.filter).ids).toEqual(new Set(['PVTI_1']));
    const asked = [...syncing.github.requests, ...opened.github.requests].filter(
        request => request.operation === 'ProjectItems',
    );
    expect(asked).toHaveLength(1);
});

test('K3: with the GraphQL allowance down to what is kept for edits, a view is not asked again until the reset', async () => {
    const issue = sampleIssueNode('I_1', { repository: 'acme/web', number: 1, updatedAt: '2026-10-26T10:00:00Z' });
    const session = createTestSession({
        login: `user-${crypto.randomUUID()}`,
        answer: () => ({
            data: {
                node: {
                    items: {
                        totalCount: 1,
                        pageInfo: { hasNextPage: false, endCursor: null },
                        nodes: [worldProjectItem('PVTI_1', issue, 'O_todo')],
                    },
                },
            },
        }),
    });
    setIndexedDbPersistence(session.container);
    await session.container.resolve(ItemStore).ready();
    const answers = session.container.resolve(ProjectViewAnswers);
    // The answer says only the reserve is left, until an hour on.
    session.github.graphqlRemaining = EDIT_RESERVE;

    answers.show(VIEW);
    await session.clock.advance(0);
    expect(asked()).toBe(1);

    await session.clock.advance(ANSWER_INTERVAL_MS * 2);
    expect(asked()).toBe(1);
    // Waiting for the allowance is not failing: what it answered stays as it was.
    expect(answers.get(VIEW.projectId, VIEW.filter)).toMatchObject({ failing: false });

    session.github.graphqlRemaining = 4000;
    await session.clock.advance(3_600_000 - ANSWER_INTERVAL_MS * 2);
    expect(asked()).toBe(2);

    function asked() {
        return session.github.requests.filter(request => request.operation === 'ProjectItems').length;
    }
});

test('K6: a view GitHub does not answer is said to be failing, and keeps what it answered before', async () => {
    const session = createTestSession({ login: `user-${crypto.randomUUID()}`, answer: () => undefined });
    setIndexedDbPersistence(session.container);
    await session.container.resolve(ItemStore).ready();
    const answers = session.container.resolve(ProjectViewAnswers);

    answers.show(VIEW);
    await session.clock.advance(0);
    expect(answers.get(VIEW.projectId, VIEW.filter)).toMatchObject({ ids: null, failing: true });
    expect(answers.getFreshness(VIEW)).toEqual({ kind: 'stale', since: null, reason: 'failing' });
});

test('K6: a project GitHub does not show — midway through the pages or at the start — is failing, not an answer', async () => {
    const issue = sampleIssueNode('I_1', { repository: 'acme/web', number: 1, updatedAt: '2026-10-26T10:00:00Z' });
    /** What GitHub shows of the project: its first page only, both pages, or nothing. */
    let shown: 'firstPage' | 'all' | 'none' = 'firstPage';
    const session = createTestSession({
        login: `user-${crypto.randomUUID()}`,
        answer: ({ variables }) => {
            const first = variables.after === null;
            if (shown === 'none' || (shown === 'firstPage' && !first)) {
                return { data: { node: null } };
            }

            return {
                data: {
                    node: {
                        items: {
                            totalCount: 2,
                            pageInfo: { hasNextPage: first, endCursor: first ? 'c1' : null },
                            nodes: first ? [worldProjectItem('PVTI_1', issue, 'O_todo')] : [],
                        },
                    },
                },
            };
        },
    });
    setIndexedDbPersistence(session.container);
    await session.container.resolve(ItemStore).ready();
    const answers = session.container.resolve(ProjectViewAnswers);

    answers.show(VIEW);
    await session.clock.advance(0);
    expect(answers.get(VIEW.projectId, VIEW.filter)).toMatchObject({ ids: null, failing: true });

    shown = 'all';
    await session.clock.advance(ANSWER_INTERVAL_MS);
    const answered = answers.get(VIEW.projectId, VIEW.filter);
    expect(answered).toMatchObject({ failing: false });
    expect([...(answered.ids ?? [])]).toEqual(['PVTI_1']);

    shown = 'none';
    await session.clock.advance(ANSWER_INTERVAL_MS);
    // What it answered before stays, said to be failing — not replaced by an empty answer.
    expect(answers.get(VIEW.projectId, VIEW.filter)).toMatchObject({ ids: answered.ids, failing: true });
    expect(answers.getFreshness(VIEW)).toEqual({ kind: 'stale', since: answered.checkedAt, reason: 'failing' });
});

test('K6: an answer on its way when the project is untracked brings none of its items into the stores', async () => {
    const issue = sampleIssueNode('I_1', { repository: 'acme/web', number: 1, updatedAt: '2026-10-26T10:00:00Z' });
    const session = createTestSession({
        login: `user-${crypto.randomUUID()}`,
        answer: () => ({
            data: {
                node: {
                    items: {
                        totalCount: 1,
                        pageInfo: { hasNextPage: false, endCursor: null },
                        nodes: [worldProjectItem('PVTI_1', issue, 'O_todo')],
                    },
                },
            },
        }),
    });
    setIndexedDbPersistence(session.container);
    const items = session.container.resolve(ItemStore);
    const projects = session.container.resolve(ProjectStore);
    const answers = session.container.resolve(ProjectViewAnswers);
    await items.ready();
    const tracking = await track(session.container);
    const held = createPromise();
    session.github.hold = held.promise;

    answers.show(VIEW);
    await session.clock.advance(0);
    tracking.untrack({ kind: 'project', id: ROADMAP.id });
    held.resolve();
    await session.clock.advance(0);

    expect(projects.getStoredItem('PVTI_1')).toBeUndefined();
    expect(items.get('I_1')).toBeUndefined();
});

async function track(container: Container) {
    const tracking = container.resolve(TrackingStore);
    await tracking.ready();
    tracking.track({ project: ROADMAP });
    return tracking;
}
