/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own logins, so their databases never meet.
import 'fake-indexeddb/auto';

import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { injectionKey } from '@nzyme/vue-ioc/injectionKey.js';
import { expect, test } from 'bun:test';
import { createApp, effectScope } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { ReviewFiles } from '@/review/ReviewFiles.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { samplePullRequestDetailNode } from '@/testing/sampleDetailNodes.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { uniqueLogin } from '@/testing/uniqueLogin.js';
import { waitUntil } from '@/testing/waitUntil.js';

import { ItemNavigation } from './ItemNavigation.js';
import { ItemResolver } from './ItemResolver.js';
import { useOpenedItem } from './useOpenedItem.js';

const REFERENCE = { owner: 'acme', name: 'web', number: 7 };
const PULL_REQUEST = 'PR_7';

test("a pull request's review threads are read when it opens, not again when its row is replaced", async () => {
    const session = createTestSession({
        login: uniqueLogin(),
        answer: ({ operation }) => {
            switch (operation) {
                case 'ItemByNumber':
                    return { data: { repository: { issueOrPullRequest: { id: PULL_REQUEST } } } };
                case 'ItemDetail':
                    return { data: { node: samplePullRequestDetailNode(PULL_REQUEST, '2026-01-01T00:00:00Z') } };
                case 'PullRequestReviewThreads':
                    return {
                        data: {
                            repository: {
                                pullRequest: {
                                    reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
                                },
                            },
                        },
                    };
                default:
                    return undefined;
            }
        },
    });
    setIndexedDbPersistence(session.container);
    const threadReads = () => session.operations().filter(name => name === 'PullRequestReviewThreads').length;
    // The component's container, handing over the session's stores.
    const container = createContainer();
    container.set(ItemResolver, session.container.resolve(ItemResolver));
    container.set(ItemDetailStore, session.container.resolve(ItemDetailStore));
    container.set(ItemStore, session.container.resolve(ItemStore));
    container.set(ItemNavigation, session.container.resolve(ItemNavigation));
    container.set(ReviewFiles, session.container.resolve(ReviewFiles));
    container.set(AccountSession, session.container.resolve(AccountSession));
    const app = createApp({});
    app.provide(injectionKey, container);
    const scope = effectScope();
    const opened = app.runWithContext(() => scope.run(() => useOpenedItem({ reference: REFERENCE })));

    await waitUntil(() => opened?.item !== null && threadReads() === 1, { timeoutMs: 2000 });
    const before = opened?.item;
    // A read of its detail replaces its row with an equal one, as a poll or a draft started does.
    await session.container.resolve(ItemDetailStore).readAgain(PULL_REQUEST);
    expect(opened?.item).not.toBe(before);
    await Bun.sleep(50);

    expect(threadReads()).toBe(1);
    scope.stop();
});
