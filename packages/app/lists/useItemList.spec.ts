import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { assertValue } from '@nzyme/utils/assert.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { Browser } from '@/services/Browser.js';
import { ItemStore } from '@/store/ItemStore.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { samplePullRequest } from '@/testing/sampleItems.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import type { ItemListViewModel } from './useItemList.js';
import { useItemList } from './useItemList.js';

test('a step back to the opened item overtakes a step still on its way: the address stays on it', async () => {
    const opened = '/?pane=issue&issue=acme%7Cweb%7C2';
    const { list, router } = await mountList(opened);

    list.open('p1');
    list.open('p2');
    await new Promise<void>(resolve => {
        setTimeout(resolve, 50);
    });

    expect(router.currentRoute.value.fullPath).toBe(opened);
});

test('K2: a toast’s request selects the failed pull requests of a collapsed stack, which are no steps, and only those listed', async () => {
    const { list, navigation } = await mountList('/');
    list.setListed({ all: ['a', 'p1', 'p2'], steps: ['a', 'p1'], stepOf: new Map([['p2', 'p1']]), around: null });

    navigation.requestSelection(['p2', 'elsewhere']);
    await nextTick();

    expect(list.checkedIds).toEqual(['p2']);
});

test('an opened item steps through what the list hands over, every move of its cursor; once it goes, its cursor goes with it', async () => {
    const { list, navigation, app } = await mountList('/?filter=a&pane=issue&issue=acme%7Cweb%7C1');
    const stepOf = new Map([['p2', 'p1']]);
    list.setListed({ all: ['a', 'p1', 'p2'], steps: ['a', 'p1'], stepOf, around: { previous: null, next: 'p1' } });
    await nextTick();

    const expected = { path: '/?filter=a', steps: ['a', 'p1'], stepOf };
    expect(navigation.list).toEqual({ ...expected, around: { previous: null, next: 'p1' } });

    app.unmount();
    expect(navigation.list).toEqual({ ...expected, around: null });
});

/** `useItemList` on a page at `path`, with the pull requests p1 and p2 in the local copy. */
async function mountList(path: string) {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(Browser, createSignedInBrowser());
    setIndexedDbPersistence(container);
    const store = container.resolve(ItemStore);
    await store.ready();
    store.upsertMany([
        { ...samplePullRequest('p1'), number: 1 },
        { ...samplePullRequest('p2'), number: 2 },
    ]);

    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/', component: { render: () => null } }],
    });
    await router.push(path);

    const lists: ItemListViewModel[] = [];
    const app = createApp({
        setup() {
            lists.push(useItemList());
            return () => h('div');
        },
    });
    app.use(IocPlugin, { container });
    app.use(router);
    app.mount(document.createElement('div'));
    let mounted = true;
    onTestFinished(() => {
        if (mounted) {
            app.unmount();
        }
    });

    return {
        list: assertValue(lists[0]),
        router,
        navigation: container.resolve(ItemNavigation),
        app: {
            unmount() {
                mounted = false;
                app.unmount();
            },
        },
    };
}
